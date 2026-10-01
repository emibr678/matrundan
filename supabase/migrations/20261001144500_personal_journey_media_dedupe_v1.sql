-- Issue #109 — deduplicera kanoniska besöksbilder i Min matresas detaljläsning.
--
-- Samma mediaobjekt kan vara synligt genom flera av användarens grupper. Den
-- personliga read-modellen ska då returnera mediaobjektet en gång och välja en
-- deterministisk leveranstoken från en grupp användaren faktiskt får läsa.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_personal_journey_visit_v1(_visit_id uuid)
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

  WITH readable_groups AS (
    SELECT group_row.id, group_row.name, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  contexts AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'groupId', readable_group.id,
        'groupName', readable_group.name,
        'isArchived', readable_group.lifecycle_status = 'archived',
        'isWritable', readable_group.lifecycle_status = 'active'
      )
      ORDER BY readable_group.lifecycle_status = 'archived', lower(readable_group.name), readable_group.id
    ) AS groups
    FROM public.visit_group_links link
    JOIN readable_groups readable_group ON readable_group.id = link.group_id
    WHERE link.visit_id = _visit_id
  ),
  visible_reviews AS (
    SELECT
      review.id,
      review.user_id,
      CASE
        WHEN review.user_id = _uid OR bool_or(visibility.rating_visible)
          THEN public.personal_journey_effective_review_overall_v1(review.id)
        ELSE NULL
      END AS overall,
      CASE WHEN review.user_id = _uid OR bool_or(visibility.rating_visible) THEN review.taste ELSE NULL END AS taste,
      CASE WHEN review.user_id = _uid OR bool_or(visibility.rating_visible) THEN review.value ELSE NULL END AS value,
      CASE WHEN review.user_id = _uid OR bool_or(visibility.rating_visible) THEN review.service ELSE NULL END AS service,
      CASE WHEN review.user_id = _uid OR bool_or(visibility.rating_visible) THEN review.atmosphere ELSE NULL END AS atmosphere,
      CASE WHEN review.user_id = _uid OR bool_or(visibility.rating_visible) THEN review.review_model ELSE NULL END AS review_model,
      CASE WHEN review.user_id = _uid OR bool_or(visibility.comment_visible) THEN review.comment ELSE NULL END AS comment,
      review.user_id = _uid OR bool_or(visibility.rating_visible) AS rating_visible,
      review.user_id = _uid OR bool_or(visibility.comment_visible) AS comment_visible
    FROM public.reviews review
    LEFT JOIN public.review_group_visibility visibility
      ON visibility.review_id = review.id
     AND EXISTS (
       SELECT 1
       FROM readable_groups readable_group
       WHERE readable_group.id = visibility.group_id
     )
    WHERE review.visit_id = _visit_id
    GROUP BY review.id, review.user_id, review.taste, review.value, review.service,
      review.atmosphere, review.review_model, review.comment
    HAVING review.user_id = _uid
      OR bool_or(COALESCE(visibility.rating_visible, false))
      OR bool_or(COALESCE(visibility.comment_visible, false))
  ),
  review_payload AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', visible_review.id,
        'authorId', visible_review.user_id,
        'authorName', CASE
          WHEN visible_review.user_id = _uid THEN 'Du'
          WHEN public.shares_group(_uid, visible_review.user_id)
            THEN COALESCE(profile.display_name, 'Medlem')
          ELSE 'Gäst'
        END,
        'overall', visible_review.overall,
        'taste', visible_review.taste,
        'value', visible_review.value,
        'service', visible_review.service,
        'atmosphere', visible_review.atmosphere,
        'reviewModel', visible_review.review_model,
        'comment', visible_review.comment,
        'ratingVisible', visible_review.rating_visible,
        'commentVisible', visible_review.comment_visible,
        'isOwn', visible_review.user_id = _uid
      )
      ORDER BY visible_review.user_id = _uid DESC, lower(COALESCE(profile.display_name, '')), visible_review.id
    ), '[]'::jsonb) AS reviews
    FROM visible_reviews visible_review
    LEFT JOIN public.profiles profile ON profile.id = visible_review.user_id
  ),
  visible_photos AS (
    SELECT DISTINCT ON (media.id)
      media.id,
      visibility.delivery_token,
      media.mime_type,
      media.byte_size,
      media.width,
      media.height,
      media.created_at,
      media.uploaded_by = _uid AS is_own
    FROM public.visit_media_group_visibility visibility
    JOIN public.visit_media media
      ON media.id = visibility.media_id
     AND media.visit_id = visibility.visit_id
    WHERE visibility.visit_id = _visit_id
      AND EXISTS (
        SELECT 1
        FROM readable_groups readable_group
        WHERE readable_group.id = visibility.group_id
      )
    ORDER BY media.id, visibility.created_at, visibility.delivery_token
  ),
  photo_payload AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'deliveryToken', visible_photo.delivery_token,
        'mimeType', visible_photo.mime_type,
        'byteSize', visible_photo.byte_size,
        'width', visible_photo.width,
        'height', visible_photo.height,
        'createdAt', visible_photo.created_at,
        'isOwn', visible_photo.is_own
      )
      ORDER BY visible_photo.created_at, visible_photo.id
    ), '[]'::jsonb) AS photos
    FROM visible_photos visible_photo
  )
  SELECT jsonb_build_object(
    'id', visit.id,
    'placeId', place.id,
    'placeName', place.name,
    'address', place.address,
    'area', place.area,
    'city', place.city,
    'visitedOn', visit.visited_on,
    'mealType', visit.meal_type,
    'isTakeaway', visit.is_takeaway,
    'participated', participant.user_id IS NOT NULL,
    'ownReviewId', own_review.id,
    'reviewPending', participant.user_id IS NOT NULL
      AND visit.meal_type <> 'dryck'
      AND own_review.id IS NULL,
    'groups', context.groups,
    'reviews', review_payload.reviews,
    'photos', photo_payload.photos
  )
  INTO _result
  FROM public.visits visit
  JOIN public.places place ON place.id = visit.place_id
  CROSS JOIN contexts context
  CROSS JOIN review_payload
  CROSS JOIN photo_payload
  LEFT JOIN public.visit_participants participant
    ON participant.visit_id = visit.id
   AND participant.user_id = _uid
  LEFT JOIN public.reviews own_review
    ON own_review.visit_id = visit.id
   AND own_review.user_id = _uid
  WHERE visit.id = _visit_id
    AND context.groups IS NOT NULL;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_personal_journey_visit_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_visit_v1(uuid)
  TO authenticated, service_role;

COMMIT;
