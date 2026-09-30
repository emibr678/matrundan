-- Issue #109 — filtrerbar privat Topplista i Min matresa.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_personal_journey_toplist_v1(
  _occasions text[] DEFAULT ARRAY[]::text[],
  _meal_types text[] DEFAULT ARRAY[]::text[],
  _takeaway_only boolean DEFAULT false,
  _limit integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _selected_occasions text[] := COALESCE(_occasions, ARRAY[]::text[]);
  _selected_meals text[] := COALESCE(_meal_types, ARRAY[]::text[]);
  _page_size integer := LEAST(GREATEST(COALESCE(_limit, 3), 1), 20);
  _leader jsonb;
  _items jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(_selected_occasions) value
    WHERE value NOT IN ('snabbt', 'avslappnat', 'middag')
  ) THEN
    RAISE EXCEPTION 'Ogiltig typ av upplevelse';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(_selected_meals) value
    WHERE value NOT IN ('frukost', 'lunch', 'fika', 'middag')
  ) THEN
    RAISE EXCEPTION 'Ogiltigt tillfälle';
  END IF;

  WITH readable_groups AS (
    SELECT group_row.id, group_row.name, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  all_place_contexts AS (
    SELECT
      group_place.place_id,
      bool_or(favorite.user_id IS NOT NULL) AS is_favorite,
      jsonb_agg(
        jsonb_build_object(
          'groupId', readable_group.id,
          'groupName', readable_group.name,
          'isArchived', readable_group.lifecycle_status = 'archived',
          'isWritable', readable_group.lifecycle_status = 'active',
          'isFavorite', favorite.user_id IS NOT NULL
        )
        ORDER BY readable_group.lifecycle_status = 'archived', lower(readable_group.name), readable_group.id
      ) AS group_contexts
    FROM public.group_places group_place
    JOIN readable_groups readable_group ON readable_group.id = group_place.group_id
    LEFT JOIN public.favorites favorite
      ON favorite.group_id = group_place.group_id
     AND favorite.place_id = group_place.place_id
     AND favorite.user_id = _uid
    WHERE group_place.collection_status = 'active'
    GROUP BY group_place.place_id
  ),
  eligible_places AS (
    SELECT DISTINCT group_place.place_id
    FROM public.group_places group_place
    JOIN readable_groups readable_group ON readable_group.id = group_place.group_id
    WHERE group_place.collection_status = 'active'
      AND (
        cardinality(_selected_occasions) = 0
        OR COALESCE(group_place.occasions, ARRAY[]::text[]) && _selected_occasions
      )
  ),
  all_visible_scores AS (
    SELECT DISTINCT
      visit.place_id,
      visit.id AS visit_id,
      review.id AS review_id,
      public.personal_journey_effective_review_overall_v1(review.id) AS score
    FROM public.reviews review
    JOIN public.visits visit ON visit.id = review.visit_id
    JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
    JOIN readable_groups readable_group ON readable_group.id = visibility.group_id
    WHERE visibility.rating_visible
      AND visit.meal_type <> 'dryck'
  ),
  overall_aggregates AS (
    SELECT
      place_id,
      round(avg(score), 2) AS rating,
      count(review_id)::integer AS review_count,
      count(DISTINCT visit_id)::integer AS visit_count
    FROM all_visible_scores
    WHERE score IS NOT NULL
    GROUP BY place_id
  ),
  filtered_visible_scores AS (
    SELECT DISTINCT
      visit.place_id,
      visit.id AS visit_id,
      review.id AS review_id,
      public.personal_journey_effective_review_overall_v1(review.id) AS score
    FROM public.reviews review
    JOIN public.visits visit ON visit.id = review.visit_id
    JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
    JOIN readable_groups readable_group ON readable_group.id = visibility.group_id
    WHERE visibility.rating_visible
      AND visit.meal_type <> 'dryck'
      AND (cardinality(_selected_meals) = 0 OR visit.meal_type = ANY(_selected_meals))
      AND (NOT COALESCE(_takeaway_only, false) OR visit.is_takeaway)
  ),
  filtered_aggregates AS (
    SELECT
      place_id,
      round(avg(score), 2) AS rating,
      count(review_id)::integer AS review_count,
      count(DISTINCT visit_id)::integer AS visit_count
    FROM filtered_visible_scores
    WHERE score IS NOT NULL
    GROUP BY place_id
  ),
  overall_ranked AS (
    SELECT
      place.id,
      place.name,
      place.category,
      place.address,
      place.area,
      place.city,
      context.is_favorite,
      aggregate.rating,
      aggregate.review_count,
      aggregate.visit_count,
      context.group_contexts
    FROM all_place_contexts context
    JOIN public.places place ON place.id = context.place_id
    JOIN overall_aggregates aggregate ON aggregate.place_id = place.id
    ORDER BY aggregate.rating DESC, aggregate.review_count DESC, lower(place.name), place.id
    LIMIT 1
  ),
  filtered_ranked AS (
    SELECT
      place.id,
      place.name,
      place.category,
      place.address,
      place.area,
      place.city,
      context.is_favorite,
      aggregate.rating,
      aggregate.review_count,
      aggregate.visit_count,
      context.group_contexts
    FROM eligible_places eligible
    JOIN all_place_contexts context ON context.place_id = eligible.place_id
    JOIN public.places place ON place.id = eligible.place_id
    JOIN filtered_aggregates aggregate ON aggregate.place_id = eligible.place_id
    ORDER BY aggregate.rating DESC, aggregate.review_count DESC, lower(place.name), place.id
    LIMIT _page_size
  )
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'category', category,
    'address', address,
    'area', area,
    'city', city,
    'isFavorite', is_favorite,
    'visitedByMe', false,
    'rating', rating,
    'reviewCount', review_count,
    'visitCount', visit_count,
    'groups', group_contexts
  )
  INTO _leader
  FROM overall_ranked;

  WITH readable_groups AS (
    SELECT group_row.id, group_row.name, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  all_place_contexts AS (
    SELECT
      group_place.place_id,
      bool_or(favorite.user_id IS NOT NULL) AS is_favorite,
      jsonb_agg(
        jsonb_build_object(
          'groupId', readable_group.id,
          'groupName', readable_group.name,
          'isArchived', readable_group.lifecycle_status = 'archived',
          'isWritable', readable_group.lifecycle_status = 'active',
          'isFavorite', favorite.user_id IS NOT NULL
        )
        ORDER BY readable_group.lifecycle_status = 'archived', lower(readable_group.name), readable_group.id
      ) AS group_contexts
    FROM public.group_places group_place
    JOIN readable_groups readable_group ON readable_group.id = group_place.group_id
    LEFT JOIN public.favorites favorite
      ON favorite.group_id = group_place.group_id
     AND favorite.place_id = group_place.place_id
     AND favorite.user_id = _uid
    WHERE group_place.collection_status = 'active'
    GROUP BY group_place.place_id
  ),
  eligible_places AS (
    SELECT DISTINCT group_place.place_id
    FROM public.group_places group_place
    JOIN readable_groups readable_group ON readable_group.id = group_place.group_id
    WHERE group_place.collection_status = 'active'
      AND (
        cardinality(_selected_occasions) = 0
        OR COALESCE(group_place.occasions, ARRAY[]::text[]) && _selected_occasions
      )
  ),
  filtered_visible_scores AS (
    SELECT DISTINCT
      visit.place_id,
      visit.id AS visit_id,
      review.id AS review_id,
      public.personal_journey_effective_review_overall_v1(review.id) AS score
    FROM public.reviews review
    JOIN public.visits visit ON visit.id = review.visit_id
    JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
    JOIN readable_groups readable_group ON readable_group.id = visibility.group_id
    WHERE visibility.rating_visible
      AND visit.meal_type <> 'dryck'
      AND (cardinality(_selected_meals) = 0 OR visit.meal_type = ANY(_selected_meals))
      AND (NOT COALESCE(_takeaway_only, false) OR visit.is_takeaway)
  ),
  filtered_aggregates AS (
    SELECT
      place_id,
      round(avg(score), 2) AS rating,
      count(review_id)::integer AS review_count,
      count(DISTINCT visit_id)::integer AS visit_count
    FROM filtered_visible_scores
    WHERE score IS NOT NULL
    GROUP BY place_id
  ),
  filtered_ranked AS (
    SELECT
      place.id,
      place.name,
      place.category,
      place.address,
      place.area,
      place.city,
      context.is_favorite,
      aggregate.rating,
      aggregate.review_count,
      aggregate.visit_count,
      context.group_contexts
    FROM eligible_places eligible
    JOIN all_place_contexts context ON context.place_id = eligible.place_id
    JOIN public.places place ON place.id = eligible.place_id
    JOIN filtered_aggregates aggregate ON aggregate.place_id = eligible.place_id
    ORDER BY aggregate.rating DESC, aggregate.review_count DESC, lower(place.name), place.id
    LIMIT _page_size
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'category', category,
        'address', address,
        'area', area,
        'city', city,
        'isFavorite', is_favorite,
        'visitedByMe', false,
        'rating', rating,
        'reviewCount', review_count,
        'visitCount', visit_count,
        'groups', group_contexts
      )
      ORDER BY rating DESC, review_count DESC, lower(name), id
    ),
    '[]'::jsonb
  )
  INTO _items
  FROM filtered_ranked;

  RETURN jsonb_build_object('leader', _leader, 'items', _items);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_personal_journey_toplist_v1(text[], text[], boolean, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_toplist_v1(text[], text[], boolean, integer)
  TO authenticated, service_role;

COMMIT;
