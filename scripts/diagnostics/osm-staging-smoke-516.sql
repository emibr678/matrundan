-- Standalone synthetic contract for Issue #516. Runs ONLY in disposable CI PostgreSQL.
\set ON_ERROR_STOP on

-- Validate that an empty but deployed index clearly reports not_loaded.
DO $$
DECLARE r jsonb;
BEGIN
  -- Supabase mock auth.uid() defaults null, so auth check should fail first.
  BEGIN
    PERFORM public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['pasta'],20,NULL);
    RAISE EXCEPTION 'Anonymous call unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Authentication required%' THEN RAISE; END IF;
  END;
END $$;

SELECT pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001', false);
SELECT public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['pasta'],20,NULL)->>'status' AS initial_status
\gset
\if :{?initial_status}
\else
  \echo 'Search has no status'
  \quit 1
\endif

DO $$
BEGIN
  IF (public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['pasta'],20,NULL)->>'status') <> 'not_loaded'
  THEN RAISE EXCEPTION 'missing-generation status must be not_loaded'; END IF;
END $$;

-- No client role has even USAGE on private index schema.
DO $$
BEGIN
  IF has_schema_privilege('authenticated','osm_staging','USAGE')
    OR has_table_privilege('authenticated','osm_staging.places','SELECT')
    OR has_schema_privilege('anon','osm_staging','USAGE')
  THEN RAISE EXCEPTION 'RLS/ACL leak on OSM index schema'; END IF;
  IF has_function_privilege('anon',
    'public.osm_staging_search_v1(double precision,double precision,double precision,text[],integer,jsonb)',
    'EXECUTE')
  THEN RAISE EXCEPTION 'anonymous role can execute OSM index search'; END IF;
END $$;

INSERT INTO osm_staging.generations (
  source_timestamp,source_sha256,importer_version,status,validated_at
) VALUES (now(),repeat('a',64),'fixture-1','validated',now());

INSERT INTO osm_staging.places (
  generation_id,osm_type,osm_id,name,amenity,cuisine_raw,cuisine_tokens,location,source_tags
) SELECT 1,'node',100000000000::bigint+num, 'Testplats '||num,
   'restaurant','pasta', ARRAY['pasta'],
   extensions.st_setsrid(extensions.st_makepoint(18.0686+num*0.000001,59.3293),4326)::extensions.geography,
   '{"amenity":"restaurant","cuisine":"pasta"}'::jsonb
FROM generate_series(1,16000) AS num;
INSERT INTO osm_staging.places (
  generation_id,osm_type,osm_id,name,amenity,cuisine_raw,cuisine_tokens,location,source_tags
) SELECT 1,'node',id,'Känt OSM-ställe','restaurant','pasta',ARRAY['pasta'],
  extensions.st_setsrid(extensions.st_makepoint(18.0686,59.3293),4326)::extensions.geography,
  '{"amenity":"restaurant","cuisine":"pasta"}'::jsonb
FROM unnest(ARRAY[
  318324117::bigint,360935262,707627932,712621281,810044221,
  957961775,1258633968,1349576854,1580839502,1717695879,
  2238199867,5079680337,7117300291,9186795630,11197610953,
  11829871768,11907603210,12300183770,13359851124
]) AS id;

SELECT osm_staging.activate_validated_generation(1);

DO $$
DECLARE
  r jsonb;
  c jsonb;
BEGIN
  r := public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['pasta'],20,NULL);
  IF r->>'status' <> 'ok' OR jsonb_array_length(r->'results') <> 20
    OR r->>'hasMore' <> 'true' OR r->'cursor' IS NULL
  THEN RAISE EXCEPTION 'First page/cursor invalid: %',r; END IF;
  c := r->'cursor';
  r := public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['pasta'],20,c);
  IF jsonb_array_length(r->'results') <> 20 OR (r->>'generation')::int <> 1
  THEN RAISE EXCEPTION 'Second page invalid: %',r; END IF;
  BEGIN
    PERFORM public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['ramen'],20,c);
    RAISE EXCEPTION 'Incorrectly reused cursor';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%cursor scope mismatch%' THEN RAISE; END IF;
  END;
END $$;

-- A suspiciously small generation cannot replace active data.
INSERT INTO osm_staging.generations (
  source_timestamp,source_sha256,importer_version,status,validated_at
) VALUES (now(),repeat('b',64),'fixture-2','validated',now());

INSERT INTO osm_staging.places (
  generation_id,osm_type,osm_id,name,amenity,cuisine_raw,cuisine_tokens,location
) SELECT 2,'node',200000000000::bigint+num,'Testplats','restaurant','pasta',ARRAY['pasta'],
  extensions.st_setsrid(extensions.st_makepoint(18.0686,59.3293),4326)::extensions.geography
FROM generate_series(1,100) AS num;

DO $$
BEGIN
  BEGIN
    PERFORM osm_staging.activate_validated_generation(2);
    RAISE EXCEPTION 'Mass deletion unexpectedly allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%too small%' THEN RAISE; END IF;
  END;
  IF (SELECT generation_id FROM osm_staging.current_generation) <> 1
  THEN RAISE EXCEPTION 'Current pointer modified by failed activation'; END IF;
END $$;

-- A complete second snapshot activates atomically. A cursor created on gen 1
-- must still return gen 1 after switching to gen 2. The older snapshot can
-- subsequently be reinstated without deleting source rows.
INSERT INTO osm_staging.places (
  generation_id,osm_type,osm_id,name,amenity,cuisine_raw,cuisine_tokens,location
) SELECT 2,'node',200000000000::bigint+num,'Testplats','restaurant','pasta',ARRAY['pasta'],
  extensions.st_setsrid(extensions.st_makepoint(18.0686,59.3293),4326)::extensions.geography
FROM generate_series(101,16000) AS num;

INSERT INTO osm_staging.places (
  generation_id,osm_type,osm_id,name,amenity,cuisine_raw,cuisine_tokens,location
) SELECT 2,'node',id,'Känt OSM-ställe','restaurant','pasta',ARRAY['pasta'],
  extensions.st_setsrid(extensions.st_makepoint(18.0686,59.3293),4326)::extensions.geography
FROM unnest(ARRAY[
  318324117::bigint,360935262,707627932,712621281,810044221,
  957961775,1258633968,1349576854,1580839502,1717695879,
  2238199867,5079680337,7117300291,9186795630,11197610953,
  11829871768,11907603210,12300183770,13359851124
]) AS id;

DO $$
DECLARE
  _old_cursor jsonb;
  _row jsonb;
BEGIN
  _old_cursor := public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['pasta'],20,NULL)->'cursor';
  PERFORM osm_staging.activate_validated_generation(2);
  IF (SELECT generation_id FROM osm_staging.current_generation) <> 2 THEN
    RAISE EXCEPTION 'Activation failed to switch atomically';
  END IF;
  _row := public.osm_staging_search_v1(59.3293,18.0686,5,ARRAY['pasta'],20,_old_cursor);
  IF (_row->>'generation')::bigint <> 1 THEN
    RAISE EXCEPTION 'In-flight cursor switched to wrong generation';
  END IF;
  PERFORM osm_staging.activate_validated_generation(1);
  IF (SELECT generation_id FROM osm_staging.current_generation) <> 1 THEN
    RAISE EXCEPTION 'Rollback failed to restore first generation';
  END IF;
END $$;

-- Cannot use function for malformed coordinates or unbounded search.
DO $$
BEGIN
  BEGIN
    PERFORM public.osm_staging_search_v1(91,18.0686,5,ARRAY['pasta'],20,NULL);
    RAISE EXCEPTION 'Invalid coordinate accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Invalid bounded OSM search%' THEN RAISE; END IF;
  END;
END $$;

\echo 'OSM staging schema isolation, generation, cursor and guard smoke OK'
