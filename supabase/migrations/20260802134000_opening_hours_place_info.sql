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
      'wrong_opening_hours',
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
    'wrong_opening_hours',
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

CREATE OR REPLACE FUNCTION public.get_place_external_info_context_v1(
  _group_id uuid,
  _place_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _provider_place_id text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  SELECT ps.provider_place_id
  INTO _provider_place_id
  FROM public.group_places gp
  JOIN public.place_sources ps ON ps.place_id = gp.place_id
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id
    AND ps.provider = 'geoapify'
    AND ps.status = 'active'
  ORDER BY ps.last_seen_at DESC, ps.valid_from DESC
  LIMIT 1;

  IF _provider_place_id IS NULL THEN
    RAISE EXCEPTION 'Matstället saknar en aktiv Geoapify-källa';
  END IF;

  RETURN jsonb_build_object('providerPlaceId', _provider_place_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_place_data_report_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_place_data_report_v1(uuid, uuid, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_place_external_info_context_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_place_external_info_context_v1(uuid, uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
