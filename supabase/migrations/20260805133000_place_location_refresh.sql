BEGIN;

-- v1.26.0: normaliserad adress och kartposition kan jämföras med en befintlig
-- kanonisk plats. Ingenting skrivs över förrän ägare/admin uttryckligen väljer
-- att använda en ny, serverhämtad Geoapify-position.

ALTER TABLE public.place_external_info_snapshots
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS osm_type text,
  ADD COLUMN IF NOT EXISTS osm_id text;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_external_info_snapshots'::regclass
      AND conname = 'place_external_info_snapshots_location_check'
  ) THEN
    ALTER TABLE public.place_external_info_snapshots
      ADD CONSTRAINT place_external_info_snapshots_location_check CHECK (
        (address IS NULL OR length(address) <= 500)
        AND (area IS NULL OR length(area) <= 200)
        AND (city IS NULL OR length(city) <= 200)
        AND ((lat IS NULL AND lng IS NULL) OR (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180))
        AND ((osm_type IS NULL AND osm_id IS NULL) OR (osm_type IN ('node','way','relation') AND osm_id ~ '^[0-9]+$'))
      );
  END IF;
END
$block$;

CREATE OR REPLACE FUNCTION public.get_place_external_info_context_v3(
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
  _snapshot public.place_external_info_snapshots%ROWTYPE;
  _can_apply_location boolean := false;
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
    AND gp.collection_status = 'active'
    AND ps.provider = 'geoapify'
    AND ps.status = 'active'
  ORDER BY ps.last_seen_at DESC, ps.valid_from DESC
  LIMIT 1;

  IF _provider_place_id IS NULL THEN
    RAISE EXCEPTION 'Matstället saknar en aktiv Geoapify-källa';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.group_id = _group_id
      AND m.user_id = _uid
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  ) INTO _can_apply_location;

  SELECT * INTO _snapshot
  FROM public.place_external_info_snapshots
  WHERE place_id = _place_id
    AND provider = 'geoapify'
    AND provider_place_id = _provider_place_id;

  RETURN jsonb_build_object(
    'providerPlaceId', _provider_place_id,
    'canApplyLocation', _can_apply_location,
    'snapshot', CASE WHEN _snapshot.place_id IS NULL THEN NULL ELSE jsonb_build_object(
      'openingHours', _snapshot.opening_hours,
      'website', _snapshot.website,
      'timezone', _snapshot.timezone,
      'location', CASE
        WHEN _snapshot.address IS NULL
          OR _snapshot.city IS NULL
          OR _snapshot.lat IS NULL
          OR _snapshot.lng IS NULL
        THEN NULL
        ELSE jsonb_build_object(
          'address', _snapshot.address,
          'area', _snapshot.area,
          'city', _snapshot.city,
          'lat', _snapshot.lat,
          'lng', _snapshot.lng,
          'osmType', _snapshot.osm_type,
          'osmId', _snapshot.osm_id
        )
      END,
      'fetchedAt', _snapshot.fetched_at,
      'attribution', 'Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.'
    ) END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_place_external_info_context_v3(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_place_external_info_context_v3(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.save_place_external_info_snapshot_v2(
  _group_id uuid,
  _place_id uuid,
  _provider_place_id text,
  _website text,
  _opening_hours jsonb,
  _timezone text,
  _address text,
  _area text,
  _city text,
  _lat double precision,
  _lng double precision,
  _osm_type text,
  _osm_id text,
  _fetched_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _website_normalized text := public.normalize_place_website(_website);
  _address_normalized text := NULLIF(regexp_replace(trim(COALESCE(_address, '')), '[[:space:]]+', ' ', 'g'), '');
  _area_normalized text := NULLIF(regexp_replace(trim(COALESCE(_area, '')), '[[:space:]]+', ' ', 'g'), '');
  _city_normalized text := NULLIF(regexp_replace(trim(COALESCE(_city, '')), '[[:space:]]+', ' ', 'g'), '');
  _osm_type_normalized text := NULLIF(lower(trim(COALESCE(_osm_type, ''))), '');
  _osm_id_normalized text := NULLIF(trim(COALESCE(_osm_id, '')), '');
  _payload jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places gp
    JOIN public.place_sources ps ON ps.place_id = gp.place_id
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND ps.provider = 'geoapify'
      AND ps.provider_place_id = trim(_provider_place_id)
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matställets externa källa kunde inte verifieras';
  END IF;
  IF NOT public.valid_opening_hours_schedule_v1(_opening_hours) THEN
    RAISE EXCEPTION 'Öppettiderna har ett ogiltigt format';
  END IF;
  IF _fetched_at IS NULL OR _fetched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Ogiltig hämtningstid';
  END IF;
  IF length(COALESCE(_address_normalized, '')) > 500
     OR length(COALESCE(_area_normalized, '')) > 200
     OR length(COALESCE(_city_normalized, '')) > 200 THEN
    RAISE EXCEPTION 'Kartdatan innehåller för långa platsfält';
  END IF;
  IF ((_lat IS NULL) <> (_lng IS NULL))
     OR (_lat IS NOT NULL AND (_lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180)) THEN
    RAISE EXCEPTION 'Kartdatan innehåller en ogiltig position';
  END IF;
  IF ((_osm_type_normalized IS NULL) <> (_osm_id_normalized IS NULL))
     OR (_osm_type_normalized IS NOT NULL AND (
       _osm_type_normalized NOT IN ('node','way','relation')
       OR _osm_id_normalized !~ '^[0-9]+$'
     )) THEN
    RAISE EXCEPTION 'Kartdatan innehåller en ogiltig OpenStreetMap-identitet';
  END IF;

  _payload := jsonb_build_object(
    'website', _website_normalized,
    'openingHours', _opening_hours,
    'timezone', NULLIF(trim(COALESCE(_timezone, '')), ''),
    'address', _address_normalized,
    'area', _area_normalized,
    'city', _city_normalized,
    'lat', _lat,
    'lng', _lng,
    'osmType', _osm_type_normalized,
    'osmId', _osm_id_normalized
  );

  INSERT INTO public.place_external_info_snapshots (
    place_id,
    provider,
    provider_place_id,
    website,
    opening_hours,
    timezone,
    address,
    area,
    city,
    lat,
    lng,
    osm_type,
    osm_id,
    fetched_at,
    fingerprint,
    updated_at
  ) VALUES (
    _place_id,
    'geoapify',
    trim(_provider_place_id),
    _website_normalized,
    _opening_hours,
    NULLIF(trim(COALESCE(_timezone, '')), ''),
    _address_normalized,
    _area_normalized,
    _city_normalized,
    _lat,
    _lng,
    _osm_type_normalized,
    _osm_id_normalized,
    _fetched_at,
    md5(_payload::text),
    now()
  )
  ON CONFLICT (place_id) DO UPDATE
  SET provider = EXCLUDED.provider,
      provider_place_id = EXCLUDED.provider_place_id,
      website = EXCLUDED.website,
      opening_hours = EXCLUDED.opening_hours,
      timezone = EXCLUDED.timezone,
      address = EXCLUDED.address,
      area = EXCLUDED.area,
      city = EXCLUDED.city,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      osm_type = EXCLUDED.osm_type,
      osm_id = EXCLUDED.osm_id,
      fetched_at = EXCLUDED.fetched_at,
      fingerprint = EXCLUDED.fingerprint,
      updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.save_place_external_info_snapshot_v2(
  uuid, uuid, text, text, jsonb, text, text, text, text,
  double precision, double precision, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_place_external_info_snapshot_v2(
  uuid, uuid, text, text, jsonb, text, text, text, text,
  double precision, double precision, text, text, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_place_external_location_v1(
  _group_id uuid,
  _place_id uuid,
  _provider_place_id text,
  _address text,
  _area text,
  _city text,
  _lat double precision,
  _lng double precision,
  _osm_type text,
  _osm_id text,
  _fetched_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _address_normalized text := NULLIF(regexp_replace(trim(COALESCE(_address, '')), '[[:space:]]+', ' ', 'g'), '');
  _area_normalized text := NULLIF(regexp_replace(trim(COALESCE(_area, '')), '[[:space:]]+', ' ', 'g'), '');
  _city_normalized text := NULLIF(regexp_replace(trim(COALESCE(_city, '')), '[[:space:]]+', ' ', 'g'), '');
  _osm_type_normalized text := NULLIF(lower(trim(COALESCE(_osm_type, ''))), '');
  _osm_id_normalized text := NULLIF(trim(COALESCE(_osm_id, '')), '');
  _osm_provider_id text;
  _current public.places%ROWTYPE;
  _source_linked boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.group_id = _group_id
      AND m.user_id = _uid
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Endast gruppens ägare och administratörer kan använda ny kartdata';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places gp
    JOIN public.place_sources ps ON ps.place_id = gp.place_id
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
      AND ps.provider = 'geoapify'
      AND ps.provider_place_id = trim(_provider_place_id)
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matställets externa källa kunde inte verifieras';
  END IF;
  IF _fetched_at IS NULL
     OR _fetched_at < now() - interval '10 minutes'
     OR _fetched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Kartdatan måste hämtas på nytt före uppdateringen';
  END IF;
  IF _address_normalized IS NULL
     OR length(_address_normalized) > 500
     OR _address_normalized !~* '[[:alpha:]]'
     OR _address_normalized !~* '([[:digit:]]|gata(n)?|väg(en)?|gränd(en)?|torg(et)?|allé(n)?|aveny(n)?|kaj(en)?|backe(n)?|stig(en)?|stråk(et)?|terrass(en)?|esplanad(en)?|gång(en)?|led(en)?|plats(en)?|street|road)' THEN
    RAISE EXCEPTION 'Kartdatan innehåller ingen säker gatuadress';
  END IF;
  IF _city_normalized IS NULL OR length(_city_normalized) > 200 THEN
    RAISE EXCEPTION 'Kartdatan innehåller ingen säker ort';
  END IF;
  IF length(COALESCE(_area_normalized, '')) > 200 THEN
    RAISE EXCEPTION 'Kartdatan innehåller ett ogiltigt område';
  END IF;
  IF _lat IS NULL OR _lng IS NULL
     OR _lat < -90 OR _lat > 90
     OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Kartdatan innehåller ingen säker position';
  END IF;
  IF ((_osm_type_normalized IS NULL) <> (_osm_id_normalized IS NULL))
     OR (_osm_type_normalized IS NOT NULL AND (
       _osm_type_normalized NOT IN ('node','way','relation')
       OR _osm_id_normalized !~ '^[0-9]+$'
     )) THEN
    RAISE EXCEPTION 'Kartdatan innehåller en ogiltig OpenStreetMap-identitet';
  END IF;

  SELECT * INTO _current
  FROM public.places
  WHERE id = _place_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte'; END IF;

  IF _osm_type_normalized IS NOT NULL THEN
    _osm_provider_id := _osm_type_normalized || ':' || _osm_id_normalized;

    IF EXISTS (
      SELECT 1 FROM public.place_sources
      WHERE provider = 'openstreetmap'
        AND provider_place_id = _osm_provider_id
        AND status = 'active'
        AND place_id <> _place_id
    ) THEN
      RAISE EXCEPTION 'Kartkällan är redan kopplad till ett annat matställe';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.place_sources
      WHERE provider = 'openstreetmap'
        AND status = 'active'
        AND place_id = _place_id
        AND provider_place_id <> _osm_provider_id
    ) THEN
      RAISE EXCEPTION 'Matstället har redan en annan aktiv OpenStreetMap-källa';
    END IF;
  END IF;

  UPDATE public.places
  SET address = _address_normalized,
      area = _area_normalized,
      city = _city_normalized,
      lat = _lat,
      lng = _lng,
      updated_at = now()
  WHERE id = _place_id;

  IF _osm_provider_id IS NOT NULL THEN
    INSERT INTO public.place_sources (
      place_id,
      provider,
      provider_place_id,
      raw,
      fetched_at,
      status,
      first_seen_at,
      last_seen_at,
      valid_from,
      valid_to
    ) VALUES (
      _place_id,
      'openstreetmap',
      _osm_provider_id,
      jsonb_build_object(
        'provider', 'openstreetmap',
        'osmType', _osm_type_normalized,
        'osmId', _osm_id_normalized
      ),
      _fetched_at,
      'active',
      now(),
      now(),
      now(),
      NULL
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.place_sources
    SET last_seen_at = now(),
        fetched_at = _fetched_at,
        raw = jsonb_build_object(
          'provider', 'openstreetmap',
          'osmType', _osm_type_normalized,
          'osmId', _osm_id_normalized
        )
    WHERE place_id = _place_id
      AND provider = 'openstreetmap'
      AND provider_place_id = _osm_provider_id
      AND status = 'active';

    _source_linked := EXISTS (
      SELECT 1 FROM public.place_sources
      WHERE place_id = _place_id
        AND provider = 'openstreetmap'
        AND provider_place_id = _osm_provider_id
        AND status = 'active'
    );
  END IF;

  RETURN jsonb_build_object(
    'address', _address_normalized,
    'area', _area_normalized,
    'city', _city_normalized,
    'lat', _lat,
    'lng', _lng,
    'sourceLinked', _source_linked
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_place_external_location_v1(
  uuid, uuid, text, text, text, text,
  double precision, double precision, text, text, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_place_external_location_v1(
  uuid, uuid, text, text, text, text,
  double precision, double precision, text, text, timestamptz
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
