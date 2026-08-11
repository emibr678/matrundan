-- Issue #149: skrivskyddad produktions-preflight för hybridmodellen point/boundary.
-- Kör efter den godkända migrationen, innan schema-cache reload och live-smoke.

WITH checks(name, ok) AS (
  VALUES
    (
      'read_rpc_current:get_group_app_state_v5i',
      to_regprocedure('public.get_group_app_state_v5i(uuid)') IS NOT NULL
    ),
    (
      'read_rpc_fallback:get_group_app_state_v5h',
      to_regprocedure('public.get_group_app_state_v5h(uuid)') IS NOT NULL
    ),
    (
      'group_search_areas.search_mode',
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'group_search_areas'
          AND column_name = 'search_mode'
          AND is_nullable = 'NO'
          AND column_default LIKE '%point%'
      )
    ),
    (
      'group_search_areas.result_type',
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'group_search_areas'
          AND column_name = 'result_type'
      )
    ),
    (
      'search-area:hybrid-mode',
      COALESCE(
        position('searchMode' IN pg_get_functiondef(
          to_regprocedure('public.get_group_app_state_v5i(uuid)')
        )) > 0
        AND position('resultType' IN pg_get_functiondef(
          to_regprocedure('public.get_group_app_state_v5i(uuid)')
        )) > 0
        AND position('boundary' IN pg_get_functiondef(
          to_regprocedure('public.replace_group_search_settings(uuid,jsonb,integer)')
        )) > 0
        AND position('search_mode' IN pg_get_functiondef(
          to_regprocedure('public.replace_group_search_settings(uuid,jsonb,integer)')
        )) > 0,
        false
      )
    ),
    (
      'search-area:existing-point-default',
      NOT EXISTS (
        SELECT 1
        FROM public.group_search_areas
        WHERE search_mode NOT IN ('point', 'boundary')
      )
    ),
    (
      'search-area:broad-point-guard',
      COALESCE(
        position('search_area_label_is_broad' IN pg_get_functiondef(
          to_regprocedure('public.replace_group_search_settings(uuid,jsonb,integer)')
        )) > 0
        AND position('existing.search_mode = ''point''' IN pg_get_functiondef(
          to_regprocedure('public.replace_group_search_settings(uuid,jsonb,integer)')
        )) > 0,
        false
      )
    ),
    (
      'isolation:read-v5i-authenticated-only',
      has_function_privilege(
        'authenticated',
        'public.get_group_app_state_v5i(uuid)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.get_group_app_state_v5i(uuid)',
        'EXECUTE'
      )
    ),
    (
      'isolation:settings-authenticated-only',
      has_function_privilege(
        'authenticated',
        'public.replace_group_search_settings(uuid,jsonb,integer)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.replace_group_search_settings(uuid,jsonb,integer)',
        'EXECUTE'
      )
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
