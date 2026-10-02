-- Issue #109 — insikter och sortering i Min matresa.
BEGIN;

CREATE OR REPLACE FUNCTION public.list_personal_journey_places_v2(
  _query text DEFAULT NULL,
  _favorites_only boolean DEFAULT false,
  _visited_by_me_only boolean DEFAULT false,
  _sort text DEFAULT 'rating',
  _cursor jsonb DEFAULT NULL,
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
  _normalized_query text := NULLIF(trim(COALESCE(_query, '')), '');
  _normalized_sort text := COALESCE(NULLIF(trim(_sort), ''), 'rating');
  _cursor_rating numeric := NULLIF(_cursor->>'rating', '')::numeric;
  _cursor_review_count integer := COALESCE(NULLIF(_cursor->>'reviewCount', '')::integer, 0);
  _cursor_visited_on date := NULLIF(_cursor->>'visitedOn', '')::date;
  _cursor_name text := _cursor->>'name';
  _cursor_id uuid := NULLIF(_cursor->>'id', '')::uuid;
  _items jsonb;
  _next_cursor jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _normalized_sort NOT IN ('rating', 'recent', 'name') THEN
    RAISE EXCEPTION 'Ogiltig sortering';
  END IF;
  IF _cursor IS NOT NULL AND (_cursor_name IS NULL OR _cursor_id IS NULL) THEN
    RAISE EXCEPTION 'Ogiltig cursor';
  END IF;

  WITH readable_groups AS (
    SELECT group_row.id, group_row.name, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  place_contexts AS (
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
  own_visits AS (
    SELECT DISTINCT visit.place_id
    FROM public.visit_participants participant
    JOIN public.visits visit ON visit.id = participant.visit_id
    JOIN public.visit_group_links link ON link.visit_id = visit.id
    JOIN readable_groups readable_group ON readable_group.id = link.group_id
    WHERE participant.user_id = _uid
  ),
  visible_visits AS (
    SELECT DISTINCT visit.id, visit.place_id, visit.visited_on
    FROM public.visits visit
    JOIN public.visit_group_links link ON link.visit_id = visit.id
    JOIN readable_groups readable_group ON readable_group.id = link.group_id
  ),
  last_visits AS (
    SELECT place_id, max(visited_on) AS last_visited_on
    FROM visible_visits
    GROUP BY place_id
  ),
  visible_review_scores AS (
    SELECT DISTINCT
      visit.place_id,
      review.id,
      public.personal_journey_effective_review_overall_v1(review.id) AS score
    FROM public.reviews review
    JOIN public.visits visit ON visit.id = review.visit_id
    JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
    JOIN readable_groups readable_group ON readable_group.id = visibility.group_id
    WHERE visibility.rating_visible
      AND visit.meal_type <> 'dryck'
  ),
  review_aggregates AS (
    SELECT place_id, round(avg(score), 2) AS rating, count(score)::integer AS review_count
    FROM visible_review_scores
    WHERE score IS NOT NULL
    GROUP BY place_id
  ),
  candidate_rows AS (
    SELECT
      place.id,
      place.name,
      place.category,
      place.address,
      place.area,
      place.city,
      context.is_favorite,
      own_visit.place_id IS NOT NULL AS visited_by_me,
      aggregate.rating,
      COALESCE(aggregate.review_count, 0) AS review_count,
      last_visit.last_visited_on,
      context.group_contexts
    FROM place_contexts context
    JOIN public.places place ON place.id = context.place_id
    LEFT JOIN own_visits own_visit ON own_visit.place_id = place.id
    LEFT JOIN review_aggregates aggregate ON aggregate.place_id = place.id
    LEFT JOIN last_visits last_visit ON last_visit.place_id = place.id
    WHERE (NOT COALESCE(_favorites_only, false) OR context.is_favorite)
      AND (NOT COALESCE(_visited_by_me_only, false) OR own_visit.place_id IS NOT NULL)
      AND (
        _normalized_query IS NULL
        OR place.name ILIKE '%' || _normalized_query || '%'
        OR place.address ILIKE '%' || _normalized_query || '%'
        OR place.area ILIKE '%' || _normalized_query || '%'
        OR place.city ILIKE '%' || _normalized_query || '%'
      )
      AND (
        _cursor IS NULL
        OR CASE _normalized_sort
          WHEN 'rating' THEN
            CASE
              WHEN _cursor_rating IS NULL THEN
                aggregate.rating IS NULL
                AND (lower(place.name), place.id) > (lower(_cursor_name), _cursor_id)
              ELSE
                aggregate.rating IS NULL
                OR aggregate.rating < _cursor_rating
                OR (
                  aggregate.rating = _cursor_rating
                  AND COALESCE(aggregate.review_count, 0) < _cursor_review_count
                )
                OR (
                  aggregate.rating = _cursor_rating
                  AND COALESCE(aggregate.review_count, 0) = _cursor_review_count
                  AND (lower(place.name), place.id) > (lower(_cursor_name), _cursor_id)
                )
            END
          WHEN 'recent' THEN
            CASE
              WHEN _cursor_visited_on IS NULL THEN
                last_visit.last_visited_on IS NULL
                AND (lower(place.name), place.id) > (lower(_cursor_name), _cursor_id)
              ELSE
                last_visit.last_visited_on IS NULL
                OR last_visit.last_visited_on < _cursor_visited_on
                OR (
                  last_visit.last_visited_on = _cursor_visited_on
                  AND (lower(place.name), place.id) > (lower(_cursor_name), _cursor_id)
                )
            END
          ELSE (lower(place.name), place.id) > (lower(_cursor_name), _cursor_id)
        END
      )
  ),
  page_rows AS (
    SELECT candidate.*
    FROM candidate_rows candidate
    ORDER BY
      CASE WHEN _normalized_sort = 'rating' THEN candidate.rating END DESC NULLS LAST,
      CASE WHEN _normalized_sort = 'rating' THEN candidate.review_count END DESC,
      CASE WHEN _normalized_sort = 'recent' THEN candidate.last_visited_on END DESC NULLS LAST,
      lower(candidate.name),
      candidate.id
    LIMIT _page_size + 1
  ),
  numbered_rows AS (
    SELECT
      page.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN _normalized_sort = 'rating' THEN page.rating END DESC NULLS LAST,
          CASE WHEN _normalized_sort = 'rating' THEN page.review_count END DESC,
          CASE WHEN _normalized_sort = 'recent' THEN page.last_visited_on END DESC NULLS LAST,
          lower(page.name),
          page.id
      ) AS page_row_number
    FROM page_rows page
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'category', category,
          'address', address,
          'area', area,
          'city', city,
          'isFavorite', is_favorite,
          'visitedByMe', visited_by_me,
          'rating', rating,
          'reviewCount', review_count,
          'groups', group_contexts
        )
        ORDER BY page_row_number
      ) FILTER (WHERE page_row_number <= _page_size),
      '[]'::jsonb
    ),
    CASE WHEN max(page_row_number) > _page_size THEN (
      SELECT jsonb_build_object(
        'rating', cursor_row.rating,
        'reviewCount', cursor_row.review_count,
        'visitedOn', cursor_row.last_visited_on,
        'name', cursor_row.name,
        'id', cursor_row.id
      )
      FROM numbered_rows cursor_row
      WHERE cursor_row.page_row_number = _page_size
    ) ELSE NULL END
  INTO _items, _next_cursor
  FROM numbered_rows;

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

  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ordinality), '[]'::jsonb)
  INTO _recent_visits
  FROM jsonb_array_elements(_base->'recentVisits')
    WITH ORDINALITY AS item(value, ordinality)
  WHERE item.ordinality <= 3;

  RETURN (_base - 'favoritePlaces' - 'recentVisits') || jsonb_build_object(
    'topRatedPlaces', _top_rated,
    'favoritePlaces', _favorites,
    'recentVisits', _recent_visits
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_personal_journey_places_v2(text, boolean, boolean, text, jsonb, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_personal_journey_overview_v2()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_personal_journey_places_v2(text, boolean, boolean, text, jsonb, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_overview_v2()
  TO authenticated, service_role;

COMMIT;
