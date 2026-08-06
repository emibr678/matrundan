BEGIN;

-- Driftkorrigering för #137. Applicera endast denna framåtriktade migration;
-- äldre historiska luckor ska inte spelas om eller registreras som applicerade.

CREATE OR REPLACE FUNCTION public.search_area_label_is_broad(_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $function$
  SELECT lower(trim(split_part(coalesce(_label, ''), ',', 1)))
    ~ '(^region[[:space:]]|[[:space:]](kommun|län|region|municipality|county|state|country)$)';
$function$;

REVOKE ALL ON FUNCTION public.search_area_label_is_broad(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.replace_group_search_settings(
  _group_id uuid,
  _areas jsonb,
  _default_radius_km integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _area jsonb;
  _count integer;
  _position integer := 0;
  _label text;
  _provider text;
  _place_id text;
  _lat double precision;
  _lng double precision;
  _first public.group_search_areas%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ändra gruppens sökområden';
  END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF _default_radius_km NOT IN (1, 2, 3, 5, 10, 25, 50) THEN
    RAISE EXCEPTION 'Välj en giltig sökradie';
  END IF;
  IF _areas IS NULL OR jsonb_typeof(_areas) <> 'array' THEN
    RAISE EXCEPTION 'Sökområden måste vara en lista';
  END IF;

  _count := jsonb_array_length(_areas);
  IF _count > 5 THEN
    RAISE EXCEPTION 'En grupp kan ha högst fem sökområden';
  END IF;

  -- Validera hela listan innan befintliga rader ersätts.
  FOR _area IN SELECT value FROM jsonb_array_elements(_areas)
  LOOP
    _label := trim(coalesce(_area->>'label', ''));
    _provider := lower(trim(coalesce(_area->>'provider', '')));
    _place_id := trim(coalesce(_area->>'placeId', ''));
    BEGIN
      _lat := (_area->>'lat')::double precision;
      _lng := (_area->>'lng')::double precision;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Sökområdet saknar giltiga koordinater';
    END;

    IF length(_label) < 2 OR length(_label) > 180 THEN
      RAISE EXCEPTION 'Sökområdets namn måste vara 2–180 tecken';
    END IF;
    IF _provider <> 'geoapify' OR _place_id = '' THEN
      RAISE EXCEPTION 'Välj varje sökområde från platslistan';
    END IF;
    IF _lat IS NULL OR _lat NOT BETWEEN -90 AND 90
       OR _lng IS NULL OR _lng NOT BETWEEN -180 AND 180 THEN
      RAISE EXCEPTION 'Sökområdet saknar giltiga koordinater';
    END IF;
    IF public.search_area_label_is_broad(_label)
       AND NOT EXISTS (
         SELECT 1
         FROM public.group_search_areas existing
         WHERE existing.group_id = _group_id
           AND existing.provider = _provider
           AND existing.provider_place_id = _place_id
           AND existing.label = _label
       ) THEN
      RAISE EXCEPTION 'Välj en ort, stadsdel eller adress i stället för kommun, län eller region';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(trim(value->>'provider')) AS provider,
             trim(value->>'placeId') AS place_id,
             count(*) AS n
      FROM jsonb_array_elements(_areas)
      GROUP BY 1, 2
    ) duplicates
    WHERE duplicates.n > 1
  ) THEN
    RAISE EXCEPTION 'Samma sökområde kan bara läggas till en gång';
  END IF;

  DELETE FROM public.group_search_areas WHERE group_id = _group_id;

  FOR _area IN SELECT value FROM jsonb_array_elements(_areas)
  LOOP
    INSERT INTO public.group_search_areas (
      group_id,
      label,
      lat,
      lng,
      provider,
      provider_place_id,
      sort_order
    ) VALUES (
      _group_id,
      trim(_area->>'label'),
      (_area->>'lat')::double precision,
      (_area->>'lng')::double precision,
      lower(trim(_area->>'provider')),
      trim(_area->>'placeId'),
      _position
    );
    _position := _position + 1;
  END LOOP;

  UPDATE public.groups
  SET default_search_radius_km = _default_radius_km,
      updated_at = now()
  WHERE id = _group_id;

  SELECT * INTO _first
  FROM public.group_search_areas
  WHERE group_id = _group_id
  ORDER BY sort_order, created_at
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.groups
    SET home_location_label = _first.label,
        home_lat = _first.lat,
        home_lng = _first.lng,
        home_location_provider = _first.provider,
        home_location_place_id = _first.provider_place_id,
        updated_at = now()
    WHERE id = _group_id;
  ELSE
    UPDATE public.groups
    SET home_location_label = NULL,
        home_lat = NULL,
        home_lng = NULL,
        home_location_provider = NULL,
        home_location_place_id = NULL,
        updated_at = now()
    WHERE id = _group_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_group_search_settings(uuid, jsonb, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_group_search_settings(uuid, jsonb, integer)
  TO authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'visit-photos',
  'visit-photos',
  false,
  1500000,
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $assertions$
DECLARE
  _settings_definition text;
BEGIN
  IF to_regprocedure('public.search_area_label_is_broad(text)') IS NULL THEN
    RAISE EXCEPTION 'search-area helper could not be restored';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.search_area_label_is_broad(text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.search_area_label_is_broad(text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'search-area helper has unintended execute grants';
  END IF;

  IF to_regprocedure(
    'public.replace_group_search_settings(uuid,jsonb,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'search-area settings RPC could not be restored';
  END IF;

  _settings_definition := pg_get_functiondef(
    to_regprocedure('public.replace_group_search_settings(uuid,jsonb,integer)')
  );

  IF position('search_area_label_is_broad' IN _settings_definition) = 0
     OR position('has_group_role' IN _settings_definition) = 0
     OR position('group_is_active' IN _settings_definition) = 0 THEN
    RAISE EXCEPTION 'search-area settings RPC is missing required guards';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.replace_group_search_settings(uuid,jsonb,integer)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.replace_group_search_settings(uuid,jsonb,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'search-area settings RPC has incorrect execute grants';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'visit-photos'
      AND name = 'visit-photos'
      AND public = false
      AND file_size_limit = 1500000
      AND allowed_mime_types = ARRAY['image/jpeg']::text[]
  ) THEN
    RAISE EXCEPTION 'visit-photos bucket configuration could not be restored';
  END IF;
END;
$assertions$;

COMMIT;
