-- Issue #516: UNDEPLOYED staging experiment only. Not a migration.
-- Requires separate, explicit staging DB deployment approval before use.
-- No production release; no references to group, visits, or canonical places.
-- The OSM-derived tables may be released separately under ODbL 1.0.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS osm_staging;
REVOKE ALL ON SCHEMA osm_staging FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA osm_staging TO service_role;

CREATE TABLE osm_staging.generations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_timestamp timestamptz NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  importer_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  status text NOT NULL DEFAULT 'building'
    CHECK (status IN ('building','validated','active','retired')),
  expected_count integer,
  CHECK (validated_at IS NULL OR status <> 'building')
);

CREATE TABLE osm_staging.places (
  generation_id bigint NOT NULL REFERENCES osm_staging.generations(id) ON DELETE CASCADE,
  osm_type text NOT NULL CHECK (osm_type IN ('node','way','relation')),
  osm_id bigint NOT NULL CHECK (osm_id > 0),
  name text NOT NULL DEFAULT '',
  amenity text,
  shop text,
  cuisine_raw text,
  cuisine_tokens text[] NOT NULL DEFAULT '{}',
  source_tags jsonb NOT NULL DEFAULT '{}',
  geometry_approximate boolean NOT NULL DEFAULT false,
  location extensions.geography(Point,4326) NOT NULL,
  PRIMARY KEY (generation_id, osm_type, osm_id),
  CHECK (jsonb_typeof(source_tags) = 'object')
);
CREATE INDEX osm_staging_places_geo_idx ON osm_staging.places USING gist(location);
CREATE INDEX osm_staging_places_tokens_idx ON osm_staging.places USING gin(cuisine_tokens);
CREATE INDEX osm_staging_places_name_idx ON osm_staging.places (lower(name));

-- One active pointer, switched with one row update in a single transaction.
-- Previous generation remains queryable for existing cursor pages.
CREATE TABLE osm_staging.current_generation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  generation_id bigint NOT NULL REFERENCES osm_staging.generations(id)
);

-- Default deny for exposed roles even if schema privileges change later.
ALTER TABLE osm_staging.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE osm_staging.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE osm_staging.current_generation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA osm_staging FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA osm_staging FROM PUBLIC, anon, authenticated;

-- Manually invoked by a privileged operator, never by the app.
-- Atomic pointer swap; preserves prior generation for in-flight pagination.
CREATE OR REPLACE FUNCTION osm_staging.activate_validated_generation(_generation bigint)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  _next_count bigint;
  _previous bigint;
  _previous_count bigint;
  _known_pasta_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(516, 1);
  SELECT count(*) INTO _next_count FROM osm_staging.places WHERE generation_id = _generation;
  IF _next_count < 15000 THEN
    RAISE EXCEPTION 'OSM staging generation too small (% rows)', _next_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM osm_staging.generations
    WHERE id = _generation AND status = 'validated' AND validated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'OSM staging generation not validated';
  END IF;
  SELECT generation_id INTO _previous
  FROM osm_staging.current_generation WHERE singleton IS TRUE FOR UPDATE;
  IF _previous IS NOT NULL THEN
    SELECT count(*) INTO _previous_count FROM osm_staging.places
    WHERE generation_id = _previous;
    IF _next_count < _previous_count * 0.75 THEN
      RAISE EXCEPTION 'OSM staging mass-deletion guard fired';
    END IF;
  END IF;
  -- Reference identities from independently verified Overpass Pasta/Stockholm.
  SELECT count(*) INTO _known_pasta_count FROM osm_staging.places
  WHERE generation_id = _generation AND osm_type = 'node'
    AND osm_id = ANY(ARRAY[
      318324117::bigint,360935262,707627932,712621281,810044221,
      957961775,1258633968,1349576854,1580839502,1717695879,
      2238199867,5079680337,7117300291,9186795630,11197610953,
      11829871768,11907603210,12300183770,13359851124
    ]);
  -- Snapshot may evolve; warn/operator review via count, never discard silently.
  IF _known_pasta_count < 15 THEN
    RAISE EXCEPTION 'OSM staging reference-identity guard failed (%/19)', _known_pasta_count;
  END IF;
  IF _previous IS NOT NULL AND _previous <> _generation THEN
    UPDATE osm_staging.generations SET status = 'retired' WHERE id = _previous;
  END IF;
  UPDATE osm_staging.generations SET status = 'active' WHERE id = _generation;
  INSERT INTO osm_staging.current_generation (singleton,generation_id)
  VALUES (true,_generation)
  ON CONFLICT (singleton) DO UPDATE SET generation_id = excluded.generation_id;
END;
$$;

REVOKE ALL ON FUNCTION osm_staging.activate_validated_generation(bigint)
  FROM PUBLIC, anon, authenticated, service_role;

-- Authenticated read-only staging proof. App never touches index tables directly.
-- Caller cannot write, pick private data, or change index generations.
CREATE OR REPLACE FUNCTION public.osm_staging_search_v1(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT 5,
  _tokens text[] DEFAULT '{}',
  _limit integer DEFAULT 20,
  _cursor jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _generation bigint;
  _fingerprint text;
  _results jsonb := '[]'::jsonb;
  _next jsonb;
  _has_more boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _lat IS NULL OR _lng IS NULL OR _radius_km IS NULL
    OR NOT pg_catalog.isfinite(_lat) OR NOT pg_catalog.isfinite(_lng)
    OR _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180
    OR _radius_km <= 0 OR _radius_km > 50
    OR _limit IS NULL OR _limit < 1 OR _limit > 20
    OR coalesce(pg_catalog.array_length(_tokens,1),0) > 20
  THEN
    RAISE EXCEPTION 'Invalid bounded OSM search';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(_tokens) AS token
    WHERE token IS NULL OR token !~ '^[a-z0-9_:-]{1,64}$'
  ) THEN
    RAISE EXCEPTION 'Invalid OSM token';
  END IF;
  _fingerprint := pg_catalog.md5(
    _lat::text || ':' || _lng::text || ':' || _radius_km::text
    || ':' || array_to_string(_tokens, ',')
  );
  SELECT c.generation_id INTO _generation
  FROM osm_staging.current_generation c WHERE c.singleton IS TRUE;

  IF _generation IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status','not_loaded','results','[]'::jsonb,'hasMore',false
    );
  END IF;
  IF _cursor IS NOT NULL THEN
    IF (_cursor->>'g') IS NULL OR (_cursor->>'s') IS DISTINCT FROM _fingerprint THEN
      RAISE EXCEPTION 'OSM search cursor scope mismatch';
    END IF;
    _generation := (_cursor->>'g')::bigint;
    IF NOT EXISTS (
      SELECT 1 FROM osm_staging.generations
      WHERE id = _generation AND status IN ('active','retired')
    ) THEN
      RAISE EXCEPTION 'OSM cursor generation no longer available';
    END IF;
  END IF;

  WITH matches AS (
    SELECT p.osm_type,p.osm_id,p.name,p.amenity,p.shop,
      p.cuisine_raw,
      extensions.st_y(p.location::extensions.geometry) AS lat,
      extensions.st_x(p.location::extensions.geometry) AS lng,
      extensions.st_distance(
        p.location,
        extensions.st_setsrid(extensions.st_makepoint(_lng,_lat),4326)::extensions.geography
      ) AS metres
    FROM osm_staging.places p
    WHERE p.generation_id = _generation
      AND (coalesce(pg_catalog.array_length(_tokens,1),0)=0
           OR p.cuisine_tokens && _tokens)
      AND extensions.st_dwithin(
        p.location,
        extensions.st_setsrid(extensions.st_makepoint(_lng,_lat),4326)::extensions.geography,
        _radius_km * 1000
      )
  ), ordered AS (
    SELECT * FROM matches
    WHERE _cursor IS NULL
       OR (metres,osm_type,osm_id) >
          ((_cursor->>'d')::double precision,_cursor->>'t',(_cursor->>'i')::bigint)
    ORDER BY metres,osm_type,osm_id
    LIMIT _limit+1
  ), page AS (
    SELECT * FROM ordered ORDER BY metres,osm_type,osm_id LIMIT _limit
  ), last_item AS (
    SELECT * FROM page ORDER BY metres DESC,osm_type DESC,osm_id DESC LIMIT 1
  )
  SELECT
    coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'osmType',osm_type,'osmId',osm_id,'name',name,'amenity',amenity,
      'shop',shop,'cuisine',cuisine_raw,'lat',lat,'lng',lng,'distanceM',metres
    ) ORDER BY metres,osm_type,osm_id) FROM page),'[]'::jsonb),
    (SELECT count(*) > _limit FROM ordered),
    (SELECT pg_catalog.jsonb_build_object(
      'g',_generation,'s',_fingerprint,'d',metres,'t',osm_type,'i',osm_id
    ) FROM last_item)
  INTO _results,_has_more,_next;

  RETURN pg_catalog.jsonb_build_object(
    'status','ok','generation',_generation,'results',_results,
    'hasMore',_has_more,'cursor',CASE WHEN _has_more THEN _next ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.osm_staging_search_v1(
  double precision,double precision,double precision,text[],integer,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.osm_staging_search_v1(
  double precision,double precision,double precision,text[],integer,jsonb)
  TO authenticated;

COMMIT;
