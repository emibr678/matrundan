-- Utöka list_visit_share_targets med placeExistsInGroup för konsistens
CREATE OR REPLACE FUNCTION public.list_visit_share_targets(_visit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _uid uuid := auth.uid(); _result jsonb; _place_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.visit_participants
                 WHERE visit_id = _visit_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Not a participant of this visit';
  END IF;

  SELECT v.place_id INTO _place_id FROM public.visits v WHERE v.id = _visit_id;

  WITH my_groups AS (
    SELECT g.id, g.name, g.emoji, g.shared_visits_count_for_progression
    FROM public.memberships m
    JOIN public.groups g ON g.id = m.group_id
    WHERE m.user_id = _uid AND m.status = 'active'
  ),
  vp AS ( SELECT user_id FROM public.visit_participants WHERE visit_id = _visit_id ),
  own_comment AS (
    SELECT (comment IS NOT NULL AND length(trim(comment)) > 0) AS has_comment
    FROM public.reviews WHERE visit_id = _visit_id AND user_id = _uid
    LIMIT 1
  ),
  rows AS (
    SELECT
      mg.id AS group_id, mg.name AS group_name, mg.emoji AS group_emoji,
      mg.shared_visits_count_for_progression,
      EXISTS(SELECT 1 FROM public.visit_group_links vgl
             WHERE vgl.visit_id = _visit_id AND vgl.group_id = mg.id) AS already_linked,
      EXISTS(SELECT 1 FROM public.group_places gp
             WHERE gp.group_id = mg.id AND gp.place_id = _place_id) AS place_exists_in_group,
      (SELECT count(*)::int FROM vp
        WHERE NOT EXISTS (SELECT 1 FROM public.memberships mm
                          WHERE mm.group_id = mg.id AND mm.user_id = vp.user_id)
      ) AS external_participant_count,
      (SELECT jsonb_agg(jsonb_build_object(
         'id', p.id,
         'name', COALESCE(NULLIF(trim(p.display_name),''),'Medlem'),
         'avatar', p.avatar_emoji,
         'avatarImage', p.avatar_url,
         'status', mm.status
       ))
       FROM vp
       JOIN public.memberships mm
         ON mm.group_id = mg.id AND mm.user_id = vp.user_id
       LEFT JOIN public.profiles p ON p.id = vp.user_id
      ) AS visible_participants,
      (SELECT count(*)::int
         FROM public.reviews r
         JOIN public.memberships mm
           ON mm.group_id = mg.id AND mm.user_id = r.user_id
        WHERE r.visit_id = _visit_id
      ) AS relevant_review_count,
      COALESCE((SELECT has_comment FROM own_comment), false) AS own_has_comment
    FROM my_groups mg
  )
  SELECT jsonb_agg(jsonb_build_object(
    'groupId', group_id,
    'name', group_name,
    'emoji', COALESCE(group_emoji,'🍽️'),
    'alreadyLinked', already_linked,
    'placeExistsInGroup', place_exists_in_group,
    'externalParticipantCount', external_participant_count,
    'visibleParticipants', COALESCE(visible_participants, '[]'::jsonb),
    'relevantReviewCount', relevant_review_count,
    'ownHasComment', own_has_comment,
    'sharedVisitsCountForProgression', shared_visits_count_for_progression
  ) ORDER BY already_linked ASC, group_name ASC) INTO _result FROM rows;

  RETURN COALESCE(_result, '[]'::jsonb);
END $function$;

-- Ny RPC för VisitDialog: lista aktiva grupper för en plats, utan att besök behövs
CREATE OR REPLACE FUNCTION public.list_place_share_targets_v4b(_place_id uuid)
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

  WITH my_groups AS (
    SELECT g.id, g.name, g.emoji, g.shared_visits_count_for_progression
    FROM public.memberships m
    JOIN public.groups g ON g.id = m.group_id
    WHERE m.user_id = _uid AND m.status = 'active' AND g.lifecycle_status = 'active'
  )
  SELECT jsonb_agg(jsonb_build_object(
    'groupId', mg.id,
    'name', mg.name,
    'emoji', COALESCE(mg.emoji,'🍽️'),
    'placeExistsInGroup', EXISTS(SELECT 1 FROM public.group_places gp
                                 WHERE gp.group_id = mg.id AND gp.place_id = _place_id),
    'sharedVisitsCountForProgression', mg.shared_visits_count_for_progression
  ) ORDER BY
    (EXISTS(SELECT 1 FROM public.group_places gp WHERE gp.group_id = mg.id AND gp.place_id = _place_id)) DESC,
    mg.name ASC) INTO _result
  FROM my_groups mg;

  RETURN COALESCE(_result, '[]'::jsonb);
END $function$;

-- Ny RPC för AddPlaceDialog: lista egna tidigare besök på en plats i andra grupper
CREATE OR REPLACE FUNCTION public.list_own_visits_for_place_on_add(
  _place_id uuid,
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
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_target_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i målgruppen';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'visitId', v.id,
    'visitedOn', v.visited_on,
    'mealType', v.meal_type,
    'groupId', src.group_id,
    'groupName', g.name,
    'groupEmoji', COALESCE(g.emoji,'🍽️'),
    'alreadySharedToTarget', EXISTS(SELECT 1 FROM public.visit_group_links vgl
                                     WHERE vgl.visit_id = v.id AND vgl.group_id = _target_group_id),
    'ownHasComment', COALESCE((SELECT (comment IS NOT NULL AND length(trim(comment)) > 0)
                               FROM public.reviews
                               WHERE visit_id = v.id AND user_id = _uid), false)
  ) ORDER BY v.visited_on DESC) INTO _result
  FROM public.visits v
  JOIN public.visit_group_links src ON src.visit_id = v.id AND src.link_type = 'original'
  JOIN public.groups g ON g.id = src.group_id
  WHERE v.place_id = _place_id
    AND EXISTS (SELECT 1 FROM public.visit_participants vp
                WHERE vp.visit_id = v.id AND vp.user_id = _uid)
    AND EXISTS (SELECT 1 FROM public.memberships mm
                WHERE mm.group_id = src.group_id AND mm.user_id = _uid AND mm.status = 'active')
    AND src.group_id <> _target_group_id;

  RETURN COALESCE(_result, '[]'::jsonb);
END $function$;

-- Återkalla från PUBLIC/anon och bevilja endast authenticated
REVOKE ALL ON FUNCTION public.list_visit_share_targets(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_place_share_targets_v4b(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_own_visits_for_place_on_add(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visit_share_targets(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_place_share_targets_v4b(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_own_visits_for_place_on_add(uuid, uuid) TO authenticated;