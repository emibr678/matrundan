-- v1.5.0: säkerställ aktiva målgrupper och återaktivera matstället vid delning.

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
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.group_is_active(_target_group_id) THEN
    RAISE EXCEPTION 'Målgruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_target_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i målgruppen';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'visitId', v.id,
    'visitedOn', v.visited_on,
    'mealType', v.meal_type,
    'groupId', src.group_id,
    'groupName', g.name,
    'groupEmoji', COALESCE(g.emoji, '🍽️'),
    'alreadySharedToTarget', EXISTS(
      SELECT 1
      FROM public.visit_group_links vgl
      WHERE vgl.visit_id = v.id
        AND vgl.group_id = _target_group_id
    ),
    'ownHasComment', COALESCE((
      SELECT comment IS NOT NULL AND length(trim(comment)) > 0
      FROM public.reviews
      WHERE visit_id = v.id
        AND user_id = _uid
    ), false)
  ) ORDER BY v.visited_on DESC)
  INTO _result
  FROM public.visits v
  JOIN public.visit_group_links src
    ON src.visit_id = v.id
   AND src.link_type = 'original'
  JOIN public.groups g
    ON g.id = src.group_id
   AND g.lifecycle_status = 'active'
  WHERE v.place_id = _place_id
    AND src.group_id <> _target_group_id
    AND EXISTS (
      SELECT 1
      FROM public.visit_participants vp
      WHERE vp.visit_id = v.id
        AND vp.user_id = _uid
    )
    AND EXISTS (
      SELECT 1
      FROM public.memberships mm
      WHERE mm.group_id = src.group_id
        AND mm.user_id = _uid
        AND mm.status = 'active'
    );

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.share_visit_to_group(
  _visit_id uuid,
  _target_group_id uuid,
  _share_own_comment boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _place_name text;
  _source_group uuid;
  _actor_name text;
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
    FROM public.visit_participants
    WHERE visit_id = _visit_id
      AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Du deltog inte i besöket';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.visit_group_links
    WHERE visit_id = _visit_id
      AND group_id = _target_group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är redan tillagt i denna grupp'
      USING ERRCODE = 'unique_violation';
  END IF;

  SELECT v.place_id, p.name
  INTO _place_id, _place_name
  FROM public.visits v
  JOIN public.places p ON p.id = v.place_id
  WHERE v.id = _visit_id;

  IF _place_id IS NULL THEN
    RAISE EXCEPTION 'Besök saknas';
  END IF;

  SELECT group_id
  INTO _source_group
  FROM public.visit_group_links
  WHERE visit_id = _visit_id
    AND link_type = 'original'
  LIMIT 1;

  INSERT INTO public.group_places (
    group_id,
    place_id,
    added_by,
    origin,
    source_group_id
  )
  VALUES (
    _target_group_id,
    _place_id,
    _uid,
    'shared_visit',
    _source_group
  )
  ON CONFLICT (group_id, place_id) DO UPDATE
  SET collection_status = 'active',
      archived_at = NULL,
      archived_by = NULL,
      updated_at = now();

  INSERT INTO public.visit_group_links (
    visit_id,
    group_id,
    link_type,
    linked_by,
    source_group_id
  )
  VALUES (
    _visit_id,
    _target_group_id,
    'shared',
    _uid,
    _source_group
  );

  INSERT INTO public.review_group_visibility (
    review_id,
    group_id,
    rating_visible,
    comment_visible
  )
  SELECT
    r.id,
    _target_group_id,
    true,
    CASE WHEN r.user_id = _uid THEN _share_own_comment ELSE false END
  FROM public.reviews r
  WHERE r.visit_id = _visit_id
    AND EXISTS (
      SELECT 1
      FROM public.memberships mm
      WHERE mm.group_id = _target_group_id
        AND mm.user_id = r.user_id
    )
  ON CONFLICT (review_id, group_id) DO NOTHING;

  SELECT display_name
  INTO _actor_name
  FROM public.profiles
  WHERE id = _uid;

  INSERT INTO public.activity (
    group_id,
    kind,
    actor_id,
    place_id,
    visit_id,
    payload
  )
  VALUES (
    _target_group_id,
    'visited',
    _uid,
    _place_id,
    _visit_id,
    jsonb_build_object(
      'text',
      coalesce(_actor_name, 'Någon') || ' lade till ett besök på ' ||
        coalesce(_place_name, 'ett ställe') || ' i gruppen',
      'shared',
      true
    )
  );

  RETURN _target_group_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_own_visits_for_place_on_add(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_visit_to_group(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_own_visits_for_place_on_add(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_visit_to_group(uuid, uuid, boolean) TO authenticated;
