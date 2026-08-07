-- Riktad produktions-preflight för issue #142.
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
      'invitations:multi-use-open-only',
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.invitations'::regclass
          AND conname = 'invitations_multi_use_requires_open_check'
          AND convalidated
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.invitations
        WHERE is_multi_use
          AND invited_email IS NOT NULL
      )
    ),
    (
      'invitation_rpc:create',
      to_regprocedure('public.create_group_invitation(uuid,text,integer)') IS NOT NULL
    ),
    (
      'invitation_rpc:preview',
      to_regprocedure('public.get_invitation_preview(text)') IS NOT NULL
    ),
    (
      'invitation_rpc:accept',
      to_regprocedure('public.accept_group_invitation(text)') IS NOT NULL
    ),
    (
      'invitation_rpc:revoke',
      to_regprocedure('public.revoke_group_invitation(uuid)') IS NOT NULL
    ),
    (
      'invitation_rpc:list',
      to_regprocedure('public.list_group_invitations(uuid)') IS NOT NULL
    ),
    (
      'invitation_rpc:multi-use-semantics',
      COALESCE(
        position(
          '_is_multi_use := _email IS NULL'
          IN pg_get_functiondef(
            to_regprocedure('public.create_group_invitation(uuid,text,integer)')
          )
        ) > 0
        AND position(
          'NOT _row.is_multi_use AND _row.accepted_at IS NOT NULL'
          IN pg_get_functiondef(
            to_regprocedure('public.get_invitation_preview(text)')
          )
        ) > 0
        AND position(
          'IF NOT _inv.is_multi_use THEN'
          IN pg_get_functiondef(
            to_regprocedure('public.accept_group_invitation(text)')
          )
        ) > 0
        AND position(
          'AND (is_multi_use OR accepted_at IS NULL)'
          IN pg_get_functiondef(
            to_regprocedure('public.revoke_group_invitation(uuid)')
          )
        ) > 0
        AND position(
          'WHEN NOT i.is_multi_use AND i.accepted_at IS NOT NULL'
          IN pg_get_functiondef(
            to_regprocedure('public.list_group_invitations(uuid)')
          )
        ) > 0,
        false
      )
    ),
    (
      'invitation_rpc:protected-writes',
      NOT has_function_privilege(
        'anon',
        'public.create_group_invitation(uuid,text,integer)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.accept_group_invitation(text)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.revoke_group_invitation(uuid)',
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        'public.list_group_invitations(uuid)',
        'EXECUTE'
      )
      AND has_function_privilege(
        'authenticated',
        'public.create_group_invitation(uuid,text,integer)',
        'EXECUTE'
      )
      AND has_function_privilege(
        'authenticated',
        'public.accept_group_invitation(text)',
        'EXECUTE'
      )
    ),
    (
      'invitation_rpc:public-preview-only',
      has_function_privilege(
        'anon',
        'public.get_invitation_preview(text)',
        'EXECUTE'
      )
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
