BEGIN;

REVOKE ALL ON FUNCTION public.resolve_missing_in_osm_reports_for_active_source_v1()
  FROM PUBLIC, anon, authenticated;

COMMIT;
