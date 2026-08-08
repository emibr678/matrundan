BEGIN;

-- Issue #163: global, neutral platsunderhållsyta för förbättringskandidater.
-- Behörigheten är avsiktligt separat från grupproller och ger ingen generell
-- läsrätt till gruppdata.

CREATE TABLE public.place_maintainers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.place_maintainers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.place_maintainers FROM PUBLIC, anon, authenticated;

ALTER TABLE public.place_improvement_candidates
  DROP CONSTRAINT IF EXISTS place_improvement_candidates_status_check;

ALTER TABLE public.place_improvement_candidates
  ADD CONSTRAINT place_improvement_candidates_status_check CHECK (
    status IN ('open', 'needs_osm', 'resolved', 'dismissed')
  );

ALTER TABLE public.place_improvement_candidates
  ADD COLUMN dismissal_reason text;

ALTER TABLE public.place_improvement_candidates
  ADD CONSTRAINT place_improvement_candidates_dismissal_reason_check CHECK (
    dismissal_reason IS NULL OR dismissal_reason IN (
      'not_relevant',
      'insufficient_evidence',
      'not_food_place',
      'already_handled'
    )
  );

DROP INDEX IF EXISTS public.place_improvement_candidates_open_uidx;
CREATE UNIQUE INDEX place_improvement_candidates_unresolved_uidx
  ON public.place_improvement_candidates(group_id, place_id, reason)
  WHERE status IN ('open', 'needs_osm');

CREATE INDEX place_improvement_candidates_maintenance_status_idx
  ON public.place_improvement_candidates(status, created_at DESC);

CREATE TABLE public.place_improvement_candidate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.place_improvement_candidates(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_improvement_candidate_events_action_check CHECK (
    action IN (
      'marked_needs_osm',
      'dismissed',
      'provider_source_linked',
      'resolved_active_source'
    )
  )
);

ALTER TABLE public.place_improvement_candidate_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.place_improvement_candidate_events FROM PUBLIC, anon, authenticated;

CREATE INDEX place_improvement_candidate_events_candidate_idx
  ON public.place_improvement_candidate_events(candidate_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_place_maintenance_access_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.place_maintainers pm
      WHERE pm.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.get_place_maintenance_access_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_place_maintenance_access_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_place_improvement_candidates_for_maintenance_v1(
  _status text DEFAULT NULL,
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
  IF _status IS NOT NULL
     AND _status NOT IN ('open', 'needs_osm', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Ogiltigt underhållsfilter';
  END IF;

  WITH filtered AS (
    SELECT
      c.id AS candidate_id,
      c.place_id,
      c.reason,
      c.status,
      c.created_at,
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
      active_source.provider AS source_provider,
      active_source.provider_place_id AS source_provider_place_id
    FROM public.place_improvement_candidates c
    JOIN public.places p ON p.id = c.place_id
    LEFT JOIN LATERAL (
      SELECT ps.provider, ps.provider_place_id
      FROM public.place_sources ps
      WHERE ps.place_id = c.place_id
        AND ps.status = 'active'
      ORDER BY CASE ps.provider WHEN 'openstreetmap' THEN 0 ELSE 1 END, ps.valid_from DESC
      LIMIT 1
    ) active_source ON true
    WHERE _status IS NULL OR c.status = _status
  ), page AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE status WHEN 'open' THEN 0 WHEN 'needs_osm' THEN 1 ELSE 2 END,
      created_at DESC,
      candidate_id
    LIMIT _safe_limit
    OFFSET _safe_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'candidateId', page.candidate_id,
            'placeId', page.place_id,
            'reason', page.reason,
            'status', page.status,
            'createdAt', page.created_at,
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
            END
          )
          ORDER BY
            CASE page.status WHEN 'open' THEN 0 WHEN 'needs_osm' THEN 1 ELSE 2 END,
            page.created_at DESC,
            page.candidate_id
        )
        FROM page
      ),
      '[]'::jsonb
    ),
    'total', (SELECT count(*) FROM filtered),
    'limit', _safe_limit,
    'offset', _safe_offset
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_place_improvement_candidates_for_maintenance_v1(text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_place_improvement_candidates_for_maintenance_v1(text, integer, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_place_improvement_candidate_for_maintenance_v1(
  _candidate_id uuid
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;

  SELECT jsonb_build_object(
    'candidateId', c.id,
    'placeId', c.place_id,
    'reason', c.reason,
    'status', c.status,
    'createdAt', c.created_at,
    'resolvedAt', c.resolved_at,
    'dismissalReason', c.dismissal_reason,
    'name', p.name,
    'category', p.category,
    'address', COALESCE(p.address, ''),
    'area', p.area,
    'city', COALESCE(p.city, ''),
    'lat', p.lat,
    'lng', p.lng,
    'website', p.website
  )
  INTO _result
  FROM public.place_improvement_candidates c
  JOIN public.places p ON p.id = c.place_id
  WHERE c.id = _candidate_id;

  IF _result IS NULL THEN
    RAISE EXCEPTION 'Underhållsärendet finns inte';
  END IF;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_place_improvement_candidate_for_maintenance_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_place_improvement_candidate_for_maintenance_v1(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_place_improvement_candidate_needs_osm_v1(
  _candidate_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;

  SELECT status INTO _status
  FROM public.place_improvement_candidates
  WHERE id = _candidate_id
  FOR UPDATE;

  IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
  IF _status = 'needs_osm' THEN RETURN _status; END IF;
  IF _status <> 'open' THEN
    RAISE EXCEPTION 'Endast öppna underhållsärenden kan markeras för OSM-åtgärd';
  END IF;

  UPDATE public.place_improvement_candidates
  SET status = 'needs_osm',
      dismissal_reason = NULL,
      resolved_at = NULL,
      resolution = NULL
  WHERE id = _candidate_id;

  INSERT INTO public.place_improvement_candidate_events(candidate_id, action, actor_id)
  VALUES (_candidate_id, 'marked_needs_osm', _uid);

  RETURN 'needs_osm';
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_place_improvement_candidate_needs_osm_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_place_improvement_candidate_needs_osm_v1(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_place_improvement_candidate_v1(
  _candidate_id uuid,
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;
  IF _reason NOT IN ('not_relevant', 'insufficient_evidence', 'not_food_place', 'already_handled') THEN
    RAISE EXCEPTION 'Ogiltig avfärdandeorsak';
  END IF;

  SELECT status INTO _status
  FROM public.place_improvement_candidates
  WHERE id = _candidate_id
  FOR UPDATE;

  IF _status IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
  IF _status NOT IN ('open', 'needs_osm') THEN
    RAISE EXCEPTION 'Underhållsärendet är redan avslutat';
  END IF;

  UPDATE public.place_improvement_candidates
  SET status = 'dismissed',
      dismissal_reason = _reason,
      resolved_at = now(),
      resolution = NULL
  WHERE id = _candidate_id;

  INSERT INTO public.place_improvement_candidate_events(candidate_id, action, actor_id, metadata)
  VALUES (_candidate_id, 'dismissed', _uid, jsonb_build_object('reason', _reason));

  RETURN 'dismissed';
END;
$function$;

REVOKE ALL ON FUNCTION public.dismiss_place_improvement_candidate_v1(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_place_improvement_candidate_v1(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.link_provider_source_for_maintenance_v1(
  _candidate_id uuid,
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
  _provider_normalized text := lower(trim(COALESCE(_provider, '')));
  _provider_id_normalized text := trim(COALESCE(_provider_place_id, ''));
  _candidate_status text;
  _place_id uuid;
  _place_name text;
  _place_address text;
  _place_city text;
  _place_lat double precision;
  _place_lng double precision;
  _target_name text;
  _target_address text;
  _target_city text;
  _incoming_name text := public.normalize_place_match_text_v1(_name);
  _incoming_address text := public.normalize_place_match_text_v1(_address);
  _incoming_city text := public.normalize_place_match_text_v1(_city);
  _same_name boolean;
  _related_name boolean;
  _same_address boolean;
  _distance_term double precision;
  _distance_km double precision;
  _osm_type text;
  _osm_id text := trim(COALESCE(_raw->>'osmId', _raw->>'osm_id', ''));
  _osm_source_id text;
  _website text := public.normalize_place_website(_raw->>'website');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.place_maintainers pm WHERE pm.user_id = _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet till Platsunderhåll';
  END IF;
  IF _provider_normalized <> 'geoapify' OR _provider_id_normalized = '' THEN
    RAISE EXCEPTION 'Okänd eller ofullständig platsleverantör';
  END IF;
  IF _incoming_name = '' THEN RAISE EXCEPTION 'Sökträffens namn saknas'; END IF;
  IF _lat IS NULL OR _lng IS NULL OR _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Sökträffens kartposition är ogiltig';
  END IF;

  SELECT c.status, c.place_id, p.name, COALESCE(p.address, ''), COALESCE(p.city, ''), p.lat, p.lng
  INTO _candidate_status, _place_id, _place_name, _place_address, _place_city, _place_lat, _place_lng
  FROM public.place_improvement_candidates c
  JOIN public.places p ON p.id = c.place_id
  WHERE c.id = _candidate_id
  FOR UPDATE OF c;

  IF _place_id IS NULL THEN RAISE EXCEPTION 'Underhållsärendet finns inte'; END IF;
  IF _candidate_status NOT IN ('open', 'needs_osm') THEN
    RAISE EXCEPTION 'Underhållsärendet är redan avslutat';
  END IF;
  IF _place_lat IS NULL OR _place_lng IS NULL THEN
    RAISE EXCEPTION 'Matstället saknar verifierad kartposition';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.place_sources ps
    WHERE ps.place_id = _place_id AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället har redan en aktiv extern källa';
  END IF;

  _target_name := public.normalize_place_match_text_v1(_place_name);
  _target_address := public.normalize_place_match_text_v1(_place_address);
  _target_city := public.normalize_place_match_text_v1(_place_city);
  _same_name := _target_name <> '' AND _target_name = _incoming_name;
  _related_name := length(_target_name) >= 4 AND length(_incoming_name) >= 4 AND (
    _target_name = _incoming_name
    OR _target_name LIKE _incoming_name || ' %'
    OR _incoming_name LIKE _target_name || ' %'
  );
  _same_address := _target_address <> '' AND _incoming_address <> ''
    AND _target_address = _incoming_address
    AND (
      _target_city = '' OR _incoming_city = '' OR _target_city = _incoming_city
    );

  _distance_term :=
    power(sin(radians(_lat - _place_lat) / 2), 2)
    + cos(radians(_place_lat)) * cos(radians(_lat))
      * power(sin(radians(_lng - _place_lng) / 2), 2);
  _distance_km :=
    2 * 6371 * asin(sqrt(least(1::double precision, greatest(0::double precision, _distance_term))));

  IF NOT (
    (_same_name AND (_same_address OR _distance_km <= 0.10))
    OR (_related_name AND _distance_km <= 0.05 AND (_same_address OR _target_address = '' OR _incoming_address = ''))
  ) THEN
    RAISE EXCEPTION 'Sökträffen matchar inte det manuella stället tillräckligt säkert';
  END IF;

  _osm_type := CASE lower(trim(COALESCE(_raw->>'osmType', _raw->>'osm_type', '')))
    WHEN 'n' THEN 'node'
    WHEN 'node' THEN 'node'
    WHEN 'w' THEN 'way'
    WHEN 'way' THEN 'way'
    WHEN 'r' THEN 'relation'
    WHEN 'relation' THEN 'relation'
    ELSE NULL
  END;
  IF _osm_type IS NOT NULL AND _osm_id ~ '^[1-9][0-9]*$' THEN
    _osm_source_id := _osm_type || ':' || _osm_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_provider_normalized || ':' || _provider_id_normalized, 0));
  IF _osm_source_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('openstreetmap:' || _osm_source_id, 0));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.place_sources ps
    WHERE ps.provider = _provider_normalized
      AND ps.provider_place_id = _provider_id_normalized
      AND ps.status = 'active'
      AND ps.place_id <> _place_id
  ) THEN
    RAISE EXCEPTION 'Sökträffens Geoapify-identitet är redan länkad till ett annat matställe';
  END IF;
  IF _osm_source_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.place_sources ps
    WHERE ps.provider = 'openstreetmap'
      AND ps.provider_place_id = _osm_source_id
      AND ps.status = 'active'
      AND ps.place_id <> _place_id
  ) THEN
    RAISE EXCEPTION 'Sökträffens OpenStreetMap-identitet är redan länkad till ett annat matställe';
  END IF;

  INSERT INTO public.place_sources (
    place_id, provider, provider_place_id, raw, status,
    first_seen_at, last_seen_at, valid_from, valid_to
  ) VALUES (
    _place_id, _provider_normalized, _provider_id_normalized, COALESCE(_raw, '{}'::jsonb), 'active',
    now(), now(), now(), NULL
  );

  IF _osm_source_id IS NOT NULL THEN
    INSERT INTO public.place_sources (
      place_id, provider, provider_place_id, raw, status,
      first_seen_at, last_seen_at, valid_from, valid_to
    ) VALUES (
      _place_id, 'openstreetmap', _osm_source_id, '{}'::jsonb, 'active',
      now(), now(), now(), NULL
    );
  END IF;

  UPDATE public.places
  SET lat = COALESCE(lat, _lat),
      lng = COALESCE(lng, _lng),
      website = COALESCE(website, _website)
  WHERE id = _place_id;

  INSERT INTO public.place_improvement_candidate_events(candidate_id, action, actor_id, metadata)
  VALUES (
    _candidate_id,
    'provider_source_linked',
    _uid,
    jsonb_build_object('provider', _provider_normalized, 'providerPlaceId', _provider_id_normalized)
  );

  RETURN _place_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_provider_source_for_maintenance_v1(
  uuid, text, text, text, text, text, double precision, double precision, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_provider_source_for_maintenance_v1(
  uuid, text, text, text, text, text, double precision, double precision, jsonb
) TO authenticated;

-- En aktiv extern källa är fortsatt den auktoritativa vägen till resolution.
-- Utöka befintlig trigger så även needs_osm löses och händelsen auditeras.
CREATE OR REPLACE FUNCTION public.resolve_place_improvement_candidate_for_active_source_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  WITH resolved AS (
    UPDATE public.place_improvement_candidates
    SET status = 'resolved',
        resolved_at = COALESCE(resolved_at, now()),
        dismissal_reason = NULL,
        resolution = COALESCE(resolution, 'Matstället har nu en aktiv extern källkoppling.')
    WHERE place_id = NEW.place_id
      AND status IN ('open', 'needs_osm')
    RETURNING id
  )
  INSERT INTO public.place_improvement_candidate_events(candidate_id, action, actor_id, metadata)
  SELECT
    resolved.id,
    'resolved_active_source',
    NULL,
    jsonb_build_object('provider', NEW.provider, 'providerPlaceId', NEW.provider_place_id)
  FROM resolved;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_place_improvement_candidate_for_active_source_v1()
  FROM PUBLIC, anon, authenticated;

COMMIT;
