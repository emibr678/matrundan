-- Issue #169: produktions-preflight för kanoniskt deltagande och deltagaromdömen.
-- Körs skrivskyddat efter migration och före publicering. Alla rader ska ge ok=true.

WITH checks(name, ok) AS (
  VALUES
    ('read_rpc:get_group_app_state_v5j',
      to_regprocedure('public.get_group_app_state_v5j(uuid)') IS NOT NULL),
    ('read_rpc:legacy-v5i-wrapper',
      to_regprocedure('public.get_group_app_state_v5i(uuid)') IS NOT NULL),
    ('read_rpc:internal-v5i-base',
      to_regprocedure('public.get_group_app_state_v5i_participation_base(uuid)') IS NOT NULL),
    ('read_rpc:participant-review-filter',
      COALESCE(
        position('visit_participants' IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5i(uuid)'))) > 0
        AND position('active_reviews' IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5i(uuid)'))) > 0
        AND position('currentUserParticipationStatus' IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5i(uuid)'))) > 0,
        false
      )),
    ('visit_rpc:create_visit_with_review_v3',
      to_regprocedure('public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])') IS NOT NULL),
    ('visit_rpc:registrar-must-participate',
      COALESCE(
        position('_uid = ANY' IN pg_get_functiondef(to_regprocedure('public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])'))) > 0
        AND position('Den som registrerar besöket måste vara deltagare' IN pg_get_functiondef(to_regprocedure('public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])'))) > 0
        AND position('INSERT INTO public.reviews' IN pg_get_functiondef(to_regprocedure('public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])'))) > 0,
        false
      )),
    ('review_rpc:save_own_review_for_visit_v1',
      to_regprocedure('public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)') IS NOT NULL),
    ('review_rpc:actual-participant-only',
      COALESCE(
        position('visit_participants' IN pg_get_functiondef(to_regprocedure('public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('auth.uid()' IN pg_get_functiondef(to_regprocedure('public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('visit_group_links' IN pg_get_functiondef(to_regprocedure('public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0,
        false
      )),
    ('participation_rpc:set_own_visit_participation_v1',
      to_regprocedure('public.set_own_visit_participation_v1(uuid,uuid,boolean)') IS NOT NULL),
    ('participation_rpc:registrar-cannot-decline',
      COALESCE(
        position('created_by = _uid' IN pg_get_functiondef(to_regprocedure('public.set_own_visit_participation_v1(uuid,uuid,boolean)'))) > 0
        AND position('Den som registrerade besöket måste vara deltagare' IN pg_get_functiondef(to_regprocedure('public.set_own_visit_participation_v1(uuid,uuid,boolean)'))) > 0,
        false
      )),
    ('participation_rpc:restore-needs-own-decline',
      COALESCE(
        position('_correction_status IS DISTINCT FROM ''declined''' IN pg_get_functiondef(to_regprocedure('public.set_own_visit_participation_v1(uuid,uuid,boolean)'))) > 0
        AND position('auth.uid()' IN pg_get_functiondef(to_regprocedure('public.set_own_visit_participation_v1(uuid,uuid,boolean)'))) > 0,
        false
      )),
    ('table:visit_participation_self_corrections',
      to_regclass('public.visit_participation_self_corrections') IS NOT NULL),
    ('rls:visit_participation_self_corrections',
      COALESCE((
        SELECT c.relrowsecurity
        FROM pg_class c
        WHERE c.oid = to_regclass('public.visit_participation_self_corrections')
      ), false)),
    ('grant:authenticated-v5j',
      has_function_privilege('authenticated', 'public.get_group_app_state_v5j(uuid)', 'EXECUTE')),
    ('grant:authenticated-create-visit-v3',
      has_function_privilege('authenticated', 'public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])', 'EXECUTE')),
    ('grant:authenticated-save-review',
      has_function_privilege('authenticated', 'public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)', 'EXECUTE')),
    ('grant:authenticated-self-participation',
      has_function_privilege('authenticated', 'public.set_own_visit_participation_v1(uuid,uuid,boolean)', 'EXECUTE')),
    ('isolation:no-anon-v5j',
      NOT has_function_privilege('anon', 'public.get_group_app_state_v5j(uuid)', 'EXECUTE')),
    ('isolation:no-client-v5i-base',
      NOT has_function_privilege('authenticated', 'public.get_group_app_state_v5i_participation_base(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.get_group_app_state_v5i_participation_base(uuid)', 'EXECUTE')),
    ('isolation:no-anon-create-visit-v3',
      NOT has_function_privilege('anon', 'public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])', 'EXECUTE')),
    ('isolation:no-anon-save-review',
      NOT has_function_privilege('anon', 'public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)', 'EXECUTE')),
    ('isolation:no-anon-self-participation',
      NOT has_function_privilege('anon', 'public.set_own_visit_participation_v1(uuid,uuid,boolean)', 'EXECUTE')),
    ('isolation:no-authenticated-correction-table-read',
      NOT has_table_privilege('authenticated', 'public.visit_participation_self_corrections', 'SELECT')),
    ('isolation:no-authenticated-correction-table-write',
      NOT has_table_privilege('authenticated', 'public.visit_participation_self_corrections', 'INSERT')),
    ('isolation:no-anon-correction-table-read',
      NOT has_table_privilege('anon', 'public.visit_participation_self_corrections', 'SELECT'))
)
SELECT name, ok
FROM checks
ORDER BY name;
