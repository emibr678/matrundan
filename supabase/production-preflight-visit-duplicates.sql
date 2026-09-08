-- Produktions-preflight för Issue #213: konservativt dubblettskydd för
-- kanoniska besök. Körs skrivskyddat efter migration. Alla rader ska ge ok=true.

WITH checks(name, ok) AS (
  VALUES
    ('visit_duplicates:registration-rpc',
      to_regprocedure('public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)') IS NOT NULL),
    ('visit_duplicates:share-read-rpc',
      to_regprocedure('public.find_share_visit_duplicate_v1(uuid,uuid)') IS NOT NULL),
    ('visit_duplicates:share-write-rpc',
      to_regprocedure('public.share_visit_to_group_v2(uuid,uuid,boolean,boolean)') IS NOT NULL),
    ('visit_duplicates:registration-minified',
      COALESCE(
        position('''visitId''' IN pg_get_functiondef(to_regprocedure('public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)'))) > 0
        AND position('''visitedOn''' IN pg_get_functiondef(to_regprocedure('public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)'))) > 0
        AND position('''mealType''' IN pg_get_functiondef(to_regprocedure('public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)'))) > 0
        AND position('groupName' IN pg_get_functiondef(to_regprocedure('public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)'))) = 0
        AND position('sourceGroup' IN pg_get_functiondef(to_regprocedure('public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)'))) = 0,
        false
      )),
    ('visit_duplicates:source-access-guard',
      COALESCE(
        position('source_access' IN pg_get_functiondef(to_regprocedure('public.find_share_visit_duplicate_v1(uuid,uuid)'))) > 0
        AND position('source_membership.status = ''active''' IN pg_get_functiondef(to_regprocedure('public.find_share_visit_duplicate_v1(uuid,uuid)'))) > 0
        AND position('source_group.lifecycle_status = ''active''' IN pg_get_functiondef(to_regprocedure('public.find_share_visit_duplicate_v1(uuid,uuid)'))) > 0,
        false
      )),
    ('visit_duplicates:explicit-bypass-only',
      COALESCE(
        position('_allow_strong_duplicate' IN pg_get_functiondef(to_regprocedure('public.share_visit_to_group_v2(uuid,uuid,boolean,boolean)'))) > 0
        AND position('find_share_visit_duplicate_v1' IN pg_get_functiondef(to_regprocedure('public.share_visit_to_group_v2(uuid,uuid,boolean,boolean)'))) > 0
        AND position('share_visit_to_group(' IN pg_get_functiondef(to_regprocedure('public.share_visit_to_group_v2(uuid,uuid,boolean,boolean)'))) > 0,
        false
      )),
    ('visit_duplicates:authenticated-rpcs',
      has_function_privilege('authenticated', 'public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.find_share_visit_duplicate_v1(uuid,uuid)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.share_visit_to_group_v2(uuid,uuid,boolean,boolean)', 'EXECUTE')),
    ('visit_duplicates:no-anon-rpcs',
      NOT has_function_privilege('anon', 'public.find_registration_visit_duplicate_v1(uuid,uuid,date,text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.find_share_visit_duplicate_v1(uuid,uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.share_visit_to_group_v2(uuid,uuid,boolean,boolean)', 'EXECUTE'))
)
SELECT name, ok
FROM checks
ORDER BY name;
