-- Issue #516, OFFLINE / DISPOSABLE DB only until separate staging DB approval.
-- psql-only import companion to osm-staging-schema-516.sql.
-- Assumes an OSM-only CSV at /tmp/osm-staging-516/places.csv.
-- Does not touch Matrundan's canonical places or any group table.
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.set_config('osm_poc.generation_id', :'osm_generation_id', true);

CREATE TEMP TABLE osm_poc_incoming (
  osm_type text,
  osm_id bigint,
  name text,
  amenity text,
  shop text,
  cuisine_raw text,
  source_tags jsonb,
  geometry_json jsonb
) ON COMMIT DROP;
\copy osm_poc_incoming FROM '/tmp/osm-staging-516/places.csv' WITH (FORMAT csv, NULL '\N')

-- No geometry shortcut: polygons get a point guaranteed on the valid polygon
-- surface, preserving holes and multipolygon components. Line geometry
-- receives a point on the line and is marked approximate for follow-up review.
WITH parsed AS (
  SELECT f.*,
    extensions.st_geomfromgeojson(f.geometry_json::text) AS geom
  FROM osm_poc_incoming f
), valid AS (
  SELECT *, extensions.st_pointonsurface(geom) AS point
  FROM parsed
  WHERE geom IS NOT NULL AND NOT extensions.st_isempty(geom)
    AND extensions.st_isvalid(geom)
), normalized AS (
  SELECT *,
    ARRAY(
      SELECT DISTINCT replace(trim(lower(token)), ' ', '_')
      FROM unnest(string_to_array(coalesce(cuisine_raw,''),';')) AS token
      WHERE trim(token) <> ''
    ) AS normalized_tokens
  FROM valid
)
INSERT INTO osm_staging.places (
  generation_id, osm_type, osm_id, name, amenity, shop, cuisine_raw,
  cuisine_tokens, source_tags, geometry_approximate, location
)
SELECT :'osm_generation_id'::bigint, osm_type, osm_id, name, amenity, shop,
  cuisine_raw, normalized_tokens, source_tags,
  (geometry_json->>'type') NOT IN ('Point','Polygon','MultiPolygon'),
  point::extensions.geography
FROM normalized;

-- Metadata validation is intentionally done before activation.
DO $$
DECLARE
  _actual integer;
  _expected integer;
BEGIN
  SELECT count(*) INTO _actual FROM osm_staging.places
  WHERE generation_id = current_setting('osm_poc.generation_id')::bigint;
  SELECT count(*) INTO _expected FROM osm_poc_incoming;
  IF _actual < 15000 OR _actual < _expected * 0.98 THEN
    RAISE EXCEPTION 'Incomplete OSM staging ingest: accepted % of %', _actual, _expected;
  END IF;
END;
$$;
COMMIT;
