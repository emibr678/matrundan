-- Kompletterande skrivskyddad produktionskontroll för Issue #162.
-- Kör efter den ordinarie supabase/production-preflight.sql när migrationen
-- 20260811083000_fix_visit_photo_storage_policy_acl.sql har driftsatts.

WITH checks(name, ok) AS (
  VALUES
    (
      'visit-photo:function-current-user-guard',
      to_regprocedure('public.can_manage_own_visit_photo(uuid,uuid)') IS NOT NULL
    ),
    (
      'visit-photo:authenticated-can-call-current-user-guard',
      COALESCE(
        has_function_privilege(
          'authenticated',
          to_regprocedure('public.can_manage_own_visit_photo(uuid,uuid)'),
          'EXECUTE'
        ),
        false
      )
    ),
    (
      'visit-photo:anon-cannot-call-current-user-guard',
      COALESCE(
        NOT has_function_privilege(
          'anon',
          to_regprocedure('public.can_manage_own_visit_photo(uuid,uuid)'),
          'EXECUTE'
        ),
        false
      )
    ),
    (
      'visit-photo:authenticated-cannot-call-internal-user-helper',
      COALESCE(
        NOT has_function_privilege(
          'authenticated',
          to_regprocedure('public.can_manage_visit_photo(uuid,uuid,uuid)'),
          'EXECUTE'
        ),
        false
      )
    ),
    (
      'visit-photo:upload-policy-uses-current-user-guard',
      COALESCE(
        (
          SELECT position('can_manage_own_visit_photo' IN with_check) > 0
            AND position('can_manage_visit_photo(' IN with_check) = 0
          FROM pg_policies
          WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND policyname = 'visit photos allowed upload'
            AND cmd = 'INSERT'
        ),
        false
      )
    ),
    (
      'visit-photo:delete-policy-uses-current-user-guard',
      COALESCE(
        (
          SELECT position('can_manage_own_visit_photo' IN qual) > 0
            AND position('can_manage_visit_photo(' IN qual) = 0
            AND position('can_delete_original_visit' IN qual) > 0
          FROM pg_policies
          WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND policyname = 'visit photos allowed delete'
            AND cmd = 'DELETE'
        ),
        false
      )
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
