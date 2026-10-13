-- Issue #488: Min matresa räknar endast aktiva gruppkopplingar.
-- Detta omdefinierar befintliga läs-RPC:er utan dataradering eller backfill.
-- Delade kanoniska besök räknas en gång, och arkiverad historik kan återaktiveras.
BEGIN;

-- get_personal_journey_overview_v1
CREATE OR REPLACE FUNCTION public.get_personal_journey_overview_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _attended_visits integer;
  _attended_places integer;
  _readable_groups integer;
  _active_groups integer;
  _pending_reviews jsonb;
  _favorite_places jsonb;
  _recent_visits jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  WITH readable_groups AS (
    SELECT group_row.id, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
     AND group_row.lifecycle_status = 'active'
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  accessible_own_visits AS (
    SELECT DISTINCT visit.id, visit.place_id
    FROM public.visit_participants participant
    JOIN public.visits visit ON visit.id = participant.visit_id
    JOIN public.visit_group_links link ON link.visit_id = visit.id
    JOIN readable_groups readable_group ON readable_group.id = link.group_id
    WHERE participant.user_id = _uid
  )
  SELECT
    (SELECT count(*)::integer FROM accessible_own_visits),
    (SELECT count(DISTINCT place_id)::integer FROM accessible_own_visits),
    (SELECT count(*)::integer FROM readable_groups),
    (SELECT count(*)::integer FROM readable_groups WHERE lifecycle_status = 'active')
  INTO _attended_visits, _attended_places, _readable_groups, _active_groups;

  WITH readable_groups AS (
    SELECT group_row.id, group_row.name, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
     AND group_row.lifecycle_status = 'active'
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  pending AS (
    SELECT DISTINCT
      visit.id,
      visit.place_id,
      place.name AS place_name,
      visit.visited_on,
      visit.meal_type,
      visit.is_takeaway
    FROM public.visit_participants participant
    JOIN public.visits visit ON visit.id = participant.visit_id
    JOIN public.places place ON place.id = visit.place_id
    JOIN public.visit_group_links link ON link.visit_id = visit.id
    JOIN readable_groups readable_group ON readable_group.id = link.group_id
    WHERE participant.user_id = _uid
      AND visit.meal_type <> 'dryck'
      AND visit.visited_on BETWEEN current_date - 45 AND current_date
      AND NOT EXISTS (
        SELECT 1 FROM public.reviews own_review
        WHERE own_review.visit_id = visit.id
          AND own_review.user_id = _uid
      )
    ORDER BY visit.visited_on DESC, visit.id DESC
    LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'visitId', pending.id,
      'placeId', pending.place_id,
      'placeName', pending.place_name,
      'visitedOn', pending.visited_on,
      'mealType', pending.meal_type,
      'isTakeaway', pending.is_takeaway,
      'groups', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'groupId', readable_group.id,
            'groupName', readable_group.name,
            'isArchived', readable_group.lifecycle_status = 'archived',
            'isWritable', readable_group.lifecycle_status = 'active'
          )
          ORDER BY readable_group.lifecycle_status = 'archived', lower(readable_group.name), readable_group.id
        )
        FROM public.visit_group_links link
        JOIN readable_groups readable_group ON readable_group.id = link.group_id
        WHERE link.visit_id = pending.id
      )
    )
    ORDER BY pending.visited_on DESC, pending.id DESC
  ), '[]'::jsonb)
  INTO _pending_reviews
  FROM pending;

  _favorite_places := public.list_personal_journey_places_v1(
    NULL, true, false, NULL, NULL, 4
  )->'items';
  _recent_visits := public.list_personal_journey_visits_v1(
    false, NULL, NULL, 4
  )->'items';

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'attendedVisitCount', _attended_visits,
      'attendedPlaceCount', _attended_places,
      'readableGroupCount', _readable_groups,
      'activeGroupCount', _active_groups
    ),
    'pendingReviews', _pending_reviews,
    'favoritePlaces', _favorite_places,
    'recentVisits', _recent_visits
  );
END;
$function$;


-- get_personal_journey_place_v1
CREATE OR REPLACE FUNCTION public.get_personal_journey_place_v1(_place_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
     AND group_row.lifecycle_status = 'active'
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  contexts AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'groupId', readable_group.id,
        'groupName', readable_group.name,
        'isArchived', readable_group.lifecycle_status = 'archived',
        'isWritable', readable_group.lifecycle_status = 'active',
        'isFavorite', favorite.user_id IS NOT NULL
      )
      ORDER BY readable_group.lifecycle_status = 'archived', lower(readable_group.name), readable_group.id
    ) AS groups,
    bool_or(favorite.user_id IS NOT NULL) AS is_favorite
    FROM public.group_places group_place
    JOIN readable_groups readable_group ON readable_group.id = group_place.group_id
    LEFT JOIN public.favorites favorite
      ON favorite.group_id = group_place.group_id
     AND favorite.place_id = group_place.place_id
     AND favorite.user_id = _uid
    WHERE group_place.place_id = _place_id
      AND group_place.collection_status = 'active'
  ),
  scores AS (
    SELECT DISTINCT
      review.id,
      public.personal_journey_effective_review_overall_v1(review.id) AS score
    FROM public.reviews review
    JOIN public.visits visit ON visit.id = review.visit_id
    JOIN public.review_group_visibility visibility ON visibility.review_id = review.id
    JOIN readable_groups readable_group ON readable_group.id = visibility.group_id
    WHERE visit.place_id = _place_id
      AND visit.meal_type <> 'dryck'
      AND visibility.rating_visible
  ),
  aggregate AS (
    SELECT round(avg(score), 2) AS rating, count(score)::integer AS review_count
    FROM scores
    WHERE score IS NOT NULL
  )
  SELECT jsonb_build_object(
    'id', place.id,
    'name', place.name,
    'category', place.category,
    'cuisines', place.cuisines,
    'address', place.address,
    'area', place.area,
    'city', place.city,
    'lat', place.lat,
    'lng', place.lng,
    'isFavorite', context.is_favorite,
    'rating', aggregate.rating,
    'reviewCount', aggregate.review_count,
    'groups', context.groups
  )
  INTO _result
  FROM public.places place
  CROSS JOIN contexts context
  CROSS JOIN aggregate
  WHERE place.id = _place_id
    AND context.groups IS NOT NULL;

  RETURN _result;
END;
$function$;


-- get_personal_journey_stats_v1
CREATE OR REPLACE FUNCTION public.get_personal_journey_stats_v1(_metric text DEFAULT 'visits'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _self jsonb;
  _leaderboard jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF COALESCE(_metric, '') NOT IN ('visits', 'places', 'cuisines') THEN
    RAISE EXCEPTION 'Ogiltigt statistikmått';
  END IF;

  WITH viewer_groups AS (
    SELECT membership.group_id
    FROM public.memberships membership
    JOIN public.groups group_row
      ON group_row.id = membership.group_id
     AND group_row.lifecycle_status = 'active'
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  candidates AS (
    SELECT _uid AS user_id
    UNION
    SELECT DISTINCT membership.user_id
    FROM viewer_groups viewer_group
    JOIN public.memberships membership
      ON membership.group_id = viewer_group.group_id
     AND membership.status = 'active'
  ),
  allowed_users AS (
    SELECT candidate.user_id
    FROM candidates candidate
    JOIN public.profiles profile
      ON profile.id = candidate.user_id
     AND profile.deleted_at IS NULL
    WHERE public.personal_journey_can_view_global_stats_v1(_uid, candidate.user_id)
  ),
  participation AS (
    SELECT
      allowed.user_id,
      visit.id AS visit_id,
      visit.place_id,
      place.cuisines
    FROM allowed_users allowed
    JOIN public.visit_participants participant
      ON participant.user_id = allowed.user_id
    JOIN public.visits visit
      ON visit.id = participant.visit_id
     AND EXISTS (
       SELECT 1 FROM public.visit_group_links active_link
       JOIN public.memberships active_member
         ON active_member.group_id = active_link.group_id
        AND active_member.user_id = allowed.user_id
        AND active_member.status = 'active'
       JOIN public.groups active_group
         ON active_group.id = active_link.group_id
        AND active_group.lifecycle_status = 'active'
       WHERE active_link.visit_id = visit.id
     )
    LEFT JOIN public.places place
      ON place.id = visit.place_id
  ),
  visit_counts AS (
    SELECT
      user_id,
      count(DISTINCT visit_id)::integer AS visits,
      count(DISTINCT place_id)::integer AS unique_places
    FROM participation
    GROUP BY user_id
  ),
  cuisine_counts AS (
    SELECT
      participation.user_id,
      count(DISTINCT lower(trim(cuisine.value))) FILTER (
        WHERE NULLIF(trim(cuisine.value), '') IS NOT NULL
      )::integer AS unique_cuisines
    FROM participation
    LEFT JOIN LATERAL unnest(COALESCE(participation.cuisines, ARRAY[]::text[]))
      AS cuisine(value) ON true
    GROUP BY participation.user_id
  ),
  contributing_group_counts AS (
    SELECT
      participant.user_id,
      count(DISTINCT link.group_id)::integer AS contributing_group_count
    FROM public.visit_participants participant
    JOIN public.visit_group_links link ON link.visit_id = participant.visit_id
    JOIN public.memberships membership
      ON membership.user_id = participant.user_id
     AND membership.group_id = link.group_id
     AND membership.status = 'active'
    JOIN public.groups contributing_group
      ON contributing_group.id = link.group_id
     AND contributing_group.lifecycle_status = 'active'
    GROUP BY participant.user_id
  ),
  stats AS (
    SELECT
      allowed.user_id,
      COALESCE(NULLIF(trim(profile.display_name), ''), 'Matrundare') AS display_name,
      profile.avatar_emoji,
      COALESCE(visit_count.visits, 0)::integer AS visits,
      COALESCE(visit_count.unique_places, 0)::integer AS unique_places,
      COALESCE(cuisine_count.unique_cuisines, 0)::integer AS unique_cuisines,
      COALESCE(contributing_group_count.contributing_group_count, 0)::integer AS contributing_group_count
    FROM allowed_users allowed
    JOIN public.profiles profile ON profile.id = allowed.user_id
    LEFT JOIN visit_counts visit_count ON visit_count.user_id = allowed.user_id
    LEFT JOIN cuisine_counts cuisine_count ON cuisine_count.user_id = allowed.user_id
    LEFT JOIN contributing_group_counts contributing_group_count
      ON contributing_group_count.user_id = allowed.user_id
  ),
  metric_rows AS (
    SELECT
      stats.*,
      CASE _metric
        WHEN 'visits' THEN stats.visits
        WHEN 'places' THEN stats.unique_places
        ELSE stats.unique_cuisines
      END::integer AS metric_value
    FROM stats
  ),
  ranked AS (
    SELECT
      metric.*,
      rank() OVER (ORDER BY metric.metric_value DESC)::integer AS rank
    FROM metric_rows metric
  )
  SELECT jsonb_build_object(
    'displayName', ranked.display_name,
    'avatarEmoji', ranked.avatar_emoji,
    'visits', ranked.visits,
    'uniquePlaces', ranked.unique_places,
    'uniqueCuisines', ranked.unique_cuisines,
    'groupCount', ranked.contributing_group_count
  )
  INTO _self
  FROM ranked
  WHERE ranked.user_id = _uid;

  WITH viewer_groups AS (
    SELECT membership.group_id
    FROM public.memberships membership
    JOIN public.groups group_row
      ON group_row.id = membership.group_id
     AND group_row.lifecycle_status = 'active'
    WHERE membership.user_id = _uid
      AND membership.status = 'active'
  ),
  candidates AS (
    SELECT _uid AS user_id
    UNION
    SELECT DISTINCT membership.user_id
    FROM viewer_groups viewer_group
    JOIN public.memberships membership
      ON membership.group_id = viewer_group.group_id
     AND membership.status = 'active'
  ),
  allowed_users AS (
    SELECT candidate.user_id
    FROM candidates candidate
    JOIN public.profiles profile
      ON profile.id = candidate.user_id
     AND profile.deleted_at IS NULL
    WHERE public.personal_journey_can_view_global_stats_v1(_uid, candidate.user_id)
  ),
  participation AS (
    SELECT
      allowed.user_id,
      visit.id AS visit_id,
      visit.place_id,
      place.cuisines
    FROM allowed_users allowed
    JOIN public.visit_participants participant
      ON participant.user_id = allowed.user_id
    JOIN public.visits visit
      ON visit.id = participant.visit_id
     AND EXISTS (
       SELECT 1 FROM public.visit_group_links active_link
       JOIN public.memberships active_member
         ON active_member.group_id = active_link.group_id
        AND active_member.user_id = allowed.user_id
        AND active_member.status = 'active'
       JOIN public.groups active_group
         ON active_group.id = active_link.group_id
        AND active_group.lifecycle_status = 'active'
       WHERE active_link.visit_id = visit.id
     )
    LEFT JOIN public.places place
      ON place.id = visit.place_id
  ),
  visit_counts AS (
    SELECT
      user_id,
      count(DISTINCT visit_id)::integer AS visits,
      count(DISTINCT place_id)::integer AS unique_places
    FROM participation
    GROUP BY user_id
  ),
  cuisine_counts AS (
    SELECT
      participation.user_id,
      count(DISTINCT lower(trim(cuisine.value))) FILTER (
        WHERE NULLIF(trim(cuisine.value), '') IS NOT NULL
      )::integer AS unique_cuisines
    FROM participation
    LEFT JOIN LATERAL unnest(COALESCE(participation.cuisines, ARRAY[]::text[]))
      AS cuisine(value) ON true
    GROUP BY participation.user_id
  ),
  contributing_group_counts AS (
    SELECT
      participant.user_id,
      count(DISTINCT link.group_id)::integer AS contributing_group_count
    FROM public.visit_participants participant
    JOIN public.visit_group_links link ON link.visit_id = participant.visit_id
    JOIN public.memberships membership
      ON membership.user_id = participant.user_id
     AND membership.group_id = link.group_id
     AND membership.status = 'active'
    JOIN public.groups contributing_group
      ON contributing_group.id = link.group_id
     AND contributing_group.lifecycle_status = 'active'
    GROUP BY participant.user_id
  ),
  metric_rows AS (
    SELECT
      allowed.user_id,
      COALESCE(NULLIF(trim(profile.display_name), ''), 'Matrundare') AS display_name,
      profile.avatar_emoji,
      COALESCE(visit_count.visits, 0)::integer AS visits,
      COALESCE(visit_count.unique_places, 0)::integer AS unique_places,
      COALESCE(cuisine_count.unique_cuisines, 0)::integer AS unique_cuisines,
      COALESCE(contributing_group_count.contributing_group_count, 0)::integer AS contributing_group_count,
      CASE _metric
        WHEN 'visits' THEN COALESCE(visit_count.visits, 0)
        WHEN 'places' THEN COALESCE(visit_count.unique_places, 0)
        ELSE COALESCE(cuisine_count.unique_cuisines, 0)
      END::integer AS metric_value
    FROM allowed_users allowed
    JOIN public.profiles profile ON profile.id = allowed.user_id
    LEFT JOIN visit_counts visit_count ON visit_count.user_id = allowed.user_id
    LEFT JOIN cuisine_counts cuisine_count ON cuisine_count.user_id = allowed.user_id
    LEFT JOIN contributing_group_counts contributing_group_count
      ON contributing_group_count.user_id = allowed.user_id
  ),
  ranked AS (
    SELECT
      metric.*,
      rank() OVER (ORDER BY metric.metric_value DESC)::integer AS rank
    FROM metric_rows metric
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'displayName', ranked.display_name,
        'avatarEmoji', ranked.avatar_emoji,
        'visits', ranked.visits,
        'uniquePlaces', ranked.unique_places,
        'uniqueCuisines', ranked.unique_cuisines,
        'groupCount', ranked.contributing_group_count,
        'isSelf', ranked.user_id = _uid,
        'rank', ranked.rank,
        'value', ranked.metric_value
      )
      ORDER BY ranked.metric_value DESC, lower(ranked.display_name), ranked.user_id
    ),
    '[]'::jsonb
  )
  INTO _leaderboard
  FROM ranked;

  RETURN jsonb_build_object(
    'self', COALESCE(_self, jsonb_build_object(
      'displayName', 'Matrundare',
      'avatarEmoji', NULL,
      'visits', 0,
      'uniquePlaces', 0,
      'uniqueCuisines', 0,
      'groupCount', 0
    )),
    'leaderboard', _leaderboard
  );
END;
$function$;


-- get_personal_journey_toplist_v1
CREATE OR REPLACE FUNCTION public.get_personal_journey_toplist_v1(_query text DEFAULT NULL::text, _occasions text[] DEFAULT ARRAY[]::text[], _meal_types text[] DEFAULT ARRAY[]::text[], _takeaway_only boolean DEFAULT false, _cursor jsonb DEFAULT NULL::jsonb, _limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
     AND group_row.lifecycle_status = 'active'
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


-- get_personal_journey_visit_v1
CREATE OR REPLACE FUNCTION public.get_personal_journey_visit_v1(_visit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
     AND group_row.lifecycle_status = 'active'
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


-- list_personal_journey_places_v1
CREATE OR REPLACE FUNCTION public.list_personal_journey_places_v1(_query text DEFAULT NULL::text, _favorites_only boolean DEFAULT false, _visited_by_me_only boolean DEFAULT false, _cursor_name text DEFAULT NULL::text, _cursor_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _page_size integer := LEAST(GREATEST(COALESCE(_limit, 20), 1), 50);
  _normalized_query text := NULLIF(trim(COALESCE(_query, '')), '');
  _items jsonb;
  _next_cursor jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF (_cursor_name IS NULL) <> (_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'Ogiltig cursor';
  END IF;

  WITH readable_groups AS (
    SELECT group_row.id, group_row.name, group_row.lifecycle_status
    FROM public.memberships membership
    JOIN public.groups group_row ON group_row.id = membership.group_id
     AND group_row.lifecycle_status = 'active'
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
      context.group_contexts
    FROM place_contexts context
    JOIN public.places place ON place.id = context.place_id
    LEFT JOIN own_visits own_visit ON own_visit.place_id = place.id
    LEFT JOIN review_aggregates aggregate ON aggregate.place_id = place.id
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
        _cursor_name IS NULL
        OR (lower(place.name), place.id) > (lower(_cursor_name), _cursor_id)
      )
    ORDER BY lower(place.name), place.id
    LIMIT _page_size + 1
  ),
  numbered_rows AS (
    SELECT candidate.*, row_number() OVER (ORDER BY lower(candidate.name), candidate.id) AS row_number
    FROM candidate_rows candidate
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
        ORDER BY lower(name), id
      ) FILTER (WHERE row_number <= _page_size),
      '[]'::jsonb
    ),
    (
      jsonb_agg(
        jsonb_build_object('name', lag_name, 'id', lag_id)
      ) FILTER (WHERE row_number = _page_size + 1)
    )->0
  INTO _items, _next_cursor
  FROM (
    SELECT
      numbered_rows.*,
      lag(name) OVER (ORDER BY lower(name), id) AS lag_name,
      lag(id) OVER (ORDER BY lower(name), id) AS lag_id
    FROM numbered_rows
  ) page;

  RETURN jsonb_build_object('items', _items, 'nextCursor', _next_cursor);
END;
$function$;


-- list_personal_journey_places_v2
CREATE OR REPLACE FUNCTION public.list_personal_journey_places_v2(_query text DEFAULT NULL::text, _favorites_only boolean DEFAULT false, _visited_by_me_only boolean DEFAULT false, _sort text DEFAULT 'rating'::text, _cursor jsonb DEFAULT NULL::jsonb, _limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
     AND group_row.lifecycle_status = 'active'
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


-- list_personal_journey_visits_v1
CREATE OR REPLACE FUNCTION public.list_personal_journey_visits_v1(_participated_only boolean DEFAULT false, _cursor_visited_on date DEFAULT NULL::date, _cursor_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
     AND group_row.lifecycle_status = 'active'
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


-- Behåll befintliga explicit tillåtna roller efter funktionsersättningen.
REVOKE ALL ON FUNCTION public.get_personal_journey_overview_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_overview_v1() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_personal_journey_place_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_place_v1(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_personal_journey_stats_v1(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_stats_v1(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_personal_journey_toplist_v1(text,text[],text[],boolean,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_toplist_v1(text,text[],text[],boolean,jsonb,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_personal_journey_visit_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_visit_v1(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_personal_journey_places_v1(text,boolean,boolean,text,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_personal_journey_places_v1(text,boolean,boolean,text,uuid,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_personal_journey_places_v2(text,boolean,boolean,text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_personal_journey_places_v2(text,boolean,boolean,text,jsonb,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_personal_journey_visits_v1(boolean,date,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_personal_journey_visits_v1(boolean,date,uuid,integer) TO authenticated, service_role;

COMMIT;
