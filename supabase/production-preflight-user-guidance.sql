-- Produktions-preflight för Issue #363: kontobunden, versionsstyrd
-- produktguidning. Körs skrivskyddat efter migration. Alla rader ska ge ok=true.

WITH checks(name, ok) AS (
  VALUES
    ('user_guidance:table',
      to_regclass('public.user_guidance_state') IS NOT NULL),
    ('user_guidance:rls-enabled',
      COALESCE((
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = to_regclass('public.user_guidance_state')
      ), false)),
    ('user_guidance:authenticated-minimum-grants',
      has_table_privilege(
        'authenticated',
        'public.user_guidance_state',
        'SELECT'
      )
      AND has_table_privilege(
        'authenticated',
        'public.user_guidance_state',
        'INSERT'
      )
      AND NOT has_table_privilege(
        'authenticated',
        'public.user_guidance_state',
        'UPDATE'
      )
      AND NOT has_table_privilege(
        'authenticated',
        'public.user_guidance_state',
        'DELETE'
      )),
    ('user_guidance:no-anon-access',
      NOT has_table_privilege('anon', 'public.user_guidance_state', 'SELECT')
      AND NOT has_table_privilege(
        'anon',
        'public.user_guidance_state',
        'INSERT'
      )),
    ('user_guidance:self-only-policies',
      EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_guidance_state'
          AND policyname = 'user_guidance_state_select_own'
          AND cmd = 'SELECT'
          AND position('auth.uid()' IN qual) > 0
          AND position('user_id' IN qual) > 0
      )
      AND EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_guidance_state'
          AND policyname = 'user_guidance_state_insert_own'
          AND cmd = 'INSERT'
          AND position('auth.uid()' IN with_check) > 0
          AND position('user_id' IN with_check) > 0
      )),
    ('user_guidance:primary-key',
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_guidance_state'::regclass
          AND contype = 'p'
          AND pg_get_constraintdef(oid) =
            'PRIMARY KEY (user_id, guidance_key, guidance_version)'
      )),
    ('user_guidance:profile-cascade',
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_guidance_state'::regclass
          AND contype = 'f'
          AND confrelid = 'public.profiles'::regclass
          AND confdeltype = 'c'
      )),
    ('user_guidance:soft-delete-cleanup',
      to_regprocedure(
        'public.clear_user_guidance_on_profile_soft_delete()'
      ) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.profiles'::regclass
          AND tgname = 'profiles_clear_user_guidance_on_soft_delete'
          AND NOT tgisinternal
      ))
)
SELECT name, ok
FROM checks
ORDER BY name;
