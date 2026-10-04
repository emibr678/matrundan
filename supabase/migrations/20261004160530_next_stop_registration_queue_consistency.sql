BEGIN;

-- Registrering från Nästa stopp och vanliga besök använder samma v5-bas.
-- Behåll API, validering, deltagande och omdömen; avlägsna enbart äldre
-- implicit köstädning, och hantera äldre förslag utan valt köhuvud.

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

  -- Bara explicit registrering från Nästa stopp får konsumera kön.
  -- close_next_stop_v2_on_original_visit hanterar det atomiskt.

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


CREATE OR REPLACE FUNCTION public.close_next_stop_v2_on_original_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _selected_place_id uuid;
  _selected_proposal_id uuid;
  _replacement_place_id uuid;
BEGIN
  IF NEW.link_type <> 'original' THEN RETURN NEW; END IF;
  IF current_setting('matrundan.complete_next_stop', true) IS DISTINCT FROM '1' THEN
    RETURN NEW;
  END IF;

  SELECT place_id INTO _place_id
  FROM public.visits
  WHERE id = NEW.visit_id;

  PERFORM public.next_stop_v2_lock(NEW.group_id);

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = NEW.group_id
  FOR UPDATE;

  -- Äldre vanliga registreringar kunde radera valet men lämna förslagen.
  -- Klienten visar då äldsta aktiva förslaget som nästa stopp. Återställ endast
  -- den effektiva köplatsen för jämförelsen, under samma grupplås. Ett annat
  -- ställe ska fortfarande avvisas, och vanliga besök rör aldrig kön.
  IF _selected_place_id IS NULL THEN
    SELECT p.place_id INTO _selected_place_id
    FROM public.next_stop_place_proposals p
    JOIN public.group_places gp
      ON gp.group_id = p.group_id
     AND gp.place_id = p.place_id
     AND gp.collection_status = 'active'
    WHERE p.group_id = NEW.group_id
    ORDER BY p.created_at, p.id
    LIMIT 1;
  END IF;

  IF _selected_place_id IS NULL OR _selected_place_id IS DISTINCT FROM _place_id THEN
    RAISE EXCEPTION 'Besöket matchar inte gruppens aktuella nästa stopp';
  END IF;

  SELECT id INTO _selected_proposal_id
  FROM public.next_stop_place_proposals
  WHERE group_id = NEW.group_id
    AND place_id = _selected_place_id
  FOR UPDATE;

  IF _selected_proposal_id IS NOT NULL THEN
    DELETE FROM public.next_stop_place_proposals
    WHERE id = _selected_proposal_id;
  END IF;

  SELECT p.place_id INTO _replacement_place_id
  FROM public.next_stop_place_proposals p
  JOIN public.group_places gp
    ON gp.group_id = p.group_id
   AND gp.place_id = p.place_id
   AND gp.collection_status = 'active'
  WHERE p.group_id = NEW.group_id
  ORDER BY p.created_at, p.id
  LIMIT 1;

  -- Den genomförda middagens dag och dagsvar hör inte till nästa köplats.
  PERFORM public.next_stop_v2_sync_legacy_date(
    NEW.group_id,
    NULL,
    NULL,
    NULL,
    _uid
  );

  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);
  IF _replacement_place_id IS NULL THEN
    DELETE FROM public.group_next_place
    WHERE group_id = NEW.group_id;
  ELSE
    INSERT INTO public.group_next_place (group_id, place_id, selected_by, selected_at)
    VALUES (NEW.group_id, _replacement_place_id, _uid, now())
    ON CONFLICT (group_id) DO UPDATE
    SET place_id = EXCLUDED.place_id,
        selected_by = EXCLUDED.selected_by,
        selected_at = EXCLUDED.selected_at;
  END IF;
  PERFORM set_config('matrundan.next_stop_v2_sync', '', true);

  IF _replacement_place_id IS NULL THEN
    DELETE FROM public.next_stop_plans
    WHERE group_id = NEW.group_id;
  ELSE
    UPDATE public.next_stop_plans
    SET planned_date = NULL,
        planned_time = NULL,
        revision = revision + 1,
        updated_by = _uid
    WHERE group_id = NEW.group_id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_next_stop_v2_on_original_visit()
  FROM PUBLIC, anon, authenticated;


COMMIT;
