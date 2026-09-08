BEGIN;

-- Issue #213: konservativt dubblettskydd för kanoniska besök.
-- Samma plats, datum och tillfälle är bara en stark kandidat, aldrig en unik
-- databasnyckel: användaren måste alltid kunna ange att det var ett separat
-- verkligt besök.

CREATE OR REPLACE FUNCTION public.find_registration_visit_duplicate_v1(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text
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
  IF _meal_type NOT IN ('frukost', 'lunch', 'fika', 'middag', 'kväll') THEN
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

CREATE OR REPLACE FUNCTION public.find_share_visit_duplicate_v1(
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

  SELECT v.place_id, v.visited_on, v.meal_type
  INTO _place_id, _visited_on, _meal_type
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

CREATE OR REPLACE FUNCTION public.share_visit_to_group_v2(
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
  _duplicate := public.find_share_visit_duplicate_v1(_visit_id, _target_group_id);

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

REVOKE ALL ON FUNCTION public.find_registration_visit_duplicate_v1(uuid, uuid, date, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_share_visit_duplicate_v1(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_visit_to_group_v2(uuid, uuid, boolean, boolean)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.find_registration_visit_duplicate_v1(uuid, uuid, date, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_share_visit_duplicate_v1(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_visit_to_group_v2(uuid, uuid, boolean, boolean)
  TO authenticated;

COMMIT;
