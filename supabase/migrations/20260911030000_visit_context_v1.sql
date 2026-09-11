BEGIN;

-- Issue #197 — renodlad besökskontext.
--
-- På plats är fortsatt implicit normalfall. Hämtmat lagras som en separat,
-- kanonisk besöksegenskap så samma verkliga besök behåller kontexten när det
-- delas mellan grupper. Befintlig historik får false och äldre `kväll` bevaras
-- som läsbart legacyvärde, medan nya v4-besök använder semantiska tillfällen.

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS is_takeaway boolean NOT NULL DEFAULT false;

ALTER TABLE public.visits
  DROP CONSTRAINT IF EXISTS visits_meal_type_check;
ALTER TABLE public.visits
  ADD CONSTRAINT visits_meal_type_check
  CHECK (meal_type IN ('frukost', 'lunch', 'fika', 'middag', 'dryck', 'kväll'));

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

  INSERT INTO public.visits (place_id, visited_on, meal_type, is_takeaway, created_by)
  VALUES (_place_id, _visited_on, _meal_type, COALESCE(_is_takeaway, false), _uid)
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
      AND v.is_takeaway = COALESCE(_is_takeaway, false)
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
BEGIN
  _duplicate := public.find_share_visit_duplicate_v2(_visit_id, _target_group_id);

  IF _duplicate IS NOT NULL AND NOT _allow_strong_duplicate THEN
    RAISE EXCEPTION 'Det finns redan ett liknande besök i målgruppen. Bekräfta om det var ett annat besök.';
  END IF;

  RETURN public.share_visit_to_group(
    _visit_id,
    _target_group_id,
    _share_own_comment
  );
END;
$function$;

-- v5l bygger strikt på den etablerade v5k-readen och lägger bara till den
-- kanoniska besökskontexten. All medlems-/gruppfiltrering ligger kvar i v5k.
CREATE OR REPLACE FUNCTION public.get_group_app_state_v5l(_group_id uuid)
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
  _result := public.get_group_app_state_v5k(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        visit_item.item,
        '{isTakeaway}',
        to_jsonb(COALESCE(visit_row.is_takeaway, false)),
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
REVOKE ALL ON FUNCTION public.find_registration_visit_duplicate_v2(uuid, uuid, date, text, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_share_visit_duplicate_v2(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_visit_to_group_v3(uuid, uuid, boolean, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5l(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_visit_with_review_v4(
  uuid, uuid, date, text, uuid[], boolean, smallint, smallint, smallint, smallint, text, text[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_registration_visit_duplicate_v2(uuid, uuid, date, text, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_share_visit_duplicate_v2(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_visit_to_group_v3(uuid, uuid, boolean, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5l(uuid)
  TO authenticated;

DO $assertions$
DECLARE
  _create_def text := pg_get_functiondef(
    'public.create_visit_with_review_v4(uuid,uuid,date,text,uuid[],boolean,smallint,smallint,smallint,smallint,text,text[])'::regprocedure
  );
  _registration_duplicate_def text := pg_get_functiondef(
    'public.find_registration_visit_duplicate_v2(uuid,uuid,date,text,boolean)'::regprocedure
  );
  _share_duplicate_def text := pg_get_functiondef(
    'public.find_share_visit_duplicate_v2(uuid,uuid)'::regprocedure
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

  IF position('''dryck''' IN _create_def) = 0 OR position('''kväll''' IN _create_def) > 0 THEN
    RAISE EXCEPTION 'create_visit_with_review_v4 har fel tillfällesmodell';
  END IF;
  IF position('is_takeaway' IN _create_def) = 0 THEN
    RAISE EXCEPTION 'create_visit_with_review_v4 lagrar inte Hämtmat';
  END IF;
  IF position('v.is_takeaway = COALESCE(_is_takeaway, false)' IN _registration_duplicate_def) = 0 THEN
    RAISE EXCEPTION 'registreringsdubbletter skiljer inte På plats från Hämtmat';
  END IF;
  IF position('candidate.is_takeaway = COALESCE(_is_takeaway, false)' IN _share_duplicate_def) = 0 THEN
    RAISE EXCEPTION 'delningsdubbletter skiljer inte På plats från Hämtmat';
  END IF;
  IF position('public.get_group_app_state_v5k(_group_id)' IN _read_def) = 0
     OR position('''{isTakeaway}''' IN _read_def) = 0 THEN
    RAISE EXCEPTION 'v5l bygger inte additivt på v5k med isTakeaway';
  END IF;
END;
$assertions$;

NOTIFY pgrst, 'reload schema';

COMMIT;
