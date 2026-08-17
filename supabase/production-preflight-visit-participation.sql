-- Produktions-preflight för kanoniskt deltagande samt den aktuella grupp-read-modellen.
-- Körs skrivskyddat efter migration och före publicering. Alla rader ska ge ok=true.

WITH checks(name, ok) AS (
  VALUES
    ('read_rpc:get_group_app_state_v5k',
      to_regprocedure('public.get_group_app_state_v5k(uuid)') IS NOT NULL),
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
    ('read_rpc:next-stop-v2-projection',
      COALESCE(
        position('get_group_app_state_v5j' IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5k(uuid)'))) > 0
        AND position('nextStop' IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5k(uuid)'))) > 0
        AND position('next_stop_place_proposals' IN pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5k(uuid)'))) > 0,
        false
      )),
    ('next_stop_v2:plan-table',
      to_regclass('public.next_stop_plans') IS NOT NULL),
    ('next_stop_v2:proposal-table',
      to_regclass('public.next_stop_place_proposals') IS NOT NULL),
    ('next_stop_v2:no-support-table',
      to_regclass('public.next_stop_place_supports') IS NULL),
    ('next_stop_v2:legacy-day-response-table',
      to_regclass('public.next_stop_date_responses') IS NOT NULL),
    ('next_stop_v2:proposal-rpc',
      to_regprocedure('public.propose_next_stop_place_v2(uuid,uuid)') IS NOT NULL),
    ('next_stop_v2:no-support-rpc',
      to_regprocedure('public.set_next_stop_place_support_v2(uuid,uuid,boolean)') IS NULL),
    ('next_stop_v2:day-response-rpc',
      to_regprocedure('public.set_next_stop_day_response_v2(uuid,text)') IS NOT NULL),
    ('next_stop_v2:select-rpc',
      to_regprocedure('public.select_next_stop_place_v2(uuid,uuid,bigint)') IS NOT NULL),
    ('next_stop_v2:schedule-rpc',
      to_regprocedure('public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)') IS NOT NULL),
    ('next_stop_v2:first-proposal-gets-focus',
      COALESCE(
        position('IF _current_place_id IS NULL THEN' IN pg_get_functiondef(to_regprocedure('public.propose_next_stop_place_v2(uuid,uuid)'))) > 0
        AND position('set_next_place' IN pg_get_functiondef(to_regprocedure('public.propose_next_stop_place_v2(uuid,uuid)'))) > 0,
        false
      )),
    ('next_stop_v2:no-open-selection-rpc',
      to_regprocedure('public.clear_next_stop_selection_v2(uuid,bigint)') IS NULL),
    ('next_stop_v2:concurrency-guard',
      COALESCE(
        position('next_stop_v2_assert_revision' IN pg_get_functiondef(to_regprocedure('public.select_next_stop_place_v2(uuid,uuid,bigint)'))) > 0
        AND position('next_stop_v2_lock' IN pg_get_functiondef(to_regprocedure('public.select_next_stop_place_v2(uuid,uuid,bigint)'))) > 0,
        false
      )),
    ('next_stop_v2:stockholm-date-guard',
      COALESCE(
        position('Europe/Stockholm' IN pg_get_functiondef(to_regprocedure('public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)'))) > 0,
        false
      )),
    ('next_stop_v2:day-only',
      COALESCE(
        position('Nästa stopp använder bara dag, inte klockslag' IN pg_get_functiondef(to_regprocedure('public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)'))) > 0,
        false
      )),
    ('next_stop_v2:day-requires-focus',
      COALESCE(
        position('Välj nästa stopp innan ni lägger till en dag' IN pg_get_functiondef(to_regprocedure('public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)'))) > 0,
        false
      )),
    ('next_stop_v2:binary-day-response',
      COALESCE(
        position('can' IN pg_get_functiondef(to_regprocedure('public.set_next_stop_day_response_v2(uuid,text)'))) > 0
        AND position('cannot' IN pg_get_functiondef(to_regprocedure('public.set_next_stop_day_response_v2(uuid,text)'))) > 0
        AND position('next_stop_date_responses' IN pg_get_functiondef(to_regprocedure('public.set_next_stop_day_response_v2(uuid,text)'))) > 0,
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
    ('rls:next-stop-v2',
      COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.next_stop_plans')), false)
      AND COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.next_stop_place_proposals')), false)
      AND COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.next_stop_date_responses')), false)),
    ('grant:authenticated-v5k',
      has_function_privilege('authenticated', 'public.get_group_app_state_v5k(uuid)', 'EXECUTE')),
    ('grant:authenticated-v5j',
      has_function_privilege('authenticated', 'public.get_group_app_state_v5j(uuid)', 'EXECUTE')),
    ('grant:authenticated-next-stop-v2',
      has_function_privilege('authenticated', 'public.propose_next_stop_place_v2(uuid,uuid)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.set_next_stop_day_response_v2(uuid,text)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.select_next_stop_place_v2(uuid,uuid,bigint)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)', 'EXECUTE')),
    ('grant:authenticated-create-visit-v3',
      has_function_privilege('authenticated', 'public.create_visit_with_review_v3(uuid,uuid,date,text,uuid[],smallint,smallint,smallint,smallint,text,text[])', 'EXECUTE')),
    ('grant:authenticated-save-review',
      has_function_privilege('authenticated', 'public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)', 'EXECUTE')),
    ('grant:authenticated-self-participation',
      has_function_privilege('authenticated', 'public.set_own_visit_participation_v1(uuid,uuid,boolean)', 'EXECUTE')),
    ('isolation:no-anon-v5k',
      NOT has_function_privilege('anon', 'public.get_group_app_state_v5k(uuid)', 'EXECUTE')),
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
    ('isolation:no-authenticated-next-stop-tables',
      NOT has_table_privilege('authenticated', 'public.next_stop_plans', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.next_stop_place_proposals', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.next_stop_date_responses', 'SELECT')),
    ('isolation:no-anon-next-stop-tables',
      NOT has_table_privilege('anon', 'public.next_stop_plans', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.next_stop_place_proposals', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.next_stop_date_responses', 'SELECT')),
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
