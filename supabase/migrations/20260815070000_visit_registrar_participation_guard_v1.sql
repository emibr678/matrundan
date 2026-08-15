BEGIN;

-- Issue #169, korrigerat produktbeslut:
-- Den som registrerar ett nytt besök är själv faktisk deltagare och lämnar sitt
-- eget omdöme i samma flöde. Befintlig historik skrivs inte om.

CREATE OR REPLACE FUNCTION public.set_own_visit_participation_v1(
  _group_id uuid,
  _visit_id uuid,
  _participating boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _correction_status text;
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended('visit-participation:' || _visit_id::text || ':' || _uid::text, 0)
  );

  IF NOT _participating AND EXISTS (
    SELECT 1
    FROM public.visits
    WHERE id = _visit_id
      AND created_by = _uid
  ) THEN
    RAISE EXCEPTION 'Den som registrerade besöket måste vara deltagare';
  END IF;

  SELECT status
  INTO _correction_status
  FROM public.visit_participation_self_corrections
  WHERE visit_id = _visit_id
    AND user_id = _uid
  FOR UPDATE;

  IF _participating THEN
    IF _correction_status IS DISTINCT FROM 'declined' THEN
      RAISE EXCEPTION 'Deltagandet kan bara återställas efter en egen korrigering';
    END IF;

    INSERT INTO public.visit_participants (visit_id, user_id)
    VALUES (_visit_id, _uid)
    ON CONFLICT (visit_id, user_id) DO NOTHING;

    UPDATE public.visit_participation_self_corrections
    SET status = 'restored',
        updated_at = now()
    WHERE visit_id = _visit_id
      AND user_id = _uid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visit_participants
    WHERE visit_id = _visit_id
      AND user_id = _uid
  ) THEN
    INSERT INTO public.visit_participation_self_corrections (
      visit_id,
      user_id,
      status,
      updated_at
    ) VALUES (
      _visit_id,
      _uid,
      'declined',
      now()
    )
    ON CONFLICT (visit_id, user_id) DO UPDATE
    SET status = 'declined',
        updated_at = now();

    DELETE FROM public.visit_participants
    WHERE visit_id = _visit_id
      AND user_id = _uid;
    RETURN;
  END IF;

  IF _correction_status = 'declined' THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Du är inte registrerad som deltagare på besöket';
END;
$function$;

REVOKE ALL ON FUNCTION public.set_own_visit_participation_v1(uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_visit_participation_v1(uuid, uuid, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_visit_with_review_v3(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
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
  IF _meal_type NOT IN ('frukost','lunch','fika','middag','kväll') THEN
    RAISE EXCEPTION 'Ogiltigt tillfälle';
  END IF;

  IF NOT (_uid = ANY(COALESCE(_participant_ids, '{}'::uuid[]))) THEN
    RAISE EXCEPTION 'Den som registrerar besöket måste vara deltagare';
  END IF;

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

  INSERT INTO public.visits (place_id, visited_on, meal_type, created_by)
  VALUES (_place_id, _visited_on, _meal_type, _uid)
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

  INSERT INTO public.reviews (visit_id, user_id, overall, taste, value, service, comment)
  VALUES (
    _vid,
    _uid,
    _overall,
    _taste,
    _value,
    _service,
    NULLIF(trim(COALESCE(_comment, '')), '')
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
    true,
    true
  );

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

REVOKE ALL ON FUNCTION public.create_visit_with_review_v3(
  uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit_with_review_v3(
  uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text, text[]
) TO authenticated;

DO $assert$
DECLARE
  _create_def text := pg_get_functiondef(
    'public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])'::regprocedure
  );
  _participation_def text := pg_get_functiondef(
    'public.set_own_visit_participation_v1(uuid,uuid,boolean)'::regprocedure
  );
BEGIN
  IF position('Den som registrerar besöket måste vara deltagare' IN _create_def) = 0 THEN
    RAISE EXCEPTION 'create_visit_with_review_v3 saknar registrerargard';
  END IF;
  IF position('created_by = _uid' IN _participation_def) = 0 THEN
    RAISE EXCEPTION 'set_own_visit_participation_v1 saknar registrerargard';
  END IF;
END;
$assert$;

COMMIT;
