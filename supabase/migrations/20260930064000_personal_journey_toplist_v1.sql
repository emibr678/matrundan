-- Issue #109 — filtrerbar, paginerad privat Topplista i Min matresa.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_personal_journey_toplist_v1(
  _query text DEFAULT NULL,
  _occasions text[] DEFAULT ARRAY[]::text[],
  _meal_types text[] DEFAULT ARRAY[]::text[],
  _takeaway_only boolean DEFAULT false,
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
  _selected_occasions text[] := COALESCE(_occasions, ARRAY[]::text[]);
  _selected_meals text[] := COALESCE(_meal_types, ARRAY[]::text[]);
  _normalized_query text := NULLIF(trim(COALESCE(_query, '')), '');
  _page_size integer := LEAST(GREATEST(COALESCE(_limit, 20), 1), 50);
  _cursor_rating numeric := NULLIF(_cursor->>'rating', '')::numeric;
  _cursor_review_count integer := COALESCE(NULLIF(_cursor->>'reviewCount', '')::integer, 0);
  _cursor_name text := _cursor->>'name';
  _cursor_id uuid := NULLIF(_cursor->>'id', '')::uuid;
  _items jsonb;
  _next_cursor jsonb;
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

  IF _cursor IS NOT NULL AND (
    _cursor_rating IS NULL
    OR _cursor_name IS NULL
    OR _cursor_id IS NULL
  ) THEN
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
  visible_scores AS (
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
  review_aggregates AS (
    SELECT
      place_id,
      round(avg(score), 2) AS rating,
      count(review_id)::integer AS review_count,
      count(DISTINCT visit_id)::integer AS visit_count
    FROM visible_scores
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
      aggregate.rating,
      aggregate.review_count,
      aggregate.visit_count,
      context.group_contexts
    FROM eligible_places eligible
    JOIN place_contexts context ON context.place_id = eligible.place_id
    JOIN public.places place ON place.id = eligible.place_id
    JOIN review_aggregates aggregate ON aggregate.place_id = eligible.place_id
    WHERE (
      _normalized_query IS NULL
      OR place.name ILIKE '%' || _normalized_query || '%'
      OR place.address ILIKE '%' || _normalized_query || '%'
      OR place.area ILIKE '%' || _normalized_query || '%'
      OR place.city ILIKE '%' || _normalized_query || '%'
    )
  ),
  ranked_rows AS (
    SELECT
      candidate.*,
      row_number() OVER (
        ORDER BY candidate.rating DESC, candidate.review_count DESC, lower(candidate.name), candidate.id
      )::integer AS rank
    FROM candidate_rows candidate
  ),
  page_rows AS (
    SELECT ranked.*
    FROM ranked_rows ranked
    WHERE _cursor IS NULL
      OR ranked.rating < _cursor_rating
      OR (
        ranked.rating = _cursor_rating
        AND ranked.review_count < _cursor_review_count
      )
      OR (
        ranked.rating = _cursor_rating
        AND ranked.review_count = _cursor_review_count
        AND (lower(ranked.name), ranked.id) > (lower(_cursor_name), _cursor_id)
      )
    ORDER BY ranked.rating DESC, ranked.review_count DESC, lower(ranked.name), ranked.id
    LIMIT _page_size + 1
  ),
  numbered_page AS (
    SELECT page.*, row_number() OVER (
      ORDER BY page.rating DESC, page.review_count DESC, lower(page.name), page.id
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
          'visitedByMe', false,
          'rating', rating,
          'reviewCount', review_count,
          'visitCount', visit_count,
          'rank', rank,
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
        'name', cursor_row.name,
        'id', cursor_row.id
      )
      FROM numbered_page cursor_row
      WHERE cursor_row.page_row_number = _page_size
    ) ELSE NULL END
  INTO _items, _next_cursor
  FROM numbered_page;

  RETURN jsonb_build_object('items', _items, 'nextCursor', _next_cursor);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_personal_journey_toplist_v1(
  text, text[], text[], boolean, jsonb, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_toplist_v1(
  text, text[], text[], boolean, jsonb, integer
) TO authenticated, service_role;

COMMIT;
