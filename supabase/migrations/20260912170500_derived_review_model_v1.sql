BEGIN;

-- Issue #307 — härledd reviewmodell.
--
-- Befintliga reviews lämnas som legacy: review_model förblir NULL och inga
-- Atmosfärsvärden fabriceras. Nya reviews fryser däremot explicit vilken
-- dimensionsmodell som gällde när reviewn skapades. overall blir decimal och
-- härleds server-side för alla reviews med en ny modell.

ALTER TABLE public.reviews
  ALTER COLUMN overall TYPE numeric(4,2) USING overall::numeric(4,2),
  ADD COLUMN IF NOT EXISTS atmosphere smallint,
  ADD COLUMN IF NOT EXISTS review_model text;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_atmosphere_check
  CHECK (atmosphere IS NULL OR (atmosphere >= 1 AND atmosphere <= 5));

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_review_model_check
  CHECK (
    review_model IS NULL OR review_model IN (
      'food_v1_takeaway',
      'food_v1_quick',
      'food_v1_atmosphere'
    )
  );

CREATE OR REPLACE FUNCTION public.derive_review_overall_v1(
  _review_model text,
  _taste smallint,
  _value smallint,
  _service smallint,
  _atmosphere smallint DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _sum numeric;
  _count integer;
BEGIN
  IF _review_model NOT IN ('food_v1_takeaway', 'food_v1_quick', 'food_v1_atmosphere') THEN
    RAISE EXCEPTION 'Ogiltig reviewmodell';
  END IF;
  IF _taste IS NULL OR _taste < 1 OR _taste > 5 THEN
    RAISE EXCEPTION 'Smak måste vara 1–5';
  END IF;
  IF _value IS NULL OR _value < 1 OR _value > 5 THEN
    RAISE EXCEPTION 'Prisvärdhet måste vara 1–5';
  END IF;
  IF _service IS NULL OR _service < 1 OR _service > 5 THEN
    RAISE EXCEPTION 'Service måste vara 1–5';
  END IF;

  _sum := _taste + _value + _service;
  _count := 3;

  IF _review_model = 'food_v1_atmosphere' THEN
    IF _atmosphere IS NULL OR _atmosphere < 1 OR _atmosphere > 5 THEN
      RAISE EXCEPTION 'Atmosfär måste vara 1–5';
    END IF;
    _sum := _sum + _atmosphere;
    _count := 4;
  ELSIF _atmosphere IS NOT NULL THEN
    RAISE EXCEPTION 'Atmosfär ingår inte i den här reviewmodellen';
  END IF;

  RETURN round(_sum / _count, 2);
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_new_review_model_v1(
  _group_id uuid,
  _place_id uuid,
  _is_takeaway boolean,
  _review_occasions text[] DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _occasions text[];
  _provided text[];
BEGIN
  IF COALESCE(_is_takeaway, false) THEN
    RETURN 'food_v1_takeaway';
  END IF;

  SELECT ARRAY(
    SELECT value
    FROM unnest(ARRAY['snabbt', 'avslappnat', 'middag']::text[]) WITH ORDINALITY allowed(value, ord)
    WHERE value = ANY(COALESCE(gp.occasions, '{}'::text[]))
    ORDER BY ord
    LIMIT 2
  )
  INTO _occasions
  FROM public.group_places gp
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id
    AND gp.collection_status = 'active';

  IF _occasions IS NULL THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppens aktiva lista';
  END IF;

  IF cardinality(_occasions) = 0 THEN
    SELECT ARRAY(
      SELECT value
      FROM unnest(ARRAY['snabbt', 'avslappnat', 'middag']::text[]) WITH ORDINALITY allowed(value, ord)
      WHERE value = ANY(COALESCE(_review_occasions, '{}'::text[]))
      ORDER BY ord
      LIMIT 2
    ) INTO _provided;

    IF cardinality(COALESCE(_provided, '{}'::text[])) = 0 THEN
      RAISE EXCEPTION 'Välj vad stället passar för innan omdömet sparas';
    END IF;
    IF cardinality(COALESCE(_review_occasions, '{}'::text[])) <> cardinality(_provided) THEN
      RAISE EXCEPTION 'Passar för innehåller ogiltiga eller för många val';
    END IF;

    UPDATE public.group_places
    SET occasions = _provided,
        updated_at = now()
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active'
      AND cardinality(occasions) = 0;

    SELECT occasions
    INTO _occasions
    FROM public.group_places
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active';
  END IF;

  IF 'avslappnat' = ANY(_occasions) OR 'middag' = ANY(_occasions) THEN
    RETURN 'food_v1_atmosphere';
  END IF;
  RETURN 'food_v1_quick';
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_derived_review_model_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.review_model IS NOT NULL
     AND NEW.review_model IS DISTINCT FROM OLD.review_model THEN
    RAISE EXCEPTION 'Reviewmodellen är historiskt låst';
  END IF;

  IF NEW.review_model IS NOT NULL THEN
    NEW.overall := public.derive_review_overall_v1(
      NEW.review_model,
      NEW.taste,
      NEW.value,
      NEW.service,
      NEW.atmosphere
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_derived_review_model_v1 ON public.reviews;
CREATE TRIGGER enforce_derived_review_model_v1
BEFORE INSERT OR UPDATE OF overall, taste, value, service, atmosphere, review_model
ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_derived_review_model_v1();

CREATE OR REPLACE FUNCTION public.create_visit_with_review_v5(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
  _is_takeaway boolean DEFAULT false,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _atmosphere smallint DEFAULT NULL,
  _comment text DEFAULT NULL,
  _guest_names text[] DEFAULT '{}'::text[],
  _review_occasions text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _vid uuid;
  _rid uuid;
  _place_name text;
  _actor_name text;
  _participant_count integer := 0;
  _guest_count integer := 0;
  _normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
  _scoreless boolean := _meal_type = 'dryck';
  _has_review boolean;
  _review_model text;
  _overall numeric(4,2);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_places
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppens aktiva lista';
  END IF;
  IF _meal_type NOT IN ('frukost', 'lunch', 'fika', 'middag', 'dryck') THEN
    RAISE EXCEPTION 'Ogiltigt tillfälle';
  END IF;
  IF NOT (_uid = ANY(COALESCE(_participant_ids, '{}'::uuid[]))) THEN
    RAISE EXCEPTION 'Den som registrerar besöket måste vara deltagare';
  END IF;

  _has_review := NOT _scoreless AND (
    _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL OR _atmosphere IS NOT NULL
  );

  IF _scoreless THEN
    IF _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL OR _atmosphere IS NOT NULL THEN
      RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
    END IF;
  ELSIF _has_review THEN
    _review_model := public.resolve_new_review_model_v1(
      _group_id,
      _place_id,
      COALESCE(_is_takeaway, false),
      _review_occasions
    );
    _overall := public.derive_review_overall_v1(
      _review_model,
      _taste,
      _value,
      _service,
      _atmosphere
    );
  ELSIF _normalized_comment IS NOT NULL THEN
    RAISE EXCEPTION 'Sätt alla relevanta betyg innan en kommentar sparas med omdömet';
  END IF;

  SELECT count(*) INTO _guest_count
  FROM unnest(COALESCE(_guest_names, '{}'::text[])) AS guest(name)
  WHERE NULLIF(regexp_replace(trim(guest.name), '[[:space:]]+', ' ', 'g'), '') IS NOT NULL;
  IF _guest_count > 10 THEN RAISE EXCEPTION 'Högst 10 gäster kan läggas till på ett besök'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(_guest_names, '{}'::text[])) AS guest(name)
    WHERE length(regexp_replace(trim(guest.name), '[[:space:]]+', ' ', 'g')) > 60
  ) THEN
    RAISE EXCEPTION 'Gästnamn får vara högst 60 tecken';
  END IF;

  SELECT name INTO _place_name FROM public.places WHERE id = _place_id;

  INSERT INTO public.visits (place_id, visited_on, meal_type, is_takeaway, created_by)
  VALUES (
    _place_id,
    _visited_on,
    _meal_type,
    CASE WHEN _scoreless THEN false ELSE COALESCE(_is_takeaway, false) END,
    _uid
  ) RETURNING id INTO _vid;

  INSERT INTO public.visit_group_links (visit_id, group_id, link_type, linked_by)
  VALUES (_vid, _group_id, 'original', _uid);

  INSERT INTO public.visit_participants (visit_id, user_id)
  SELECT _vid, participant.user_id
  FROM (
    SELECT DISTINCT unnest(COALESCE(_participant_ids, '{}'::uuid[])) AS user_id
  ) AS participant
  WHERE public.has_membership(_group_id, participant.user_id);
  GET DIAGNOSTICS _participant_count = ROW_COUNT;

  IF _participant_count = 0 OR NOT EXISTS (
    SELECT 1 FROM public.visit_participants WHERE visit_id = _vid AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Den som registrerar besöket måste vara deltagare';
  END IF;

  INSERT INTO public.visit_guests (visit_id, display_name, sort_order)
  SELECT
    _vid,
    normalized.display_name,
    row_number() OVER (ORDER BY normalized.input_order)::smallint
  FROM (
    SELECT
      guest.ordinality AS input_order,
      NULLIF(regexp_replace(trim(guest.name), '[[:space:]]+', ' ', 'g'), '') AS display_name
    FROM unnest(COALESCE(_guest_names, '{}'::text[])) WITH ORDINALITY AS guest(name, ordinality)
  ) AS normalized
  WHERE normalized.display_name IS NOT NULL;

  IF (_scoreless AND _normalized_comment IS NOT NULL) OR _has_review THEN
    INSERT INTO public.reviews (
      visit_id, user_id, overall, taste, value, service, atmosphere, review_model, comment
    ) VALUES (
      _vid,
      _uid,
      CASE WHEN _scoreless THEN NULL ELSE _overall END,
      CASE WHEN _scoreless THEN NULL ELSE _taste END,
      CASE WHEN _scoreless THEN NULL ELSE _value END,
      CASE WHEN _scoreless THEN NULL ELSE _service END,
      CASE WHEN _scoreless THEN NULL ELSE _atmosphere END,
      CASE WHEN _scoreless THEN NULL ELSE _review_model END,
      _normalized_comment
    ) RETURNING id INTO _rid;

    INSERT INTO public.review_group_visibility (
      review_id, group_id, rating_visible, comment_visible
    ) VALUES (
      _rid,
      _group_id,
      NOT _scoreless,
      true
    );
  END IF;

  DELETE FROM public.group_next_place
  WHERE group_id = _group_id AND place_id = _place_id;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, visit_id, payload)
  VALUES (
    _group_id,
    'visited',
    _uid,
    _place_id,
    _vid,
    jsonb_build_object(
      'text',
      COALESCE(_actor_name, 'Någon') || ' registrerade ett besök på ' ||
        COALESCE(_place_name, 'ett ställe')
    )
  );

  RETURN _vid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_own_review_for_visit_v2(
  _group_id uuid,
  _visit_id uuid,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _atmosphere smallint DEFAULT NULL,
  _comment text DEFAULT NULL,
  _review_occasions text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _review_id uuid;
  _existing_review_id uuid;
  _existing_model text;
  _existing_overall numeric;
  _place_id uuid;
  _place_name text;
  _author_name text;
  _recipient record;
  _meal_type text;
  _is_takeaway boolean;
  _scoreless boolean;
  _review_model text;
  _overall numeric(4,2);
  _normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_group_links
    WHERE visit_id = _visit_id AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_participants
    WHERE visit_id = _visit_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan lämna ett omdöme eller en kommentar';
  END IF;

  SELECT visit.place_id, visit.meal_type, visit.is_takeaway
  INTO _place_id, _meal_type, _is_takeaway
  FROM public.visits visit
  WHERE visit.id = _visit_id;
  IF _place_id IS NULL THEN RAISE EXCEPTION 'Besök saknas'; END IF;
  _scoreless := _meal_type = 'dryck';

  SELECT review.id, review.review_model, review.overall
  INTO _existing_review_id, _existing_model, _existing_overall
  FROM public.reviews review
  WHERE review.visit_id = _visit_id AND review.user_id = _uid;

  IF _scoreless THEN
    IF _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL OR _atmosphere IS NOT NULL THEN
      RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
    END IF;
    IF _normalized_comment IS NULL THEN RAISE EXCEPTION 'Skriv en kommentar först'; END IF;
  ELSE
    IF _existing_review_id IS NOT NULL AND _existing_model IS NULL AND _existing_overall IS NOT NULL THEN
      RAISE EXCEPTION 'Det befintliga omdömet använder den äldre betygsmodellen och ska redigeras i stället';
    END IF;
    _review_model := COALESCE(
      _existing_model,
      public.resolve_new_review_model_v1(
        _group_id,
        _place_id,
        COALESCE(_is_takeaway, false),
        _review_occasions
      )
    );
    _overall := public.derive_review_overall_v1(
      _review_model,
      _taste,
      _value,
      _service,
      _atmosphere
    );
  END IF;

  INSERT INTO public.reviews (
    visit_id, user_id, overall, taste, value, service, atmosphere, review_model, comment
  ) VALUES (
    _visit_id,
    _uid,
    CASE WHEN _scoreless THEN NULL ELSE _overall END,
    CASE WHEN _scoreless THEN NULL ELSE _taste END,
    CASE WHEN _scoreless THEN NULL ELSE _value END,
    CASE WHEN _scoreless THEN NULL ELSE _service END,
    CASE WHEN _scoreless THEN NULL ELSE _atmosphere END,
    CASE WHEN _scoreless THEN NULL ELSE _review_model END,
    _normalized_comment
  )
  ON CONFLICT (visit_id, user_id) DO UPDATE
  SET overall = EXCLUDED.overall,
      taste = EXCLUDED.taste,
      value = EXCLUDED.value,
      service = EXCLUDED.service,
      atmosphere = EXCLUDED.atmosphere,
      review_model = CASE
        WHEN reviews.review_model IS NULL THEN EXCLUDED.review_model
        ELSE reviews.review_model
      END,
      comment = EXCLUDED.comment,
      updated_at = now()
  RETURNING id INTO _review_id;

  INSERT INTO public.review_group_visibility (
    review_id, group_id, rating_visible, comment_visible
  ) VALUES (
    _review_id, _group_id, NOT _scoreless, true
  )
  ON CONFLICT (review_id, group_id) DO UPDATE
  SET rating_visible = CASE WHEN _scoreless THEN false ELSE true END,
      comment_visible = true,
      updated_at = now();

  INSERT INTO public.review_group_visibility (
    review_id, group_id, rating_visible, comment_visible
  )
  SELECT
    _review_id,
    link.group_id,
    NOT _scoreless,
    false
  FROM public.visit_group_links link
  JOIN public.memberships membership
    ON membership.group_id = link.group_id
   AND membership.user_id = _uid
   AND membership.status = 'active'
  WHERE link.visit_id = _visit_id
    AND link.group_id <> _group_id
  ON CONFLICT (review_id, group_id) DO UPDATE
  SET rating_visible = CASE WHEN _scoreless THEN false ELSE review_group_visibility.rating_visible END,
      updated_at = now();

  IF _existing_review_id IS NULL AND NOT _scoreless THEN
    SELECT place.name INTO _place_name
    FROM public.places place WHERE place.id = _place_id;
    SELECT profile.display_name INTO _author_name
    FROM public.profiles profile WHERE profile.id = _uid;

    FOR _recipient IN
      SELECT
        visibility.group_id,
        membership.user_id,
        group_row.name AS group_name
      FROM public.review_group_visibility visibility
      JOIN public.visit_group_links link
        ON link.visit_id = _visit_id AND link.group_id = visibility.group_id
      JOIN public.groups group_row
        ON group_row.id = visibility.group_id AND group_row.lifecycle_status = 'active'
      JOIN public.memberships membership
        ON membership.group_id = visibility.group_id AND membership.status = 'active'
      WHERE visibility.review_id = _review_id
        AND visibility.rating_visible = true
        AND membership.user_id <> _uid
    LOOP
      PERFORM public.queue_notification(
        _recipient.user_id,
        _recipient.group_id,
        'review_added',
        COALESCE(_recipient.group_name, 'Matrundan'),
        COALESCE(NULLIF(trim(_author_name), ''), 'Någon')
          || ' har lämnat sitt omdöme om '
          || COALESCE(NULLIF(trim(_place_name), ''), 'ett matställe') || '.',
        '/besok?group=' || _recipient.group_id::text
          || '&visit=' || _visit_id::text
          || '&review=' || _review_id::text,
        'review_added:' || _review_id::text
          || ':' || _recipient.group_id::text
          || ':' || _recipient.user_id::text
      );
    END LOOP;
  END IF;

  RETURN _review_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_own_review_v2(
  _group_id uuid,
  _review_id uuid,
  _overall numeric DEFAULT NULL,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _atmosphere smallint DEFAULT NULL,
  _comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _visit_id uuid;
  _author_id uuid;
  _previous_comment text;
  _meal_type text;
  _review_model text;
  _scoreless boolean;
  _derived_overall numeric(4,2);
  _normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  SELECT review.visit_id, review.user_id, review.comment, review.review_model, visit.meal_type
  INTO _visit_id, _author_id, _previous_comment, _review_model, _meal_type
  FROM public.reviews review
  JOIN public.visits visit ON visit.id = review.visit_id
  WHERE review.id = _review_id;

  IF _visit_id IS NULL THEN RAISE EXCEPTION 'Omdömet finns inte'; END IF;
  IF _author_id <> _uid THEN RAISE EXCEPTION 'Du kan bara redigera ditt eget omdöme'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_group_links
    WHERE visit_id = _visit_id AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_participants
    WHERE visit_id = _visit_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan ha ett omdöme eller en kommentar';
  END IF;

  _scoreless := _meal_type = 'dryck';
  IF _scoreless THEN
    IF _overall IS NOT NULL OR _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL OR _atmosphere IS NOT NULL THEN
      RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
    END IF;
    IF _normalized_comment IS NULL THEN RAISE EXCEPTION 'Kommentaren kan inte vara tom'; END IF;
  ELSIF _review_model IS NULL THEN
    IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
      RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5 för äldre omdömen';
    END IF;
    IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN RAISE EXCEPTION 'Smak måste vara 1–5'; END IF;
    IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN RAISE EXCEPTION 'Prisvärdhet måste vara 1–5'; END IF;
    IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN RAISE EXCEPTION 'Service måste vara 1–5'; END IF;
    IF _atmosphere IS NOT NULL THEN RAISE EXCEPTION 'Äldre omdömen kan inte få Atmosfär utan uttrycklig omvärdering'; END IF;
  ELSE
    IF _overall IS NOT NULL THEN
      RAISE EXCEPTION 'Helhetsbetyget härleds automatiskt för det här omdömet';
    END IF;
    _derived_overall := public.derive_review_overall_v1(
      _review_model,
      _taste,
      _value,
      _service,
      _atmosphere
    );
  END IF;

  UPDATE public.reviews
  SET overall = CASE
        WHEN _scoreless THEN NULL
        WHEN _review_model IS NULL THEN _overall
        ELSE _derived_overall
      END,
      taste = CASE WHEN _scoreless THEN NULL ELSE _taste END,
      value = CASE WHEN _scoreless THEN NULL ELSE _value END,
      service = CASE WHEN _scoreless THEN NULL ELSE _service END,
      atmosphere = CASE WHEN _scoreless THEN NULL ELSE _atmosphere END,
      comment = _normalized_comment,
      updated_at = now()
  WHERE id = _review_id AND user_id = _uid;

  IF _scoreless THEN
    UPDATE public.review_group_visibility
    SET rating_visible = false, updated_at = now()
    WHERE review_id = _review_id;
  END IF;

  IF NULLIF(trim(COALESCE(_previous_comment, '')), '') IS NULL
     AND _normalized_comment IS NOT NULL THEN
    UPDATE public.review_group_visibility
    SET comment_visible = true,
        updated_at = now()
    WHERE review_id = _review_id
      AND group_id = _group_id
      AND (rating_visible = true OR _scoreless)
      AND comment_visible = false;
  END IF;
END;
$function$;

-- v5m behåller v5l:s grupp- och deltagarscoping och enrichar bara reviewobjekt
-- som redan finns i den auktoriserade JSON-payloaden.
CREATE OR REPLACE FUNCTION public.get_group_app_state_v5m(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _visits jsonb;
BEGIN
  _result := public.get_group_app_state_v5l(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        visit_item.item,
        '{reviews}',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_set(
              jsonb_set(
                review_item.item,
                '{atmosphere}',
                COALESCE(to_jsonb(review_row.atmosphere), 'null'::jsonb),
                true
              ),
              '{reviewModel}',
              COALESCE(to_jsonb(review_row.review_model), 'null'::jsonb),
              true
            )
            ORDER BY review_item.ordinality
          )
          FROM jsonb_array_elements(COALESCE(visit_item.item->'reviews', '[]'::jsonb))
            WITH ORDINALITY AS review_item(item, ordinality)
          LEFT JOIN public.reviews review_row
            ON review_row.id = (review_item.item->>'id')::uuid
        ), '[]'::jsonb),
        true
      )
      ORDER BY visit_item.ordinality
    ),
    '[]'::jsonb
  ) INTO _visits
  FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
    WITH ORDINALITY AS visit_item(item, ordinality);

  RETURN jsonb_set(_result, '{visits}', _visits, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.derive_review_overall_v1(text, smallint, smallint, smallint, smallint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_new_review_model_v1(uuid, uuid, boolean, text[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_visit_with_review_v5(
  uuid, uuid, date, text, uuid[], boolean, smallint, smallint, smallint, smallint, text, text[], text[]
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_own_review_for_visit_v2(
  uuid, uuid, smallint, smallint, smallint, smallint, text, text[]
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_own_review_v2(
  uuid, uuid, numeric, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5m(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_visit_with_review_v5(
  uuid, uuid, date, text, uuid[], boolean, smallint, smallint, smallint, smallint, text, text[], text[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_own_review_for_visit_v2(
  uuid, uuid, smallint, smallint, smallint, smallint, text, text[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_review_v2(
  uuid, uuid, numeric, smallint, smallint, smallint, smallint, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5m(uuid)
  TO authenticated;

DO $assertions$
DECLARE
  _legacy_reviews bigint;
BEGIN
  SELECT count(*) INTO _legacy_reviews
  FROM public.reviews
  WHERE review_model IS NOT NULL;
  IF _legacy_reviews <> 0 THEN
    RAISE EXCEPTION 'Migrationen får inte backfilla review_model på befintliga reviews';
  END IF;
END;
$assertions$;

COMMIT;
