BEGIN;

-- Issue #163: en global arbetsyta, fortsatt separata backendkällor.
-- Den gemensamma kön projicerar endast neutral, handläggningsrelevant data från
-- förbättringskandidater och platsdatarapporter. Grupp, rapportör och privat
-- fritext lämnar aldrig detta serverkontrakt.

CREATE TABLE public.place_maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_kind text NOT NULL,
  work_item_id uuid NOT NULL,
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_maintenance_events_kind_check CHECK (
    work_item_kind IN ('improvement_candidate', 'reported_error')
  ),
  CONSTRAINT place_maintenance_events_action_check CHECK (
    action IN ('marked_needs_osm', 'dismissed', 'resolved', 'provider_source_linked')
  )
);

ALTER TABLE public.place_maintenance_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.place_maintenance_events FROM PUBLIC, anon, authenticated;

CREATE INDEX place_maintenance_events_item_idx
  ON public.place_maintenance_events(work_item_kind, work_item_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.list_place_maintenance_work_items_v1(
  _status text DEFAULT NULL,
  _kind text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
  _safe_limit integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 100);
  _safe_offset integer := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('open', 'needs_osm', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Ogiltigt underhållsfilter';
  END IF;
  IF _kind IS NOT NULL AND _kind NOT IN ('improvement_candidate', 'reported_error') THEN
    RAISE EXCEPTION 'Ogiltig typ av underhållsärende';
  END IF;

  WITH candidate_items AS (
    SELECT
      c.id AS work_item_id,
      'improvement_candidate'::text AS kind,
      'canonical_place'::text AS target_kind,
      c.place_id,
      c.reason AS issue_category,
      c.status,
      c.created_at,
      COALESCE(c.resolved_at, c.created_at) AS updated_at,
      c.resolved_at,
      c.dismissal_reason,
      p.name,
      p.category,
      COALESCE(p.address, '') AS address,
      p.area,
      COALESCE(p.city, '') AS city,
      p.lat,
      p.lng,
      p.website,
      NULL::text AS external_provider,
      NULL::text AS external_provider_place_id,
      NULL::text AS osm_submission_state,
      NULL::text AS osm_note_url,
      NULL::text AS osm_note_status
    FROM public.place_improvement_candidates c
    JOIN public.places p ON p.id = c.place_id
  ), report_items AS (
    SELECT
      r.id AS work_item_id,
      'reported_error'::text AS kind,
      CASE WHEN r.place_id IS NULL THEN 'provider_suggestion' ELSE 'canonical_place' END AS target_kind,
      r.place_id,
      r.category AS issue_category,
      CASE r.status WHEN 'ready_for_osm' THEN 'needs_osm' ELSE r.status END AS status,
      r.created_at,
      r.updated_at,
      CASE WHEN r.status IN ('resolved', 'dismissed') THEN COALESCE(r.reviewed_at, r.updated_at) ELSE NULL END AS resolved_at,
      NULL::text AS dismissal_reason,
      CASE WHEN r.place_id IS NULL THEN r.reported_name ELSE p.name END AS name,
      CASE WHEN r.place_id IS NULL THEN NULL ELSE p.category END AS category,
      CASE WHEN r.place_id IS NULL THEN COALESCE(r.reported_address, '') ELSE COALESCE(p.address, '') END AS address,
      CASE WHEN r.place_id IS NULL THEN NULL ELSE p.area END AS area,
      CASE WHEN r.place_id IS NULL THEN COALESCE(r.reported_city, '') ELSE COALESCE(p.city, '') END AS city,
      CASE WHEN r.place_id IS NULL THEN r.reported_lat ELSE p.lat END AS lat,
      CASE WHEN r.place_id IS NULL THEN r.reported_lng ELSE p.lng END AS lng,
      CASE WHEN r.place_id IS NULL THEN r.reported_website ELSE p.website END AS website,
      CASE WHEN r.place_id IS NULL THEN r.target_provider ELSE NULL END AS external_provider,
      CASE WHEN r.place_id IS NULL THEN r.target_provider_place_id ELSE NULL END AS external_provider_place_id,
      r.osm_submission_state::text,
      r.osm_note_url,
      r.osm_note_status::text
    FROM public.place_data_reports r
    LEFT JOIN public.places p ON p.id = r.place_id
  ), unioned AS (
    SELECT * FROM candidate_items
    UNION ALL
    SELECT * FROM report_items
  ), filtered AS (
    SELECT
      i.*,
      active_source.provider AS source_provider,
      active_source.provider_place_id AS source_provider_place_id
    FROM unioned i
    LEFT JOIN LATERAL (
      SELECT ps.provider, ps.provider_place_id
      FROM public.place_sources ps
      WHERE ps.place_id = i.place_id
        AND ps.status = 'active'
      ORDER BY CASE ps.provider WHEN 'openstreetmap' THEN 0 ELSE 1 END, ps.valid_from DESC
      LIMIT 1
    ) active_source ON true
    WHERE (_status IS NULL OR i.status = _status)
      AND (_kind IS NULL OR i.kind = _kind)
  ), page AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE status WHEN 'open' THEN 0 WHEN 'needs_osm' THEN 1 ELSE 2 END,
      updated_at DESC,
      work_item_id
    LIMIT _safe_limit
    OFFSET _safe_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'workItemId', page.work_item_id,
          'kind', page.kind,
          'targetKind', page.target_kind,
          'placeId', page.place_id,
          'issueCategory', page.issue_category,
          'status', page.status,
          'createdAt', page.created_at,
          'updatedAt', page.updated_at,
          'resolvedAt', page.resolved_at,
          'dismissalReason', page.dismissal_reason,
          'name', page.name,
          'category', page.category,
          'address', page.address,
          'area', page.area,
          'city', page.city,
          'lat', page.lat,
          'lng', page.lng,
          'website', page.website,
          'activeSource', CASE
            WHEN page.source_provider IS NULL THEN NULL
            ELSE jsonb_build_object(
              'provider', page.source_provider,
              'providerPlaceId', page.source_provider_place_id
            )
          END,
          'externalReference', CASE
            WHEN page.external_provider IS NULL THEN NULL
            ELSE jsonb_build_object(
              'provider', page.external_provider,
              'providerPlaceId', page.external_provider_place_id
            )
          END,
          'osmNote', CASE
            WHEN page.osm_note_url IS NULL AND page.osm_submission_state IS NULL THEN NULL
            ELSE jsonb_build_object(
              'submissionState', page.osm_submission_state,
              'url', page.osm_note_url,
              'status', page.osm_note_status
            )
          END
        )
        ORDER BY
          CASE page.status WHEN 'open' THEN 0 WHEN 'needs_osm' THEN 1 ELSE 2 END,
          page.updated_at DESC,
          page.work_item_id
      )
      FROM page
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'limit', _safe_limit,
    'offset', _safe_offset
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_place_maintenance_work_items_v1(text, text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_place_maintenance_work_items_v1(text, text, integer, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_place_maintenance_work_item_needs_osm_v1(
  _kind text,
  _work_item_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
  _place_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;

  IF _kind = 'improvement_candidate' THEN
    SELECT status, place_id INTO _status, _place_id
    FROM public.place_improvement_candidates
    WHERE id = _work_item_id
    FOR UPDATE;

    IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
    IF _status = 'needs_osm' THEN RETURN 'needs_osm'; END IF;
    IF _status <> 'open' THEN RAISE EXCEPTION 'Underhållsärendet är redan avslutat'; END IF;

    UPDATE public.place_improvement_candidates
    SET status = 'needs_osm', dismissal_reason = NULL, resolved_at = NULL, resolution = NULL
    WHERE id = _work_item_id;

    INSERT INTO public.place_improvement_candidate_events(candidate_id, action, actor_id)
    VALUES (_work_item_id, 'marked_needs_osm', _uid);
  ELSIF _kind = 'reported_error' THEN
    SELECT status, place_id INTO _status, _place_id
    FROM public.place_data_reports
    WHERE id = _work_item_id
    FOR UPDATE;

    IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
    IF _status = 'ready_for_osm' THEN RETURN 'needs_osm'; END IF;
    IF _status <> 'open' THEN RAISE EXCEPTION 'Underhållsärendet är redan avslutat'; END IF;

    UPDATE public.place_data_reports
    SET status = 'ready_for_osm',
        reviewed_by = _uid,
        reviewed_at = now(),
        updated_at = now(),
        resolution_note = NULL
    WHERE id = _work_item_id;
  ELSE
    RAISE EXCEPTION 'Ogiltig typ av underhållsärende';
  END IF;

  INSERT INTO public.place_maintenance_events(work_item_kind, work_item_id, place_id, action, actor_id)
  VALUES (_kind, _work_item_id, _place_id, 'marked_needs_osm', _uid);

  RETURN 'needs_osm';
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_place_maintenance_work_item_needs_osm_v1(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_place_maintenance_work_item_needs_osm_v1(text, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_place_maintenance_work_item_v1(
  _kind text,
  _work_item_id uuid,
  _reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
  _place_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;
  IF _reason IS NULL OR _reason NOT IN (
    'not_relevant', 'insufficient_evidence', 'not_food_place', 'already_handled'
  ) THEN
    RAISE EXCEPTION 'Ogiltig avfärdandeorsak';
  END IF;

  IF _kind = 'improvement_candidate' THEN
    SELECT status, place_id INTO _status, _place_id
    FROM public.place_improvement_candidates
    WHERE id = _work_item_id
    FOR UPDATE;

    IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
    IF _status NOT IN ('open', 'needs_osm') THEN RAISE EXCEPTION 'Underhållsärendet är redan avslutat'; END IF;

    UPDATE public.place_improvement_candidates
    SET status = 'dismissed', dismissal_reason = _reason, resolved_at = now(), resolution = NULL
    WHERE id = _work_item_id;

    INSERT INTO public.place_improvement_candidate_events(candidate_id, action, actor_id, metadata)
    VALUES (_work_item_id, 'dismissed', _uid, jsonb_build_object('reason', _reason));
  ELSIF _kind = 'reported_error' THEN
    SELECT status, place_id INTO _status, _place_id
    FROM public.place_data_reports
    WHERE id = _work_item_id
    FOR UPDATE;

    IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
    IF _status NOT IN ('open', 'ready_for_osm') THEN RAISE EXCEPTION 'Underhållsärendet är redan avslutat'; END IF;

    UPDATE public.place_data_reports
    SET status = 'dismissed',
        reviewed_by = _uid,
        reviewed_at = now(),
        updated_at = now(),
        resolution_note = NULL
    WHERE id = _work_item_id;
  ELSE
    RAISE EXCEPTION 'Ogiltig typ av underhållsärende';
  END IF;

  INSERT INTO public.place_maintenance_events(work_item_kind, work_item_id, place_id, action, actor_id, metadata)
  VALUES (_kind, _work_item_id, _place_id, 'dismissed', _uid, jsonb_build_object('reason', _reason));

  RETURN 'dismissed';
END;
$function$;

REVOKE ALL ON FUNCTION public.dismiss_place_maintenance_work_item_v1(text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_place_maintenance_work_item_v1(text, uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_place_maintenance_work_item_v1(
  _kind text,
  _work_item_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
  _place_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;
  IF _kind <> 'reported_error' THEN
    RAISE EXCEPTION 'Förbättringskandidater löses genom extern källkoppling eller avfärdande';
  END IF;

  SELECT status, place_id INTO _status, _place_id
  FROM public.place_data_reports
  WHERE id = _work_item_id
  FOR UPDATE;

  IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
  IF _status = 'resolved' THEN RETURN 'resolved'; END IF;
  IF _status = 'dismissed' THEN RAISE EXCEPTION 'Underhållsärendet är redan avfärdat'; END IF;

  UPDATE public.place_data_reports
  SET status = 'resolved',
      reviewed_by = _uid,
      reviewed_at = now(),
      updated_at = now(),
      resolution_note = NULL
  WHERE id = _work_item_id;

  INSERT INTO public.place_maintenance_events(work_item_kind, work_item_id, place_id, action, actor_id)
  VALUES (_kind, _work_item_id, _place_id, 'resolved', _uid);

  RETURN 'resolved';
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_place_maintenance_work_item_v1(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_place_maintenance_work_item_v1(text, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.link_provider_source_for_maintenance_work_item_v1(
  _kind text,
  _work_item_id uuid,
  _provider text,
  _provider_place_id text,
  _name text,
  _address text,
  _city text,
  _lat double precision,
  _lng double precision,
  _raw jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;
  IF _kind <> 'improvement_candidate' THEN
    RAISE EXCEPTION 'Extern källkoppling stöds bara för förbättringskandidater i denna version';
  END IF;

  _place_id := public.link_provider_source_for_maintenance_v1(
    _work_item_id,
    _provider,
    _provider_place_id,
    _name,
    _address,
    _city,
    _lat,
    _lng,
    _raw
  );

  INSERT INTO public.place_maintenance_events(
    work_item_kind, work_item_id, place_id, action, actor_id, metadata
  ) VALUES (
    _kind,
    _work_item_id,
    _place_id,
    'provider_source_linked',
    _uid,
    jsonb_build_object('provider', _provider, 'providerPlaceId', _provider_place_id)
  );

  RETURN _place_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_provider_source_for_maintenance_work_item_v1(
  text, uuid, text, text, text, text, text, double precision, double precision, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_provider_source_for_maintenance_work_item_v1(
  text, uuid, text, text, text, text, text, double precision, double precision, jsonb
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
