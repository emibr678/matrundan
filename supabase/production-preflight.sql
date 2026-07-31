-- Matrundan produktions-preflight
--
-- Körs skrivskyddat mot produktionsdatabasen efter migration och före
-- publicering. Alla rader ska returnera ok = true. Därefter ska PostgRESTs
-- schema-cache laddas om och en autentiserad läsning av en verklig grupp göras.

WITH checks(name, ok) AS (
  VALUES
    (
      'read_rpc_current:get_group_app_state_v5e',
      to_regprocedure('public.get_group_app_state_v5e(uuid)') IS NOT NULL
    ),
    (
      'read_rpc_fallback:get_group_app_state_v5d',
      to_regprocedure('public.get_group_app_state_v5d(uuid)') IS NOT NULL
    ),
    (
      'settings_rpc:replace_group_search_settings',
      to_regprocedure('public.replace_group_search_settings(uuid,jsonb,integer)') IS NOT NULL
    ),
    (
      'create_rpc:create_group_with_owner_v2',
      to_regprocedure('public.create_group_with_owner_v2(text,text,jsonb,integer)') IS NOT NULL
    ),
    (
      'hidden_rpc:list',
      to_regprocedure('public.list_group_hidden_place_suggestions(uuid)') IS NOT NULL
    ),
    (
      'hidden_rpc:hide',
      to_regprocedure('public.hide_group_place_suggestion(uuid,text,text,text,text,text)') IS NOT NULL
    ),
    (
      'hidden_rpc:restore',
      to_regprocedure('public.restore_group_place_suggestion(uuid,text,text)') IS NOT NULL
    ),
    (
      'table:group_search_areas',
      to_regclass('public.group_search_areas') IS NOT NULL
    ),
    (
      'table:group_hidden_place_suggestions',
      to_regclass('public.group_hidden_place_suggestions') IS NOT NULL
    ),
    (
      'column:groups.default_search_radius_km',
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'groups'
          AND column_name = 'default_search_radius_km'
      )
    ),
    (
      'grant:authenticated-current-read',
      has_function_privilege(
        'authenticated',
        'public.get_group_app_state_v5e(uuid)',
        'EXECUTE'
      )
    ),
    (
      'grant:authenticated-settings',
      has_function_privilege(
        'authenticated',
        'public.replace_group_search_settings(uuid,jsonb,integer)',
        'EXECUTE'
      )
    ),
    (
      'grant:authenticated-hidden-list',
      has_function_privilege(
        'authenticated',
        'public.list_group_hidden_place_suggestions(uuid)',
        'EXECUTE'
      )
    ),
    (
      'grant:authenticated-hidden-hide',
      has_function_privilege(
        'authenticated',
        'public.hide_group_place_suggestion(uuid,text,text,text,text,text)',
        'EXECUTE'
      )
    ),
    (
      'grant:authenticated-hidden-restore',
      has_function_privilege(
        'authenticated',
        'public.restore_group_place_suggestion(uuid,text,text)',
        'EXECUTE'
      )
    ),
    (
      'isolation:no-authenticated-search-area-table-access',
      NOT has_table_privilege('authenticated', 'public.group_search_areas', 'SELECT')
    ),
    (
      'isolation:no-authenticated-hidden-table-access',
      NOT has_table_privilege(
        'authenticated',
        'public.group_hidden_place_suggestions',
        'SELECT'
      )
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
