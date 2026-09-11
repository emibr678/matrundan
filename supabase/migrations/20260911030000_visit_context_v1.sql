BEGIN;

-- Issue #197 — renodlad besökskontext.
--
-- På plats är fortsatt implicit normalfall. Hämtmat lagras som en separat,
-- kanonisk besöksegenskap så samma verkliga besök behåller kontexten när det
-- delas mellan grupper. Befintlig historik får false och äldre `kväll` bevaras
-- som läsbart legacyvärde, medan nya v4-besök använder semantiska tillfällen.
--
-- `Något att dricka` är ett fullvärdigt besök men uttryckligen scorelöst. En
-- kommentar kan därför finnas i reviews utan numeriska betyg. rating_visible
-- hålls false för dessa rader och v5l exponerar den gruppsynliga kommentaren
-- utan att låta den påverka matställets score.

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS is_takeaway boolean NOT NULL DEFAULT false;

ALTER TABLE public.visits
  DROP CONSTRAINT IF EXISTS visits_meal_type_check;
ALTER TABLE public.visits
  ADD CONSTRAINT visits_meal_type_check
  CHECK (meal_type IN ('frukost', 'lunch', 'fika', 'middag', 'dryck', 'kväll'));

ALTER TABLE public.reviews
  ALTER COLUMN overall DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_visit_with_review_v4(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
  _is_takeaway boolean DEFAULT false,
  _overall smallint DEFAULT NULL,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _comment text DEFAULT NULL,
  _guest_names text[] DEFAULT '{}'::text[]
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places
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

  IF _scoreless THEN
    IF _overall IS NOT NULL OR _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL THEN
      RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
    END IF;
  ELSE
    IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
      RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5';
    END IF;
    IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN
      RAISE EXCEPTION 'Smakbetyg måste vara 1–5';
    END IF;
    IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN
      RAISE EXCEPTION 'Prisvärdhet måste vara 1–5';
    END IF;
    IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN
      RAISE EXCEPTION 'Servicebetyg måste vara 1–5';
    END IF;
  END IF;

  SELECT count(*)
  INTO _guest_count
  FROM unnest(COALESCE(_guest_names, '{}'::text[])) AS guest(name)
  WHERE NULLIF(regexp_replace(trim(guest.name), '[[:space:]]+', ' ', 'g'), '') IS NOT NULL;

  IF _guest_count > 10 THEN
    RAISE EXCEPTION 'Högst 10 gäster kan läggas till på ett besök';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_guest_names, '{}'::text[])) AS guest(name)
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
  )
  RETURNING id INTO _vid;

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
    SELECT 1
    FROM public.visit_participants
    WHERE visit_id = _vid
      AND user_id = _uid
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

  IF NOT _scoreless OR _normalized_comment IS NOT NULL THEN
    INSERT INTO public.reviews (visit_id, user_id, overall, taste, value, service, comment)
    VALUES (
      _vid,
      _uid,
      CASE WHEN _scoreless THEN NULL ELSE _overall END,
      CASE WHEN _scoreless THEN NULL ELSE _taste END,
      CASE WHEN _scoreless THEN NULL ELSE _value END,
      CASE WHEN _scoreless THEN NULL ELSE _service END,
      _normalized_comment
    )
    RETURNING id INTO _rid;

    INSERT INTO public.review_group_visibility (
      review_id,
      group_id,
      rating_visible,
      comment_visible
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

CREATE OR REPLACE FUNCTION public.save_own_review_for_visit_v1(
  _group_id uuid,
  _visit_id uuid,
  _overall smallint,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _comment text DEFAULT NULL
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
  _place_name text;
  _author_name text;
  _recipient record;
  _meal_type text;
  _scoreless boolean;
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
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id
      AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_participants
    WHERE visit_id = _visit_id
      AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan lämna ett omdöme eller en kommentar';
  END IF;

  SELECT meal_type
  INTO _meal_type
  FROM public.visits
  WHERE id = _visit_id;

  IF _meal_type IS NULL THEN RAISE EXCEPTION 'Besök saknas'; END IF;
  _scoreless := _meal_type = 'dryck';

  IF _scoreless THEN
    IF _overall IS NOT NULL OR _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL THEN
      RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
    END IF;
    IF _normalized_comment IS NULL THEN
      RAISE EXCEPTION 'Skriv en kommentar först';
    END IF;
  ELSE
    IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
      RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5';
    END IF;
    IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN
      RAISE EXCEPTION 'Smakbetyg måste vara 1–5';
    END IF;
    IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN
      RAISE EXCEPTION 'Prisvärdhet måste vara 1–5';
    END IF;
    IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN
      RAISE EXCEPTION 'Servicebetyg måste vara 1–5';
    END IF;
  END IF;

  SELECT id
  INTO _existing_review_id
  FROM public.reviews
  WHERE visit_id = _visit_id
    AND user_id = _uid;

  INSERT INTO public.reviews (
    visit_id,
    user_id,
    overall,
    taste,
    value,
    service,
    comment
  ) VALUES (
    _visit_id,
    _uid,
    CASE WHEN _scoreless THEN NULL ELSE _overall END,
    CASE WHEN _scoreless THEN NULL ELSE _taste END,
    CASE WHEN _scoreless THEN NULL ELSE _value END,
    CASE WHEN _scoreless THEN NULL ELSE _service END,
    _normalized_comment
  )
  ON CONFLICT (visit_id, user_id) DO UPDATE
  SET overall = EXCLUDED.overall,
      taste = EXCLUDED.taste,
      value = EXCLUDED.value,
      service = EXCLUDED.service,
      comment = EXCLUDED.comment,
      updated_at = now()
  RETURNING id INTO _review_id;

  INSERT INTO public.review_group_visibility (
    review_id,
    group_id,
    rating_visible,
    comment_visible
  ) VALUES (
    _review_id,
    _group_id,
    NOT _scoreless,
    true
  )
  ON CONFLICT (review_id, group_id) DO UPDATE
  SET rating_visible = CASE WHEN _scoreless THEN false ELSE review_group_visibility.rating_visible END,
      comment_visible = true,
      updated_at = now();

  INSERT INTO public.review_group_visibility (
    review_id,
    group_id,
    rating_visible,
    comment_visible
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

  -- Bara scoreade förstagångsomdömen köas som review_added. Scorelösa
  -- dryckeskommentarer är minnesnoteringar och ska inte presenteras som ett
  -- nytt matomdöme i andra medlemmars notiser.
  IF _existing_review_id IS NULL AND NOT _scoreless THEN
    SELECT place.name
    INTO _place_name
    FROM public.visits visit
    JOIN public.places place ON place.id = visit.place_id
    WHERE visit.id = _visit_id;

    SELECT profile.display_name
    INTO _author_name
    FROM public.profiles profile
    WHERE profile.id = _uid;

    FOR _recipient IN
      SELECT
        visibility.group_id,
        membership.user_id,
        group_row.name AS group_name
      FROM public.review_group_visibility visibility
      JOIN public.visit_group_links link
        ON link.visit_id = _visit_id
       AND link.group_id = visibility.group_id
      JOIN public.groups group_row
        ON group_row.id = visibility.group_id
       AND group_row.lifecycle_status = 'active'
      JOIN public.memberships membership
        ON membership.group_id = visibility.group_id
       AND membership.status = 'active'
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
          || COALESCE(NULLIF(trim(_place_name), ''), 'ett matställe')
          || '.',
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

CREATE OR REPLACE FUNCTION public.update_own_review(
  _group_id uuid,
  _review_id uuid,
  _overall smallint,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
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
  _scoreless boolean;
  _normalized_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  SELECT review.visit_id, review.user_id, review.comment, visit.meal_type
  INTO _visit_id, _author_id, _previous_comment, _meal_type
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
    IF _overall IS NOT NULL OR _taste IS NOT NULL OR _value IS NOT NULL OR _service IS NOT NULL THEN
      RAISE EXCEPTION 'Något att dricka ska inte ha stjärnbetyg';
    END IF;
    IF _normalized_comment IS NULL THEN
      RAISE EXCEPTION 'Kommentaren kan inte vara tom';
    END IF;
  ELSE
    IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
      RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5';
    END IF;
    IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN RAISE EXCEPTION 'Smakbetyg måste vara 1–5'; END IF;
    IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN RAISE EXCEPTION 'Prisvärdhet måste vara 1–5'; END IF;
    IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN RAISE EXCEPTION 'Service måste vara 1–5'; END IF;
  END IF;

  UPDATE public.reviews
  SET overall = CASE WHEN _scoreless THEN NULL ELSE _overall END,
      taste = CASE WHEN _scoreless THEN NULL ELSE _taste END,
      value = CASE WHEN _scoreless THEN NULL ELSE _value END,
      service = CASE WHEN _scoreless THEN NULL ELSE _service END,
      comment = _normalized_comment,
      updated_at = now()
  WHERE id = _review_id AND user_id = _uid;

  IF _scoreless THEN
    UPDATE public.review_group_visibility
    SET rating_visible = false,
        updated_at = now()
    WHERE review_id = _review_id;
  END IF;

  -- Behåll #244-semantiken: bara övergången från ingen kommentar till första
  -- kommentaren öppnas automatiskt i den grupp där redigeringen sker. För ett
  -- scorelöst dryckesbesök får detta ske trots att rating_visible är false.
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

CREATE OR REPLACE FUNCTION public.find_registration_visit_duplicate_v2(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _is_takeaway boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places gp
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppens aktiva lista';
  END IF;
  IF _meal_type NOT IN ('frukost', 'lunch', 'fika', 'middag', 'dryck') THEN
    RAISE EXCEPTION 'Ogiltigt tillfälle';
  END IF;

  SELECT jsonb_build_object(
    'visitId', candidate.id,
    'visitedOn', candidate.visited_on,
    'mealType', candidate.meal_type,
    'alreadyVisibleInTargetGroup', candidate.already_visible_in_target_group
  )
  INTO _result
  FROM (
    SELECT
      v.id,
      v.visited_on,
      v.meal_type,
      EXISTS (
        SELECT 1
        FROM public.visit_group_links target_link
        WHERE target_link.visit_id = v.id
          AND target_link.group_id = _group_id
      ) AS already_visible_in_target_group
    FROM public.visits v
    WHERE v.place_id = _place_id
      AND v.visited_on = _visited_on
      AND v.meal_type = _meal_type
      AND v.is_takeaway = CASE WHEN _meal_type = 'dryck' THEN false ELSE COALESCE(_is_takeaway, false) END
      AND EXISTS (
        SELECT 1
        FROM public.visit_participants vp
        WHERE vp.visit_id = v.id
          AND vp.user_id = _uid
      )
      AND EXISTS (
        SELECT 1
        FROM public.visit_group_links access_link
        JOIN public.groups access_group
          ON access_group.id = access_link.group_id
         AND access_group.lifecycle_status = 'active'
        JOIN public.memberships access_membership
          ON access_membership.group_id = access_link.group_id
         AND access_membership.user_id = _uid
         AND access_membership.status = 'active'
        WHERE access_link.visit_id = v.id
      )
    ORDER BY already_visible_in_target_group DESC, v.created_at ASC, v.id ASC
    LIMIT 1
  ) AS candidate;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_share_visit_duplicate_v2(
  _visit_id uuid,
  _target_group_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _visited_on date;
  _meal_type text;
  _is_takeaway boolean;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.group_is_active(_target_group_id) THEN
    RAISE EXCEPTION 'Målgruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_target_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i målgruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_participants vp
    WHERE vp.visit_id = _visit_id
      AND vp.user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Du deltog inte i besöket';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links source_access
    JOIN public.groups source_group
      ON source_group.id = source_access.group_id
     AND source_group.lifecycle_status = 'active'
    JOIN public.memberships source_membership
      ON source_membership.group_id = source_access.group_id
     AND source_membership.user_id = _uid
     AND source_membership.status = 'active'
    WHERE source_access.visit_id = _visit_id
  ) THEN
    RAISE EXCEPTION 'Du har inte längre åtkomst till besöket';
  END IF;

  SELECT v.place_id, v.visited_on, v.meal_type, v.is_takeaway
  INTO _place_id, _visited_on, _meal_type, _is_takeaway
  FROM public.visits v
  WHERE v.id = _visit_id;

  IF _place_id IS NULL THEN
    RAISE EXCEPTION 'Besök saknas';
  END IF;

  SELECT jsonb_build_object(
    'visitId', candidate.id,
    'visitedOn', candidate.visited_on,
    'mealType', candidate.meal_type,
    'alreadyVisibleInTargetGroup', true
  )
  INTO _result
  FROM public.visits candidate
  WHERE candidate.id <> _visit_id
    AND candidate.place_id = _place_id
    AND candidate.visited_on = _visited_on
    AND candidate.meal_type = _meal_type
    AND candidate.is_takeaway = COALESCE(_is_takeaway, false)
    AND EXISTS (
      SELECT 1
      FROM public.visit_participants candidate_participant
      WHERE candidate_participant.visit_id = candidate.id
        AND candidate_participant.user_id = _uid
    )
    AND EXISTS (
      SELECT 1
      FROM public.visit_group_links target_link
      WHERE target_link.visit_id = candidate.id
        AND target_link.group_id = _target_group_id
    )
  ORDER BY candidate.created_at ASC, candidate.id ASC
  LIMIT 1;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.share_visit_to_group_v3(
  _visit_id uuid,
  _target_group_id uuid,
  _share_own_comment boolean DEFAULT false,
  _allow_strong_duplicate boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _duplicate jsonb;
  _result uuid;
  _scoreless boolean;
BEGIN
  _duplicate := public.find_share_visit_duplicate_v2(_visit_id, _target_group_id);

  IF _duplicate IS NOT NULL AND NOT _allow_strong_duplicate THEN
    RAISE EXCEPTION 'Det finns redan ett liknande besök i målgruppen. Bekräfta om det var ett annat besök.';
  END IF;

  SELECT meal_type = 'dryck'
  INTO _scoreless
  FROM public.visits
  WHERE id = _visit_id;

  _result := public.share_visit_to_group(
    _visit_id,
    _target_group_id,
    _share_own_comment
  );

  IF COALESCE(_scoreless, false) THEN
    UPDATE public.review_group_visibility visibility
    SET rating_visible = false,
        updated_at = now()
    FROM public.reviews review
    WHERE visibility.review_id = review.id
      AND visibility.group_id = _target_group_id
      AND review.visit_id = _visit_id;
  END IF;

  RETURN _result;
END;
$function$;

-- Scorelösa dryckeskommentarer får samma privata gruppreaktioner som andra
-- synliga kommentarer, utan att rating_visible behöver slås på.
CREATE OR REPLACE FUNCTION public.get_visit_review_reactions_v1(
  _group_id uuid,
  _visit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id
      AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;

  WITH eligible_reviews AS (
    SELECT review.id AS review_id
    FROM public.reviews review
    JOIN public.visits visit ON visit.id = review.visit_id
    JOIN public.visit_participants participant
      ON participant.visit_id = review.visit_id
     AND participant.user_id = review.user_id
    JOIN public.review_group_visibility visibility
      ON visibility.review_id = review.id
     AND visibility.group_id = _group_id
    WHERE review.visit_id = _visit_id
      AND visibility.comment_visible = true
      AND (visibility.rating_visible = true OR visit.meal_type = 'dryck')
      AND NULLIF(trim(COALESCE(review.comment, '')), '') IS NOT NULL
  ),
  reaction_state AS (
    SELECT
      eligible.review_id,
      (
        SELECT own_reaction.reaction
        FROM public.review_group_reactions own_reaction
        WHERE own_reaction.review_id = eligible.review_id
          AND own_reaction.group_id = _group_id
          AND own_reaction.user_id = _uid
        LIMIT 1
      ) AS my_reaction,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'reaction', bucket.reaction,
            'count', bucket.reactor_count,
            'reactors', bucket.reactors
          )
          ORDER BY bucket.reaction_order
        )
        FROM (
          SELECT
            reaction_row.reaction,
            count(*)::int AS reactor_count,
            jsonb_agg(
              jsonb_build_object(
                'userId', reaction_row.user_id,
                'name', COALESCE(NULLIF(trim(profile.display_name), ''), 'Tidigare medlem'),
                'avatar', profile.avatar_emoji,
                'avatarImage', profile.avatar_url,
                'status', CASE
                  WHEN membership.status = 'active' THEN 'active'
                  ELSE 'left'
                END
              )
              ORDER BY
                CASE WHEN reaction_row.user_id = _uid THEN 0 ELSE 1 END,
                COALESCE(NULLIF(trim(profile.display_name), ''), 'Tidigare medlem'),
                reaction_row.user_id
            ) AS reactors,
            min(CASE reaction_row.reaction
              WHEN 'heart' THEN 1
              WHEN 'drool' THEN 2
              WHEN 'celebrate' THEN 3
              WHEN 'laugh' THEN 4
              ELSE 99
            END) AS reaction_order
          FROM public.review_group_reactions reaction_row
          JOIN public.memberships membership
            ON membership.group_id = _group_id
           AND membership.user_id = reaction_row.user_id
           AND membership.status IN ('active', 'left')
          LEFT JOIN public.profiles profile ON profile.id = reaction_row.user_id
          WHERE reaction_row.review_id = eligible.review_id
            AND reaction_row.group_id = _group_id
          GROUP BY reaction_row.reaction
        ) AS bucket
      ), '[]'::jsonb) AS reactions
    FROM eligible_reviews eligible
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'reviewId', state.review_id,
      'myReaction', state.my_reaction,
      'reactions', state.reactions
    )
    ORDER BY state.review_id
  ), '[]'::jsonb)
  INTO _result
  FROM reaction_state state;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_own_review_reaction_v1(
  _group_id uuid,
  _visit_id uuid,
  _review_id uuid,
  _reaction text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id
      AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.reviews review
    JOIN public.visits visit ON visit.id = review.visit_id
    JOIN public.visit_participants participant
      ON participant.visit_id = review.visit_id
     AND participant.user_id = review.user_id
    JOIN public.review_group_visibility visibility
      ON visibility.review_id = review.id
     AND visibility.group_id = _group_id
    WHERE review.id = _review_id
      AND review.visit_id = _visit_id
      AND visibility.comment_visible = true
      AND (visibility.rating_visible = true OR visit.meal_type = 'dryck')
      AND NULLIF(trim(COALESCE(review.comment, '')), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Omdömet kan inte reageras på i den här gruppen';
  END IF;

  IF _reaction IS NULL THEN
    DELETE FROM public.review_group_reactions
    WHERE review_id = _review_id
      AND group_id = _group_id
      AND user_id = _uid;
    RETURN;
  END IF;

  IF _reaction NOT IN ('heart', 'drool', 'celebrate', 'laugh') THEN
    RAISE EXCEPTION 'Ogiltig reaktion';
  END IF;

  INSERT INTO public.review_group_reactions (
    review_id,
    group_id,
    user_id,
    reaction,
    created_at,
    updated_at
  ) VALUES (
    _review_id,
    _group_id,
    _uid,
    _reaction,
    now(),
    now()
  )
  ON CONFLICT (review_id, group_id, user_id) DO UPDATE
  SET reaction = EXCLUDED.reaction,
      updated_at = now();
END;
$function$;

-- v5l bygger strikt på den etablerade v5k-readen och lägger till den kanoniska
-- besökskontexten. För dryckesbesök ersätts review-arrayen med gruppsynliga
-- scorelösa kommentarer, men endast för visit-id:n som v5k redan auktoriserat.
CREATE OR REPLACE FUNCTION public.get_group_app_state_v5l(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
  _visits jsonb;
BEGIN
  _result := public.get_group_app_state_v5k(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        jsonb_set(
          visit_item.item,
          '{isTakeaway}',
          to_jsonb(COALESCE(visit_row.is_takeaway, false)),
          true
        ),
        '{reviews}',
        CASE
          WHEN visit_row.meal_type = 'dryck' THEN COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', review.id,
                'userId', review.user_id,
                'overall', NULL,
                'taste', NULL,
                'value', NULL,
                'service', NULL,
                'comment', CASE
                  WHEN visibility.comment_visible OR review.user_id = _uid THEN review.comment
                  ELSE NULL
                END,
                'ratingVisible', false,
                'commentVisible', visibility.comment_visible
              )
              ORDER BY review.created_at, review.id
            )
            FROM public.reviews review
            JOIN public.visit_participants participant
              ON participant.visit_id = review.visit_id
             AND participant.user_id = review.user_id
            JOIN public.review_group_visibility visibility
              ON visibility.review_id = review.id
             AND visibility.group_id = _group_id
            WHERE review.visit_id = visit_row.id
              AND (visibility.comment_visible OR review.user_id = _uid)
          ), '[]'::jsonb)
          ELSE COALESCE(visit_item.item->'reviews', '[]'::jsonb)
        END,
        true
      )
      ORDER BY visit_item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _visits
  FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
    WITH ORDINALITY AS visit_item(item, ordinality)
  JOIN public.visits visit_row
    ON visit_row.id = (visit_item.item->>'id')::uuid;

  RETURN jsonb_set(_result, '{visits}', _visits, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_visit_with_review_v4(
  uuid, uuid, date, text, uuid[], boolean, smallint, smallint, smallint, smallint, text, text[]
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_own_review_for_visit_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_own_review(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_registration_visit_duplicate_v2(uuid, uuid, date, text, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_share_visit_duplicate_v2(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_visit_to_group_v3(uuid, uuid, boolean, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_visit_review_reactions_v1(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_own_review_reaction_v1(uuid, uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5l(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_visit_with_review_v4(
  uuid, uuid, date, text, uuid[], boolean, smallint, smallint, smallint, smallint, text, text[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_own_review_for_visit_v1(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_review(
  uuid, uuid, smallint, smallint, smallint, smallint, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_registration_visit_duplicate_v2(uuid, uuid, date, text, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_share_visit_duplicate_v2(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_visit_to_group_v3(uuid, uuid, boolean, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_review_reactions_v1(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_own_review_reaction_v1(uuid, uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5l(uuid)
  TO authenticated;

DO $assertions$
DECLARE
  _create_def text := pg_get_functiondef(
    'public.create_visit_with_review_v4(uuid,uuid,date,text,uuid[],boolean,smallint,smallint,smallint,smallint,text,text[])'::regprocedure
  );
  _save_review_def text := pg_get_functiondef(
    'public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'::regprocedure
  );
  _update_review_def text := pg_get_functiondef(
    'public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)'::regprocedure
  );
  _registration_duplicate_def text := pg_get_functiondef(
    'public.find_registration_visit_duplicate_v2(uuid,uuid,date,text,boolean)'::regprocedure
  );
  _share_duplicate_def text := pg_get_functiondef(
    'public.find_share_visit_duplicate_v2(uuid,uuid)'::regprocedure
  );
  _share_def text := pg_get_functiondef(
    'public.share_visit_to_group_v3(uuid,uuid,boolean,boolean)'::regprocedure
  );
  _reaction_read_def text := pg_get_functiondef(
    'public.get_visit_review_reactions_v1(uuid,uuid)'::regprocedure
  );
  _reaction_write_def text := pg_get_functiondef(
    'public.set_own_review_reaction_v1(uuid,uuid,uuid,text)'::regprocedure
  );
  _read_def text := pg_get_functiondef(
    'public.get_group_app_state_v5l(uuid)'::regprocedure
  );
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'visits'
      AND column_name = 'is_takeaway'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'visits.is_takeaway saknas eller är nullable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'overall'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'reviews.overall måste tillåta scorelösa kommentarer';
  END IF;

  IF position('''dryck''' IN _create_def) = 0 OR position('''kväll''' IN _create_def) > 0 THEN
    RAISE EXCEPTION 'create_visit_with_review_v4 har fel tillfällesmodell';
  END IF;
  IF position('Något att dricka ska inte ha stjärnbetyg' IN _create_def) = 0
     OR position('NOT _scoreless' IN _create_def) = 0 THEN
    RAISE EXCEPTION 'create_visit_with_review_v4 upprätthåller inte scorelösa dryckesbesök';
  END IF;
  IF position('CASE WHEN _scoreless THEN false ELSE COALESCE(_is_takeaway, false) END' IN _create_def) = 0 THEN
    RAISE EXCEPTION 'dryckesbesök måste neutralisera Hämtmat';
  END IF;
  IF position('Något att dricka ska inte ha stjärnbetyg' IN _save_review_def) = 0
     OR position('NOT _scoreless' IN _save_review_def) = 0 THEN
    RAISE EXCEPTION 'senare deltagare kan skapa score på dryckesbesök';
  END IF;
  IF position('rating_visible = false' IN _update_review_def) = 0 THEN
    RAISE EXCEPTION 'redigering kan återaktivera score på dryckesbesök';
  END IF;
  IF position('v.is_takeaway = CASE WHEN _meal_type = ''dryck'' THEN false ELSE COALESCE(_is_takeaway, false) END' IN _registration_duplicate_def) = 0 THEN
    RAISE EXCEPTION 'registreringsdubbletter har fel Hämtmat-semantik';
  END IF;
  IF position('candidate.is_takeaway = COALESCE(_is_takeaway, false)' IN _share_duplicate_def) = 0 THEN
    RAISE EXCEPTION 'delningsdubbletter skiljer inte På plats från Hämtmat';
  END IF;
  IF position('SET rating_visible = false' IN _share_def) = 0 THEN
    RAISE EXCEPTION 'delning kan exponera score på scorelöst dryckesbesök';
  END IF;
  IF position('visit.meal_type = ''dryck''' IN _reaction_read_def) = 0
     OR position('visit.meal_type = ''dryck''' IN _reaction_write_def) = 0 THEN
    RAISE EXCEPTION 'scorelösa dryckeskommentarer är inte reagerbara';
  END IF;
  IF position('public.get_group_app_state_v5k(_group_id)' IN _read_def) = 0
     OR position('''{isTakeaway}''' IN _read_def) = 0
     OR position('visit_row.meal_type = ''dryck''' IN _read_def) = 0
     OR position('''ratingVisible'', false' IN _read_def) = 0 THEN
    RAISE EXCEPTION 'v5l bygger inte additivt på v5k med korrekt dryckes-/Hämtmat-semantik';
  END IF;
END;
$assertions$;

NOTIFY pgrst, 'reload schema';

COMMIT;
