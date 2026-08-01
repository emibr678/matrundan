BEGIN;

ALTER TABLE public.place_data_reports
  DROP CONSTRAINT IF EXISTS place_data_reports_category_check;

ALTER TABLE public.place_data_reports
  ADD CONSTRAINT place_data_reports_category_check CHECK (
    category IN (
      'missing_in_osm',
      'closed_or_replaced',
      'wrong_name',
      'wrong_address',
      'wrong_website',
      'duplicate',
      'other'
    )
  );

CREATE OR REPLACE FUNCTION public.create_place_data_report_v1(
  _group_id uuid,
  _place_id uuid,
  _category text,
  _description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _report_id uuid;
  _created boolean := false;
  _description_normalized text := regexp_replace(trim(COALESCE(_description, '')), '[[:space:]]+', ' ', 'g');
  _reported_name text;
  _reported_address text;
  _reported_city text;
  _reported_website text;
  _reported_lat double precision;
  _reported_lng double precision;
  _reported_sources jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _category NOT IN (
    'missing_in_osm',
    'closed_or_replaced',
    'wrong_name',
    'wrong_address',
    'wrong_website',
    'duplicate',
    'other'
  ) THEN
    RAISE EXCEPTION 'Ogiltig typ av platsdatarapport';
  END IF;
  IF length(_description_normalized) < 10 OR length(_description_normalized) > 1000 THEN
    RAISE EXCEPTION 'Beskrivningen måste vara 10–1000 tecken';
  END IF;

  SELECT
    p.name,
    COALESCE(p.address, ''),
    COALESCE(p.city, ''),
    COALESCE(gp.website_override, p.website),
    p.lat,
    p.lng
  INTO
    _reported_name,
    _reported_address,
    _reported_city,
    _reported_website,
    _reported_lat,
    _reported_lng
  FROM public.group_places gp
  JOIN public.places p ON p.id = gp.place_id
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id;

  IF _reported_name IS NULL THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;

  IF _category = 'missing_in_osm' THEN
    IF _reported_lat IS NULL OR _reported_lng IS NULL THEN
      RAISE EXCEPTION 'Verifierad kartposition krävs för att rapportera att stället saknas i OpenStreetMap';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.place_sources ps
      WHERE ps.place_id = _place_id
        AND ps.provider = 'openstreetmap'
        AND ps.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Matstället har redan en aktiv OpenStreetMap-koppling';
    END IF;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'provider', ps.provider,
        'providerPlaceId', ps.provider_place_id,
        'status', ps.status
      )
      ORDER BY
        CASE ps.status WHEN 'active' THEN 0 ELSE 1 END,
        ps.provider,
        ps.valid_from DESC
    ),
    '[]'::jsonb
  )
  INTO _reported_sources
  FROM public.place_sources ps
  WHERE ps.place_id = _place_id;

  INSERT INTO public.place_data_reports (
    group_id,
    place_id,
    category,
    description,
    status,
    reported_name,
    reported_address,
    reported_city,
    reported_website,
    reported_lat,
    reported_lng,
    reported_sources,
    created_by
  ) VALUES (
    _group_id,
    _place_id,
    _category,
    _description_normalized,
    'open',
    _reported_name,
    _reported_address,
    _reported_city,
    _reported_website,
    _reported_lat,
    _reported_lng,
    _reported_sources,
    _uid
  )
  ON CONFLICT (group_id, place_id, category, created_by)
    WHERE status IN ('open', 'ready_for_osm') AND created_by IS NOT NULL
  DO NOTHING
  RETURNING id INTO _report_id;

  IF _report_id IS NOT NULL THEN
    _created := true;
  ELSE
    SELECT r.id
    INTO _report_id
    FROM public.place_data_reports r
    WHERE r.group_id = _group_id
      AND r.place_id = _place_id
      AND r.category = _category
      AND r.created_by = _uid
      AND r.status IN ('open', 'ready_for_osm')
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object('id', _report_id, 'created', _created);
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_provider_source_to_existing_place_v1(
  _group_id uuid,
  _place_id uuid,
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
  _name_normalized text := lower(regexp_replace(trim(COALESCE(_name, '')), '[[:space:].,]+', ' ', 'g'));
  _address_normalized text := lower(regexp_replace(trim(COALESCE(_address, '')), '[[:space:].,]+', ' ', 'g'));
  _city_normalized text := lower(regexp_replace(trim(COALESCE(_city, '')), '[[:space:].,]+', ' ', 'g'));
  _candidate record;
  _candidate_name text;
  _candidate_address text;
  _candidate_city text;
  _candidate_distance double precision;
  _distance_term double precision;
  _same_name boolean;
  _same_address boolean;
  _candidate_count integer := 0;
  _matched_place_id uuid;
  _osm_type text;
  _osm_id text := trim(COALESCE(_raw->>'osmId', _raw->>'osm_id', ''));
  _osm_source_id text;
  _website text := public.normalize_place_website(_raw->>'website');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan länka en extern källa';
  END IF;
  IF _provider_normalized <> 'geoapify' OR _provider_id_normalized = '' THEN
    RAISE EXCEPTION 'Okänd eller ofullständig platsleverantör';
  END IF;
  IF _name_normalized = '' THEN RAISE EXCEPTION 'Sökträffens namn saknas'; END IF;
  IF (_lat IS NULL) <> (_lng IS NULL) THEN
    RAISE EXCEPTION 'Både latitud och longitud krävs';
  END IF;
  IF _lat IS NOT NULL AND (_lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180) THEN
    RAISE EXCEPTION 'Ogiltig kartposition';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places gp
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
      AND gp.origin = 'manual'
  ) THEN
    RAISE EXCEPTION 'Källan kan bara länkas till ett aktivt manuellt ställe i gruppen';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.place_sources ps
    WHERE ps.place_id = _place_id
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället har redan en aktiv extern källa';
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_provider_normalized || ':' || _provider_id_normalized, 0)
  );
  IF _osm_source_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('openstreetmap:' || _osm_source_id, 0));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.place_sources ps
    WHERE ps.provider = _provider_normalized
      AND ps.provider_place_id = _provider_id_normalized
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Sökträffens Geoapify-identitet är redan länkad till ett annat matställe';
  END IF;
  IF _osm_source_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.place_sources ps
    WHERE ps.provider = 'openstreetmap'
      AND ps.provider_place_id = _osm_source_id
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Sökträffens OpenStreetMap-identitet är redan länkad till ett annat matställe';
  END IF;

  FOR _candidate IN
    SELECT p.id, p.name, p.address, p.city, p.lat, p.lng
    FROM public.group_places gp
    JOIN public.places p ON p.id = gp.place_id
    WHERE gp.group_id = _group_id
      AND gp.collection_status = 'active'
      AND gp.origin = 'manual'
      AND NOT EXISTS (
        SELECT 1
        FROM public.place_sources ps
        WHERE ps.place_id = p.id
          AND ps.status = 'active'
      )
  LOOP
    _candidate_name := lower(
      regexp_replace(trim(COALESCE(_candidate.name, '')), '[[:space:].,]+', ' ', 'g')
    );
    _candidate_address := lower(
      regexp_replace(trim(COALESCE(_candidate.address, '')), '[[:space:].,]+', ' ', 'g')
    );
    _candidate_city := lower(
      regexp_replace(trim(COALESCE(_candidate.city, '')), '[[:space:].,]+', ' ', 'g')
    );
    _same_name := _candidate_name <> '' AND _candidate_name = _name_normalized;
    _same_address :=
      _candidate_address <> ''
      AND _candidate_address = _address_normalized
      AND _candidate_city = _city_normalized;
    _candidate_distance := NULL;

    IF _candidate.lat IS NOT NULL
       AND _candidate.lng IS NOT NULL
       AND _lat IS NOT NULL
       AND _lng IS NOT NULL THEN
      _distance_term :=
        power(sin(radians(_lat - _candidate.lat) / 2), 2)
        + cos(radians(_candidate.lat))
          * cos(radians(_lat))
          * power(sin(radians(_lng - _candidate.lng) / 2), 2);
      _candidate_distance :=
        2 * 6371 * asin(sqrt(least(1::double precision, greatest(0::double precision, _distance_term))));
    END IF;

    IF (_same_name AND _same_address)
       OR (
         _candidate_distance IS NOT NULL
         AND _candidate_distance <= 0.1
         AND (_same_name OR _same_address)
       ) THEN
      _candidate_count := _candidate_count + 1;
      _matched_place_id := _candidate.id;
    END IF;
  END LOOP;

  IF _candidate_count = 0 THEN
    RAISE EXCEPTION 'Sökträffen matchar inte det manuella stället tillräckligt säkert';
  END IF;
  IF _candidate_count > 1 THEN
    RAISE EXCEPTION 'Flera manuella ställen matchar sökträffen. Länken måste granskas separat';
  END IF;
  IF _matched_place_id <> _place_id THEN
    RAISE EXCEPTION 'Sökträffen matchar ett annat manuellt ställe i gruppen';
  END IF;

  INSERT INTO public.place_sources (
    place_id,
    provider,
    provider_place_id,
    raw,
    status,
    first_seen_at,
    last_seen_at,
    valid_from,
    valid_to
  ) VALUES (
    _place_id,
    _provider_normalized,
    _provider_id_normalized,
    COALESCE(_raw, '{}'::jsonb),
    'active',
    now(),
    now(),
    now(),
    NULL
  );

  IF _osm_source_id IS NOT NULL THEN
    INSERT INTO public.place_sources (
      place_id,
      provider,
      provider_place_id,
      raw,
      status,
      first_seen_at,
      last_seen_at,
      valid_from,
      valid_to
    ) VALUES (
      _place_id,
      'openstreetmap',
      _osm_source_id,
      '{}'::jsonb,
      'active',
      now(),
      now(),
      now(),
      NULL
    );
  END IF;

  UPDATE public.places
  SET lat = COALESCE(lat, _lat),
      lng = COALESCE(lng, _lng),
      website = COALESCE(website, _website)
  WHERE id = _place_id;

  RETURN _place_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_provider_source_to_existing_place_v1(
  uuid, uuid, text, text, text, text, text, double precision, double precision, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_provider_source_to_existing_place_v1(
  uuid, uuid, text, text, text, text, text, double precision, double precision, jsonb
) TO authenticated;

COMMIT;
