BEGIN;

-- Issue #396: additive target booleans; explicit, fill-only classification.
CREATE OR REPLACE FUNCTION public.share_visit_to_group_v6(
  _visit_id uuid,
  _target_group_id uuid,
  _share_own_comment boolean DEFAULT false,
  _allow_strong_duplicate boolean DEFAULT false,
  _share_own_photo boolean DEFAULT false,
  _confirmed_occasions text[] DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _result uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _confirmed_occasions IS NOT NULL AND (
    cardinality(_confirmed_occasions) NOT BETWEEN 1 AND 2
    OR EXISTS(SELECT 1 FROM unnest(_confirmed_occasions) value
      WHERE value IS NULL OR value NOT IN ('snabbt', 'avslappnat', 'middag'))
    OR (SELECT count(DISTINCT value) FROM unnest(_confirmed_occasions) value)
      <> cardinality(_confirmed_occasions)
  ) THEN RAISE EXCEPTION 'Välj en eller två olika typer av upplevelse'; END IF;

  -- This call owns authorization, visit locking, links and own-content grants.
  -- Its target group and membership locks remain held until this transaction ends.
  _result := public.share_visit_to_group_v5(
    _visit_id, _target_group_id, _share_own_comment,
    _allow_strong_duplicate, _share_own_photo
  );
  IF _confirmed_occasions IS NOT NULL THEN
    -- UPDATE rechecks the empty predicate after waiting for a concurrent writer.
    -- No source-group lookup, copying of other metadata, or review mutation.
    UPDATE public.group_places gp
    SET occasions = _confirmed_occasions, updated_at = now()
    WHERE gp.group_id = _target_group_id
      AND gp.place_id = (SELECT place_id FROM public.visits WHERE id = _visit_id)
      AND gp.collection_status = 'active'
      AND cardinality(COALESCE(gp.occasions, '{}'::text[])) = 0;
  END IF;
  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_visit_share_targets_v6(_visit_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _base jsonb; _result jsonb;
BEGIN
  _base := public.list_visit_share_targets_v5(_visit_id);
  SELECT COALESCE(jsonb_agg(item || jsonb_build_object(
    'hasExperienceClassification', EXISTS(
      SELECT 1 FROM public.group_places gp JOIN public.visits v ON v.place_id = gp.place_id
      WHERE v.id = _visit_id AND gp.group_id = (item->>'groupId')::uuid
        AND cardinality(COALESCE(gp.occasions, '{}'::text[])) > 0
    ),
    'ownCommentShared', EXISTS(
      SELECT 1 FROM public.reviews review
      JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
      WHERE review.visit_id = _visit_id AND review.user_id = auth.uid()
        AND visibility.group_id = (item->>'groupId')::uuid
        AND visibility.comment_visible
    )
  )), '[]'::jsonb) INTO _result FROM jsonb_array_elements(_base) item;
  RETURN _result;
END;
$function$;


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
    'hasExperienceClassification', EXISTS(SELECT 1 FROM public.group_places gp
      WHERE gp.group_id = mg.id AND gp.place_id = _place_id
        AND cardinality(COALESCE(gp.occasions, '{}'::text[])) > 0),
    'sharedVisitsCountForProgression', mg.shared_visits_count_for_progression
  ) ORDER BY
    (EXISTS(SELECT 1 FROM public.group_places gp WHERE gp.group_id = mg.id AND gp.place_id = _place_id)) DESC,
    mg.name ASC) INTO _result
  FROM my_groups mg;

  RETURN COALESCE(_result, '[]'::jsonb);
END $function$;


REVOKE ALL ON FUNCTION public.share_visit_to_group_v6(uuid,uuid,boolean,boolean,boolean,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_visit_to_group_v6(uuid,uuid,boolean,boolean,boolean,text[]) TO authenticated;
-- CREATE OR REPLACE preserves the existing read-RPC grants.
NOTIFY pgrst, 'reload schema';
COMMIT;
