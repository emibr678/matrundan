BEGIN;

-- Issue #109 — Min matresa.
--
-- Read-modellen sammanställer endast data från grupper där auth.uid() har ett
-- aktuellt medlemskap. Klienten skickar varken användar-id eller grupplista.
-- Kanoniska platser, besök och omdömen dedupliceras före presentation.

-- Favoriten är gruppspecifik. Den ursprungliga tvåkolumnsnyckeln hindrade
-- samma användare från att markera samma kanoniska plats i flera grupper.
ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_pkey;
ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, place_id, group_id);

-- Riktade index för read-modellens faktiska join- och cursorvägar.
CREATE INDEX IF NOT EXISTS visit_participants_user_visit_idx
  ON public.visit_participants(user_id, visit_id);
CREATE INDEX IF NOT EXISTS review_group_visibility_group_review_idx
  ON public.review_group_visibility(group_id, review_id);
CREATE INDEX IF NOT EXISTS visits_personal_journey_cursor_idx
  ON public.visits(visited_on DESC, id DESC);

-- Även bilden i ursprungsgruppen behöver en opaque leveransnyckel i den
-- personliga linsen. Den befintliga leveransresolven validerar medlemskapet vid
-- varje hämtning, så samma modell kan återanvändas utan rå Storage-path.
CREATE OR REPLACE FUNCTION public.ensure_personal_journey_media_visibility_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.visit_media_group_visibility (
    media_id,
    visit_id,
    group_id,
    granted_by
  ) VALUES (
    NEW.id,
    NEW.visit_id,
    NEW.group_id,
    NEW.uploaded_by
  )
  ON CONFLICT (media_id, group_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_personal_journey_media_visibility_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_visit_media_personal_journey_visibility ON public.visit_media;
CREATE TRIGGER trg_visit_media_personal_journey_visibility
  AFTER INSERT OR UPDATE OF visit_id, group_id, uploaded_by ON public.visit_media
  FOR EACH ROW EXECUTE FUNCTION public.ensure_personal_journey_media_visibility_v1();

INSERT INTO public.visit_media_group_visibility (
  media_id,
  visit_id,
  group_id,
  granted_by
)
SELECT media.id, media.visit_id, media.group_id, media.uploaded_by
FROM public.visit_media media
ON CONFLICT (media_id, group_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.personal_journey_effective_review_overall_v1(
  _review_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN visit.meal_type = 'dryck' THEN NULL
    WHEN review.review_model = 'food_v1_atmosphere'
      AND NOT visit.is_takeaway
      AND review.taste IS NOT NULL
      AND review.value IS NOT NULL
      AND review.service IS NOT NULL
      AND review.atmosphere IS NOT NULL
      THEN round(
        (review.taste + review.value + review.service + review.atmosphere)::numeric / 4,
        2
      )
    WHEN review.review_model IN (
      'food_v0_3d',
      'food_v1_takeaway',
      'food_v1_quick',
      'food_v1_atmosphere'
    )
      AND review.taste IS NOT NULL
      AND review.value IS NOT NULL
      AND review.service IS NOT NULL
      THEN round((review.taste + review.value + review.service)::numeric / 3, 2)
    ELSE review.overall
  END
  FROM public.reviews review
  JOIN public.visits visit ON visit.id = review.visit_id
  WHERE review.id = _review_id;
$function$;

CREATE OR REPLACE FUNCTION public.list_personal_journey_places_v1(
  _query text DEFAULT NULL,
  _favorites_only boolean DEFAULT false,
  _visited_by_me_only boolean DEFAULT false,
  _cursor_name text DEFAULT NULL,
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

CREATE OR REPLACE FUNCTION public.get_personal_journey_place_v1(_place_id uuid)
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
     AND EXISTS (SELECT 1 FROM readable_groups readable_group WHERE readable_group.id = visibility.group_id)
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
  photo_payload AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'deliveryToken', visibility.delivery_token,
        'mimeType', media.mime_type,
        'byteSize', media.byte_size,
        'width', media.width,
        'height', media.height,
        'createdAt', media.created_at,
        'isOwn', media.uploaded_by = _uid
      )
      ORDER BY media.created_at, media.id
    ), '[]'::jsonb) AS photos
    FROM public.visit_media_group_visibility visibility
    JOIN public.visit_media media
      ON media.id = visibility.media_id
     AND media.visit_id = visibility.visit_id
    WHERE visibility.visit_id = _visit_id
      AND EXISTS (
        SELECT 1 FROM readable_groups readable_group
        WHERE readable_group.id = visibility.group_id
      )
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

CREATE OR REPLACE FUNCTION public.get_personal_journey_overview_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.personal_journey_effective_review_overall_v1(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_personal_journey_places_v1(text, boolean, boolean, text, uuid, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_personal_journey_place_v1(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_personal_journey_visits_v1(boolean, date, uuid, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_personal_journey_visit_v1(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_personal_journey_overview_v1()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_personal_journey_places_v1(text, boolean, boolean, text, uuid, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_place_v1(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_personal_journey_visits_v1(boolean, date, uuid, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_visit_v1(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_overview_v1()
  TO authenticated, service_role;

COMMIT;
