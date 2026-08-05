BEGIN;

-- Kanonisk platsdata får aldrig kunna skickas direkt av en vanlig klient.
-- Serverfunktionen verifierar först användaren genom den gruppskyddade v3-
-- kontexten, hämtar därefter färsk Geoapify-data och anropar denna RPC med
-- service_role. RPC:n upprepar roll-, källa-, färskhets- och konfliktkontroller.

REVOKE ALL ON FUNCTION public.apply_place_external_location_v1(
  uuid, uuid, text, text, text, text,
  double precision, double precision, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.apply_place_external_location_v1(
  uuid, uuid, text, text, text, text,
  double precision, double precision, text, text, timestamptz
);

CREATE OR REPLACE FUNCTION public.apply_place_external_location_v1(
  _actor_id uuid,
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
  _address_normalized text := NULLIF(regexp_replace(trim(COALESCE(_address, '')), '[[:space:]]+', ' ', 'g'), '');
  _area_normalized text := NULLIF(regexp_replace(trim(COALESCE(_area, '')), '[[:space:]]+', ' ', 'g'), '');
  _city_normalized text := NULLIF(regexp_replace(trim(COALESCE(_city, '')), '[[:space:]]+', ' ', 'g'), '');
  _osm_type_normalized text := NULLIF(lower(trim(COALESCE(_osm_type, ''))), '');
  _osm_id_normalized text := NULLIF(trim(COALESCE(_osm_id, '')), '');
  _osm_provider_id text;
  _current public.places%ROWTYPE;
  _source_linked boolean := false;
BEGIN
  IF _actor_id IS NULL THEN RAISE EXCEPTION 'Användaren kunde inte verifieras'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.group_id = _group_id
      AND m.user_id = _actor_id
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

  IF lower(regexp_replace(trim(_current.name), '[[:space:]]+', ' ', 'g')) =
     lower(regexp_replace(_address_normalized, '[[:space:]]+', ' ', 'g')) THEN
    RAISE EXCEPTION 'Kartdatan innehåller ställets namn i stället för en adress';
  END IF;

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
  uuid, uuid, uuid, text, text, text, text,
  double precision, double precision, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_place_external_location_v1(
  uuid, uuid, uuid, text, text, text, text,
  double precision, double precision, text, text, timestamptz
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
