-- Issue #109 — platskategori i personliga besök och egna besök i översikten.
BEGIN;

CREATE OR REPLACE FUNCTION public.list_personal_journey_visits_v1(
  _participated_only boolean DEFAULT false,
  _cursor_visited_on date DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL,
  _limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _page_size integer := LEAST(GREATEST(COALESCE(_limit, 20), 1), 50);
  _items jsonb;
  _next_cursor jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF (_cursor_visited_on IS NULL) <> (_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'Ogiltig cursor';
  END IF;

  WITH readable_groups AS (
    SELECT group_row.id, group_row.name, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  accessible_visits AS (
    SELECT
      visit.id,
      visit.place_id,
      visit.visited_on,
      visit.meal_type,
      visit.is_takeaway,
      jsonb_agg(
        jsonb_build_object(
          'groupId', readable_group.id,
          'groupName', readable_group.name,
          'isArchived', readable_group.lifecycle_status = 'archived',
          'isWritable', readable_group.lifecycle_status = 'active'
        )
        ORDER BY readable_group.lifecycle_status = 'archived', lower(readable_group.name), readable_group.id
      ) AS group_contexts
    FROM public.visits visit
    JOIN public.visit_group_links link ON link.visit_id = visit.id
    JOIN readable_groups readable_group ON readable_group.id = link.group_id
    GROUP BY visit.id, visit.place_id, visit.visited_on, visit.meal_type, visit.is_takeaway
  ),
  visible_review_scores AS (
    SELECT DISTINCT
      review.visit_id,
      review.id,
      public.personal_journey_effective_review_overall_v1(review.id) AS score
    FROM public.reviews review
    JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
    JOIN readable_groups readable_group ON readable_group.id = visibility.group_id
    WHERE visibility.rating_visible
  ),
  review_aggregates AS (
    SELECT visit_id, round(avg(score), 2) AS rating, count(score)::integer AS review_count
    FROM visible_review_scores
    WHERE score IS NOT NULL
    GROUP BY visit_id
  ),
  candidate_rows AS (
    SELECT
      visit.id,
      visit.place_id,
      place.name AS place_name,
      place.category,
      place.address,
      place.area,
      place.city,
      visit.visited_on,
      visit.meal_type,
      visit.is_takeaway,
      participant.user_id IS NOT NULL AS participated,
      own_review.id AS own_review_id,
      participant.user_id IS NOT NULL
        AND visit.meal_type <> 'dryck'
        AND own_review.id IS NULL AS review_pending,
      aggregate.rating,
      COALESCE(aggregate.review_count, 0) AS review_count,
      visit.group_contexts,
      photo.delivery_token AS photo_delivery_token
    FROM accessible_visits visit
    JOIN public.places place ON place.id = visit.place_id
    LEFT JOIN public.visit_participants participant
      ON participant.visit_id = visit.id
     AND participant.user_id = _uid
    LEFT JOIN public.reviews own_review
      ON own_review.visit_id = visit.id
     AND own_review.user_id = _uid
    LEFT JOIN review_aggregates aggregate ON aggregate.visit_id = visit.id
    LEFT JOIN LATERAL (
      SELECT visibility.delivery_token
      FROM public.visit_media_group_visibility visibility
      JOIN readable_groups readable_group ON readable_group.id = visibility.group_id
      WHERE visibility.visit_id = visit.id
      ORDER BY visibility.created_at, visibility.delivery_token
      LIMIT 1
    ) photo ON true
    WHERE (NOT COALESCE(_participated_only, false) OR participant.user_id IS NOT NULL)
      AND (
        _cursor_visited_on IS NULL
        OR (visit.visited_on, visit.id) < (_cursor_visited_on, _cursor_id)
      )
    ORDER BY visit.visited_on DESC, visit.id DESC
    LIMIT _page_size + 1
  ),
  numbered_rows AS (
    SELECT candidate.*, row_number() OVER (ORDER BY candidate.visited_on DESC, candidate.id DESC) AS row_number
    FROM candidate_rows candidate
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'placeId', place_id,
          'placeName', place_name,
          'category', category,
          'address', address,
          'area', area,
          'city', city,
          'visitedOn', visited_on,
          'mealType', meal_type,
          'isTakeaway', is_takeaway,
          'participated', participated,
          'ownReviewId', own_review_id,
          'reviewPending', review_pending,
          'rating', rating,
          'reviewCount', review_count,
          'groups', group_contexts,
          'photoDeliveryToken', photo_delivery_token
        )
        ORDER BY visited_on DESC, id DESC
      ) FILTER (WHERE row_number <= _page_size),
      '[]'::jsonb
    ),
    (
      jsonb_agg(
        jsonb_build_object('visitedOn', lag_visited_on, 'id', lag_id)
      ) FILTER (WHERE row_number = _page_size + 1)
    )->0
  INTO _items, _next_cursor
  FROM (
    SELECT
      numbered_rows.*,
      lag(visited_on) OVER (ORDER BY visited_on DESC, id DESC) AS lag_visited_on,
      lag(id) OVER (ORDER BY visited_on DESC, id DESC) AS lag_id
    FROM numbered_rows
  ) page;

  RETURN jsonb_build_object('items', _items, 'nextCursor', _next_cursor);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_personal_journey_overview_v2()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _base jsonb;
  _top_rated jsonb;
  _favorites jsonb;
  _recent_visits jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  _base := public.get_personal_journey_overview_v1();

  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinality), '[]'::jsonb)
  INTO _top_rated
  FROM jsonb_array_elements(
    public.list_personal_journey_places_v2(NULL, false, false, 'rating', NULL, 3)->'items'
  ) WITH ORDINALITY AS item(value, ordinality)
  WHERE item.value->'rating' IS DISTINCT FROM 'null'::jsonb;

  _favorites := public.list_personal_journey_places_v2(
    NULL, true, false, 'name', NULL, 3
  )->'items';

  _recent_visits := public.list_personal_journey_visits_v1(
    true, NULL, NULL, 2
  )->'items';

  RETURN (_base - 'favoritePlaces' - 'recentVisits') || jsonb_build_object(
    'topRatedPlaces', _top_rated,
    'favoritePlaces', _favorites,
    'recentVisits', _recent_visits
  );
END;
$function$;

COMMIT;
