BEGIN;

-- Issue #149: äldre klienter känner inte till searchMode. När boundaryrader
-- börjar finnas får get_group_app_state_v5h därför bara exponera point-rader,
-- så en gammal klient aldrig tolkar en kommungräns som ett punktcentrum.
-- v5i bygger vidare på samma bas men ersätter därefter searchAreas med hela
-- hybridmodellen inklusive searchMode/resultType.

ALTER FUNCTION public.get_group_app_state_v5h(uuid)
  RENAME TO get_group_app_state_v5h_boundary_base;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5h_boundary_base(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5h(_group_id uuid)
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
  _result := public.get_group_app_state_v5h_boundary_base(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'label', a.label,
        'lat', a.lat,
        'lng', a.lng,
        'provider', a.provider,
        'placeId', a.provider_place_id
      ) ORDER BY a.sort_order, a.created_at
    ),
    '[]'::jsonb
  )
  INTO _areas
  FROM public.group_search_areas a
  WHERE a.group_id = _group_id
    AND a.search_mode = 'point';

  _result := jsonb_set(_result, '{group,searchAreas}', _areas, true);
  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5h(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5h(uuid)
  TO authenticated;

DO $assertions$
DECLARE
  _legacy_definition text;
BEGIN
  IF to_regprocedure('public.get_group_app_state_v5h_boundary_base(uuid)') IS NULL THEN
    RAISE EXCEPTION 'legacy v5h base function is missing';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.get_group_app_state_v5h_boundary_base(uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.get_group_app_state_v5h_boundary_base(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'legacy v5h base function is directly executable by client roles';
  END IF;

  _legacy_definition := pg_get_functiondef(
    to_regprocedure('public.get_group_app_state_v5h(uuid)')
  );

  IF position('search_mode = ''point''' IN _legacy_definition) = 0 THEN
    RAISE EXCEPTION 'legacy v5h wrapper does not filter search areas to point mode';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.get_group_app_state_v5h(uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.get_group_app_state_v5h(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'legacy v5h wrapper has incorrect execute grants';
  END IF;
END;
$assertions$;

COMMIT;
