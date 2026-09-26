-- Riktad produktions-preflight för inbjudningsdomänen (#142 + #350).
-- Körs tillsammans med supabase/production-preflight.sql efter separat
-- databasdriftsättningsgodkännande. Alla rader ska returnera ok = true.

WITH checks(name, ok) AS (
  VALUES
    (
      'invitations:multi-use-column',
      EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        LEFT JOIN pg_attrdef definition
          ON definition.adrelid = attribute.attrelid
         AND definition.adnum = attribute.attnum
        WHERE attribute.attrelid = 'public.invitations'::regclass
          AND attribute.attname = 'is_multi_use'
          AND attribute.attnotnull
          AND NOT attribute.attisdropped
          AND pg_get_expr(definition.adbin, definition.adrelid) = 'false'
      )
    ),
    (
      'invitations:directed-columns',
      EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.invitations'::regclass
          AND attname = 'invited_user_id'
          AND NOT attisdropped
      )
      AND EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.invitations'::regclass
          AND attname = 'declined_at'
          AND NOT attisdropped
      )
      AND EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.invitations'::regclass
          AND attname = 'token_hash'
          AND NOT attnotnull
          AND NOT attisdropped
      )
    ),
    (
      'invitations:target-shape',
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.invitations'::regclass
          AND conname = 'invitations_target_shape_check'
          AND convalidated
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.invitations
        WHERE invited_user_id IS NOT NULL
          AND (token_hash IS NOT NULL OR invited_email IS NOT NULL OR is_multi_use)
      )
    ),
    (
      'invitations:pending-uniqueness',
      to_regclass('public.invitations_one_pending_user_per_group') IS NOT NULL
      AND to_regclass('public.invitations_one_pending_email_per_group') IS NOT NULL
    ),
    (
      'invitation_rpc:legacy',
      to_regprocedure('public.create_group_invitation(uuid,text,integer)') IS NOT NULL
      AND to_regprocedure('public.get_invitation_preview(text)') IS NOT NULL
      AND to_regprocedure('public.accept_group_invitation(text)') IS NOT NULL
      AND to_regprocedure('public.revoke_group_invitation(uuid)') IS NOT NULL
      AND to_regprocedure('public.list_group_invitations(uuid)') IS NOT NULL
    ),
    (
      'invitation_rpc:directed',
      to_regprocedure('public.list_group_invite_candidates(uuid)') IS NOT NULL
      AND to_regprocedure('public.create_group_member_invitations(uuid,uuid[])') IS NOT NULL
      AND to_regprocedure('public.list_my_group_invitations()') IS NOT NULL
      AND to_regprocedure('public.accept_group_member_invitation(uuid)') IS NOT NULL
      AND to_regprocedure('public.decline_group_member_invitation(uuid)') IS NOT NULL
      AND to_regprocedure('public.list_own_group_invitations(uuid)') IS NOT NULL
    ),
    (
      'invitation_rpc:member-can-invite',
      COALESCE(
        position(
          'membership.status = ''active'''
          IN pg_get_functiondef(
            to_regprocedure('public.create_group_invitation(uuid,text,integer)')
          )
        ) > 0
        AND position(
          'has_group_role(_group_id, _uid, ARRAY[''owner'', ''admin''])'
          IN pg_get_functiondef(
            to_regprocedure('public.create_group_invitation(uuid,text,integer)')
          )
        ) = 0,
        false
      )
    ),
    (
      'invitation_rpc:directed-privacy',
      COALESCE(
        position(
          'source_group.lifecycle_status = ''active'''
          IN pg_get_functiondef(
            to_regprocedure('public.list_group_invite_candidates(uuid)')
          )
        ) > 0
        AND position(
          'invitation.invited_user_id = auth.uid()'
          IN pg_get_functiondef(
            to_regprocedure('public.list_my_group_invitations()')
          )
        ) > 0,
        false
      )
    ),
    (
      'invitation_rpc:revoke-ownership',
      COALESCE(
        position(
          '_invitation.invited_by <> _uid AND _role NOT IN (''owner'', ''admin'')'
          IN pg_get_functiondef(
            to_regprocedure('public.revoke_group_invitation(uuid)')
          )
        ) > 0,
        false
      )
    ),
    (
      'invitation_rpc:protected-writes',
      NOT has_function_privilege('anon', 'public.create_group_invitation(uuid,text,integer)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.create_group_member_invitations(uuid,uuid[])', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.accept_group_member_invitation(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.decline_group_member_invitation(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.revoke_group_invitation(uuid)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.create_group_invitation(uuid,text,integer)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.create_group_member_invitations(uuid,uuid[])', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.accept_group_member_invitation(uuid)', 'EXECUTE')
    ),
    (
      'invitation_rpc:public-preview-only',
      has_function_privilege('anon', 'public.get_invitation_preview(text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.list_my_group_invitations()', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.list_group_invite_candidates(uuid)', 'EXECUTE')
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
