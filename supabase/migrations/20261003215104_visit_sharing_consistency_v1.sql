BEGIN;

-- Issue #398: one canonical visit, one transaction per target. False flags do
-- not revoke an earlier grant. The existing mutation owns historical ratings.
CREATE OR REPLACE FUNCTION public.share_visit_to_group_v5(
  _visit_id uuid,
  _target_group_id uuid,
  _share_own_comment boolean DEFAULT false,
  _allow_strong_duplicate boolean DEFAULT false,
  _share_own_photo boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _linked boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Lock the real visit to serialize all new clients, without new lock tables.
  PERFORM 1 FROM public.visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Besök saknas'; END IF;
  PERFORM 1 FROM public.groups
    WHERE id = _target_group_id AND lifecycle_status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Målgruppen är inte aktiv'; END IF;
  PERFORM 1 FROM public.memberships
    WHERE group_id = _target_group_id AND user_id = _uid AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Du är inte aktiv medlem i målgruppen'; END IF;
  PERFORM 1 FROM public.visit_participants
    WHERE visit_id = _visit_id AND user_id = _uid FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Endast faktiska deltagare kan lägga till besöket'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.visit_group_links
    WHERE visit_id = _visit_id AND group_id = _target_group_id) INTO _linked;
  IF NOT _linked THEN
    BEGIN
      PERFORM public.share_visit_to_group_v4(
        _visit_id, _target_group_id, _share_own_comment,
        _allow_strong_duplicate, _share_own_photo
      );
      RETURN _target_group_id;
    EXCEPTION WHEN unique_violation THEN
      -- A legacy client may race this transaction. Only the same visit link
      -- counts as success; unrelated constraint failures must remain errors.
      IF NOT EXISTS(SELECT 1 FROM public.visit_group_links
        WHERE visit_id = _visit_id AND group_id = _target_group_id) THEN RAISE; END IF;
    END;
  END IF;

  -- Existing link: only the caller's content can gain visibility. No activity,
  -- place metadata, rating/model edits, reactions or new visit are created.
  IF _share_own_comment THEN
    INSERT INTO public.review_group_visibility(review_id, group_id, rating_visible, comment_visible)
    SELECT review.id, _target_group_id, visit.meal_type <> 'dryck', true
    FROM public.reviews review JOIN public.visits visit ON visit.id = review.visit_id
    WHERE review.visit_id = _visit_id AND review.user_id = _uid
      AND NULLIF(trim(COALESCE(review.comment, '')), '') IS NOT NULL
    ON CONFLICT(review_id, group_id) DO UPDATE
      SET comment_visible = true, updated_at = now();
  END IF;
  IF _share_own_photo THEN
    PERFORM public.grant_own_visit_photo_visibility_v1(_visit_id, _target_group_id);
  END IF;
  RETURN _target_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_visit_share_targets_v6(_visit_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _base jsonb; _result jsonb;
BEGIN
  _base := public.list_visit_share_targets_v5(_visit_id);
  SELECT COALESCE(jsonb_agg(item || jsonb_build_object(
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

CREATE OR REPLACE FUNCTION public.list_own_visits_for_place_on_add_v2(_place_id uuid, _target_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _base jsonb; _result jsonb;
BEGIN
  _base := public.list_own_visits_for_place_on_add(_place_id, _target_group_id);
  SELECT COALESCE(jsonb_agg(item || jsonb_build_object('ownHasPhoto', EXISTS(
    SELECT 1 FROM public.visit_media media
    WHERE media.visit_id = (item->>'visitId')::uuid AND media.uploaded_by = auth.uid()
  )) ORDER BY ordinality), '[]'::jsonb) INTO _result
  FROM jsonb_array_elements(_base) WITH ORDINALITY entry(item, ordinality);
  RETURN _result;
END;
$function$;

-- Only booleans needed to explain a canonical edit. No other group identity,
-- membership, count, review content, media identifier or Storage path is output.
CREATE OR REPLACE FUNCTION public.get_visit_content_impact_v1(
  _visit_id uuid, _group_id uuid, _photo_owner_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _owner uuid := COALESCE(_photo_owner_id, auth.uid());
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) OR NOT EXISTS(
    SELECT 1 FROM public.visit_group_links WHERE visit_id = _visit_id AND group_id = _group_id
  ) THEN RAISE EXCEPTION 'Besöket är inte tillgängligt i gruppen'; END IF;
  IF _owner <> _uid AND NOT EXISTS(
    SELECT 1 FROM public.visit_group_links link
    JOIN public.memberships membership ON membership.group_id = link.group_id
    WHERE link.visit_id = _visit_id AND link.group_id = _group_id AND link.link_type = 'original'
      AND membership.user_id = _uid AND membership.status = 'active' AND membership.role IN ('owner', 'admin')
  ) THEN RAISE EXCEPTION 'Du kan bara läsa konsekvenser för ditt eget innehåll'; END IF;
  RETURN jsonb_build_object(
    'commentSharedElsewhere', EXISTS(
      SELECT 1 FROM public.reviews review
      JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
      JOIN public.visit_group_links link ON link.visit_id = review.visit_id AND link.group_id = visibility.group_id
      WHERE review.visit_id = _visit_id AND review.user_id = _uid
        AND visibility.comment_visible AND visibility.group_id <> _group_id
    ),
    'photoSharedElsewhere', EXISTS(
      SELECT 1 FROM public.visit_media media
      JOIN public.visit_media_group_visibility visibility ON visibility.media_id = media.id
      JOIN public.visit_group_links link ON link.visit_id = media.visit_id AND link.group_id = visibility.group_id
      WHERE media.visit_id = _visit_id AND media.uploaded_by = _owner AND visibility.group_id <> _group_id
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.share_visit_to_group_v5(uuid, uuid, boolean, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_visit_share_targets_v6(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_own_visits_for_place_on_add_v2(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_visit_content_impact_v1(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_visit_to_group_v5(uuid, uuid, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_visit_share_targets_v6(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_own_visits_for_place_on_add_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_content_impact_v1(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
