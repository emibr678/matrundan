BEGIN;

-- Issue #149: hybridmodell för verifierade sökområden.
-- Befintliga rader behåller uttryckligen dagens punkt + radie-semantik.

ALTER TABLE public.group_search_areas
  ADD COLUMN IF NOT EXISTS search_mode text NOT NULL DEFAULT 'point',
  ADD COLUMN IF NOT EXISTS result_type text;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.group_search_areas'::regclass
      AND conname = 'group_search_areas_search_mode_check'
  ) THEN
    ALTER TABLE public.group_search_areas
      ADD CONSTRAINT group_search_areas_search_mode_check
      CHECK (search_mode IN ('point', 'boundary'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.group_search_areas'::regclass
      AND conname = 'group_search_areas_result_type_check'
  ) THEN
    ALTER TABLE public.group_search_areas
      ADD CONSTRAINT group_search_areas_result_type_check
      CHECK (result_type IS NULL OR length(result_type) BETWEEN 1 AND 40);
  END IF;
END
$block$;

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
  _search_mode text;
  _result_type text;
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
    RAISE EXCEPTION 'Välj ett giltigt avstånd';
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
    _search_mode := lower(trim(coalesce(_area->>'searchMode', 'point')));
    _result_type := nullif(lower(trim(coalesce(_area->>'resultType', ''))), '');

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
    IF _search_mode NOT IN ('point', 'boundary') THEN
      RAISE EXCEPTION 'Sökområdet har ett ogiltigt söksätt';
    END IF;
    IF _result_type IS NOT NULL AND length(_result_type) > 40 THEN
      RAISE EXCEPTION 'Sökområdets typ är ogiltig';
    END IF;

    IF _search_mode = 'boundary' THEN
      IF _result_type IS NULL OR _result_type NOT IN (
        'municipality', 'county', 'state', 'region',
        'city', 'town', 'village', 'locality',
        'suburb', 'district', 'neighbourhood', 'quarter'
      ) THEN
        RAISE EXCEPTION 'Det valda området kan inte användas som geografisk gräns';
      END IF;
    ELSIF public.search_area_label_is_broad(_label)
       AND NOT EXISTS (
         SELECT 1
         FROM public.group_search_areas existing
         WHERE existing.group_id = _group_id
           AND existing.provider = _provider
           AND existing.provider_place_id = _place_id
           AND existing.label = _label
           AND existing.search_mode = 'point'
       ) THEN
      RAISE EXCEPTION 'Välj ett område med verifierad gräns eller en ort, stadsdel eller adress';
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
      search_mode,
      result_type,
      sort_order
    ) VALUES (
      _group_id,
      trim(_area->>'label'),
      (_area->>'lat')::double precision,
      (_area->>'lng')::double precision,
      lower(trim(_area->>'provider')),
      trim(_area->>'placeId'),
      lower(trim(coalesce(_area->>'searchMode', 'point'))),
      nullif(lower(trim(coalesce(_area->>'resultType', ''))), ''),
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

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5i(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _areas jsonb;
BEGIN
  _result := public.get_group_app_state_v5h(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'label', a.label,
        'lat', a.lat,
        'lng', a.lng,
        'provider', a.provider,
        'placeId', a.provider_place_id,
        'searchMode', a.search_mode,
        'resultType', a.result_type
      ) ORDER BY a.sort_order, a.created_at
    ),
    '[]'::jsonb
  )
  INTO _areas
  FROM public.group_search_areas a
  WHERE a.group_id = _group_id;

  RETURN jsonb_set(_result, '{group,searchAreas}', _areas, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5i(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5i(uuid)
  TO authenticated;

COMMIT;
