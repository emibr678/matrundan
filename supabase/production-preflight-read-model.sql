-- Aktuell read-model-grind för Matrundan.
--
-- Håll denna fil liten och versionscentrerad. Äldre wrapper-/basfunktioner kan
-- fortsatt verifieras i andra preflight-filer för bakåtkompatibilitet och
-- integritet, men den operativa current/fallback-sanningen ägs här.
WITH checks(name, ok) AS (
  VALUES
    ('read_rpc_current:get_group_app_state_v5k', to_regprocedure('public.get_group_app_state_v5k(uuid)') IS NOT NULL),
    ('read_rpc_fallback:get_group_app_state_v5j', to_regprocedure('public.get_group_app_state_v5j(uuid)') IS NOT NULL),
    ('grant:authenticated-current-read', COALESCE(has_function_privilege('authenticated', to_regprocedure('public.get_group_app_state_v5k(uuid)'), 'EXECUTE'), false)),
    ('grant:authenticated-fallback-read', COALESCE(has_function_privilege('authenticated', to_regprocedure('public.get_group_app_state_v5j(uuid)'), 'EXECUTE'), false)),
    ('isolation:no-anon-current-read', COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.get_group_app_state_v5k(uuid)'), 'EXECUTE'), false)),
    ('isolation:no-anon-fallback-read', COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.get_group_app_state_v5j(uuid)'), 'EXECUTE'), false))
)
SELECT name, ok
FROM checks
ORDER BY name;
