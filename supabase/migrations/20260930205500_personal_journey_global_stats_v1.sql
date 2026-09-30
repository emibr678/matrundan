-- Issue #109 — global, lågupplöst personstatistik för Min matresa.
--
-- Integritetsgräns:
-- - den egna statistiken är alltid läsbar för användaren själv;
-- - annan persons totalsiffror får bara visas när användarna delar minst en aktiv grupp;
-- - inga gruppnamn, ställen, besök, betyg, kommentarer eller bilder exponeras här;
-- - helpern är den avsedda framtida hooken för opt-out.
BEGIN;

CREATE OR REPLACE FUNCTION public.personal_journey_can_view_global_stats_v1(
  _viewer_id uuid,
  _subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    _viewer_id = _subject_id
    OR EXISTS (
      SELECT 1
      FROM public.memberships viewer_membership
      JOIN public.groups shared_group
        ON shared_group.id = viewer_membership.group_id
       AND shared_group.lifecycle_status = 'active'
      JOIN public.memberships subject_membership
        ON subject_membership.group_id = viewer_membership.group_id
       AND subject_membership.user_id = _subject_id
       AND subject_membership.status = 'active'
      WHERE viewer_membership.user_id = _viewer_id
        AND viewer_membership.status = 'active'
    );
$function$;

REVOKE ALL ON FUNCTION public.personal_journey_can_view_global_stats_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_personal_journey_stats_v1(
  _metric text DEFAULT 'visits'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  active_group_counts AS (
    SELECT
      membership.user_id,
      count(DISTINCT membership.group_id)::integer AS active_group_count
    FROM public.memberships membership
    JOIN public.groups group_row
      ON group_row.id = membership.group_id
     AND group_row.lifecycle_status = 'active'
    WHERE membership.status = 'active'
    GROUP BY membership.user_id
  ),
  stats AS (
    SELECT
      allowed.user_id,
      COALESCE(NULLIF(trim(profile.display_name), ''), 'Matrundare') AS display_name,
      profile.avatar_emoji,
      COALESCE(visit_count.visits, 0)::integer AS visits,
      COALESCE(visit_count.unique_places, 0)::integer AS unique_places,
      COALESCE(cuisine_count.unique_cuisines, 0)::integer AS unique_cuisines,
      COALESCE(active_group_count.active_group_count, 0)::integer AS active_group_count
    FROM allowed_users allowed
    JOIN public.profiles profile ON profile.id = allowed.user_id
    LEFT JOIN visit_counts visit_count ON visit_count.user_id = allowed.user_id
    LEFT JOIN cuisine_counts cuisine_count ON cuisine_count.user_id = allowed.user_id
    LEFT JOIN active_group_counts active_group_count ON active_group_count.user_id = allowed.user_id
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
    'groupCount', ranked.active_group_count
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
  metric_rows AS (
    SELECT
      allowed.user_id,
      COALESCE(NULLIF(trim(profile.display_name), ''), 'Matrundare') AS display_name,
      profile.avatar_emoji,
      COALESCE(visit_count.visits, 0)::integer AS visits,
      COALESCE(visit_count.unique_places, 0)::integer AS unique_places,
      COALESCE(cuisine_count.unique_cuisines, 0)::integer AS unique_cuisines,
      CASE _metric
        WHEN 'visits' THEN COALESCE(visit_count.visits, 0)
        WHEN 'places' THEN COALESCE(visit_count.unique_places, 0)
        ELSE COALESCE(cuisine_count.unique_cuisines, 0)
      END::integer AS metric_value
    FROM allowed_users allowed
    JOIN public.profiles profile ON profile.id = allowed.user_id
    LEFT JOIN visit_counts visit_count ON visit_count.user_id = allowed.user_id
    LEFT JOIN cuisine_counts cuisine_count ON cuisine_count.user_id = allowed.user_id
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

REVOKE ALL ON FUNCTION public.get_personal_journey_stats_v1(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_journey_stats_v1(text)
  TO authenticated, service_role;

COMMIT;
