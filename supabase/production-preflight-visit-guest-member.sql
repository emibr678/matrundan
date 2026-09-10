-- Produktions-preflight för Issue #214 — precis gäst → medlem-koppling.
-- Körs skrivskyddat efter migration och före publicering. Alla rader ska ge ok=true.

WITH checks(name, ok) AS (
  VALUES
    (
      'table:visit_guest_member_proposals',
      to_regclass('public.visit_guest_member_proposals') IS NOT NULL
    ),
    (
      'rls:visit_guest_member_proposals',
      COALESCE(
        (
          SELECT c.relrowsecurity
          FROM pg_class c
          WHERE c.oid = to_regclass('public.visit_guest_member_proposals')
        ),
        false
      )
    ),
    (
      'schema:guest-id-required',
      COALESCE(
        (
          SELECT c.is_nullable = 'NO'
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'visit_guest_member_proposals'
            AND c.column_name = 'guest_id'
        ),
        false
      )
    ),
    (
      'schema:guest-link-only',
      COALESCE(
        (
          SELECT position('proposal_kind = ''guest_link''' IN pg_get_constraintdef(con.oid)) > 0
          FROM pg_constraint con
          WHERE con.conrelid = 'public.visit_guest_member_proposals'::regclass
            AND con.conname = 'visit_guest_member_proposals_kind_guest_check'
        ),
        false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.visit_guest_member_proposals
        WHERE proposal_kind <> 'guest_link'
      )
    ),
    (
      'rpc:list-targets',
      to_regprocedure('public.list_visit_guest_member_targets_v1(uuid,uuid)') IS NOT NULL
    ),
    (
      'rpc:propose-guest',
      to_regprocedure('public.propose_visit_guest_member_v1(uuid,uuid,uuid,uuid,uuid)') IS NOT NULL
    ),
    (
      'rpc:get-own-proposal',
      to_regprocedure('public.get_own_visit_guest_proposal_v1(uuid,uuid)') IS NOT NULL
    ),
    (
      'rpc:respond',
      to_regprocedure('public.respond_visit_guest_proposal_v1(uuid,uuid,text)') IS NOT NULL
    ),
    (
      'rpc:generic-recipient-paths-removed',
      to_regprocedure('public.list_visit_shared_member_candidates_v1(uuid,uuid)') IS NULL
      AND to_regprocedure('public.propose_shared_visit_member_v1(uuid,uuid,uuid)') IS NULL
      AND to_regprocedure('public.confirm_shared_visit_self_v1(uuid,uuid)') IS NULL
    ),
    (
      'read-rpc:current-v5k',
      to_regprocedure('public.get_group_app_state_v5k(uuid)') IS NOT NULL
    ),
    (
      'read-rpc:server-only-base',
      to_regprocedure('public.get_group_app_state_v5k_guest_identity_base(uuid)') IS NOT NULL
    ),
    (
      'guard:targets-original-group-only',
      COALESCE(
        position('link_type = ''original''' IN pg_get_functiondef(
          to_regprocedure('public.list_visit_guest_member_targets_v1(uuid,uuid)')
        )) > 0,
        false
      )
    ),
    (
      'guard:targets-require-linked-target',
      COALESCE(
        position('visit_group_links target_link' IN pg_get_functiondef(
          to_regprocedure('public.list_visit_guest_member_targets_v1(uuid,uuid)')
        )) > 0
        AND position('actor_membership.status = ''active''' IN pg_get_functiondef(
          to_regprocedure('public.list_visit_guest_member_targets_v1(uuid,uuid)')
        )) > 0,
        false
      )
    ),
    (
      'guard:participant-linked-group-membership',
      COALESCE(
        position('JOIN public.memberships membership' IN pg_get_functiondef(
          to_regprocedure('public.validate_visit_participant()')
        )) > 0
        AND position('membership.status = ''active''' IN pg_get_functiondef(
          to_regprocedure('public.validate_visit_participant()')
        )) > 0
        AND position('link_type = ''original''' IN pg_get_functiondef(
          to_regprocedure('public.validate_visit_participant()')
        )) = 0,
        false
      )
    ),
    (
      'guard:response-owned-by-target-user',
      COALESCE(
        position('proposal.target_user_id = _uid' IN pg_get_functiondef(
          to_regprocedure('public.respond_visit_guest_proposal_v1(uuid,uuid,text)')
        )) > 0,
        false
      )
    ),
    (
      'guard:accept-writes-canonical-participation',
      COALESCE(
        position('INSERT INTO public.visit_participants' IN pg_get_functiondef(
          to_regprocedure('public.respond_visit_guest_proposal_v1(uuid,uuid,text)')
        )) > 0
        AND position('VALUES (_proposal.visit_id, _uid)' IN pg_get_functiondef(
          to_regprocedure('public.respond_visit_guest_proposal_v1(uuid,uuid,text)')
        )) > 0,
        false
      )
    ),
    (
      'guard:own-proposal-minimized',
      COALESCE(
        position('proposalId' IN pg_get_functiondef(
          to_regprocedure('public.get_own_visit_guest_proposal_v1(uuid,uuid)')
        )) > 0
        AND position('guestName' IN pg_get_functiondef(
          to_regprocedure('public.get_own_visit_guest_proposal_v1(uuid,uuid)')
        )) = 0
        AND position('proposedBy' IN pg_get_functiondef(
          to_regprocedure('public.get_own_visit_guest_proposal_v1(uuid,uuid)')
        )) = 0,
        false
      )
    ),
    (
      'read-rpc:deduplicates-accepted-guests-in-every-group-context',
      COALESCE(
        position('accepted_count' IN pg_get_functiondef(
          to_regprocedure('public.get_group_app_state_v5k(uuid)')
        )) > 0
        AND position('accepted_visible_count' IN pg_get_functiondef(
          to_regprocedure('public.get_group_app_state_v5k(uuid)')
        )) > 0
        AND position('external_count - visit_row.accepted_count' IN pg_get_functiondef(
          to_regprocedure('public.get_group_app_state_v5k(uuid)')
        )) > 0
        AND position('visit_row.accepted_count - visit_row.accepted_visible_count' IN pg_get_functiondef(
          to_regprocedure('public.get_group_app_state_v5k(uuid)')
        )) > 0,
        false
      )
    ),
    (
      'grant:authenticated-rpcs',
      has_function_privilege(
        'authenticated',
        'public.list_visit_guest_member_targets_v1(uuid,uuid)',
        'EXECUTE'
      )
      AND has_function_privilege(
        'authenticated',
        'public.propose_visit_guest_member_v1(uuid,uuid,uuid,uuid,uuid)',
        'EXECUTE'
      )
      AND has_function_privilege(
        'authenticated',
        'public.get_own_visit_guest_proposal_v1(uuid,uuid)',
        'EXECUTE'
      )
      AND has_function_privilege(
        'authenticated',
        'public.respond_visit_guest_proposal_v1(uuid,uuid,text)',
        'EXECUTE'
      )
    ),
    (
      'isolation:no-anon-rpcs',
      NOT has_function_privilege(
        'anon',
        'public.list_visit_guest_member_targets_v1(uuid,uuid)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.propose_visit_guest_member_v1(uuid,uuid,uuid,uuid,uuid)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.get_own_visit_guest_proposal_v1(uuid,uuid)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.respond_visit_guest_proposal_v1(uuid,uuid,text)',
        'EXECUTE'
      )
    ),
    (
      'isolation:no-authenticated-table-read',
      NOT has_table_privilege('authenticated', 'public.visit_guest_member_proposals', 'SELECT')
    ),
    (
      'isolation:no-authenticated-table-write',
      NOT has_table_privilege('authenticated', 'public.visit_guest_member_proposals', 'INSERT')
    ),
    (
      'isolation:no-client-v5k-base',
      NOT has_function_privilege(
        'authenticated',
        'public.get_group_app_state_v5k_guest_identity_base(uuid)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.get_group_app_state_v5k_guest_identity_base(uuid)',
        'EXECUTE'
      )
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
