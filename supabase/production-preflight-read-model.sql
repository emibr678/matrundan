-- Aktuell read-model-grind för Matrundan.
--
-- Håll denna fil liten och versionscentrerad. Äldre wrapper-/basfunktioner kan
-- fortsatt verifieras i andra preflight-filer för bakåtkompatibilitet och
-- integritet, men den operativa current/fallback-sanningen ägs här.
WITH checks(name, ok) AS (
  VALUES
    ('read_rpc_current:get_group_app_state_v5n', to_regprocedure('public.get_group_app_state_v5n(uuid)') IS NOT NULL),
    ('read_rpc_fallback:get_group_app_state_v5m', to_regprocedure('public.get_group_app_state_v5m(uuid)') IS NOT NULL),
    ('grant:authenticated-current-read', COALESCE(has_function_privilege('authenticated', to_regprocedure('public.get_group_app_state_v5n(uuid)'), 'EXECUTE'), false)),
    ('grant:authenticated-fallback-read', COALESCE(has_function_privilege('authenticated', to_regprocedure('public.get_group_app_state_v5m(uuid)'), 'EXECUTE'), false)),
    ('isolation:no-anon-current-read', COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.get_group_app_state_v5n(uuid)'), 'EXECUTE'), false)),
    ('isolation:no-anon-fallback-read', COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.get_group_app_state_v5m(uuid)'), 'EXECUTE'), false))
)
SELECT name, ok
FROM checks
ORDER BY name;
