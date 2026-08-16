-- Kompletterande skrivskyddad produktionskontroll för besöksfoto.
-- Kör efter den ordinarie supabase/production-preflight.sql när migrationen
-- 20260815082500_visit_photo_ownership_guard_v1.sql har driftsatts.

WITH function_defs AS (
  SELECT
    COALESCE(
      pg_get_functiondef(to_regprocedure('public.can_manage_visit_photo(uuid,uuid,uuid)')),
      ''
    ) AS manage_def,
    COALESCE(
      pg_get_functiondef(to_regprocedure('public.can_delete_visit_photo(uuid,uuid,uuid)')),
      ''
    ) AS delete_def,
    COALESCE(
      pg_get_functiondef(
        to_regprocedure('public.upsert_visit_photo(uuid,uuid,text,text,integer,integer,integer)')
      ),
      ''
    ) AS upsert_def
),
checks(name, ok) AS (
  VALUES
    (
      'visit-photo:function-current-user-guard',
      to_regprocedure('public.can_manage_own_visit_photo(uuid,uuid)') IS NOT NULL
    ),
    (
      'visit-photo:function-current-user-delete-guard',
      to_regprocedure('public.can_delete_own_visit_photo(uuid,uuid)') IS NOT NULL
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
      'visit-photo:authenticated-can-call-current-user-delete-guard',
      COALESCE(
        has_function_privilege(
          'authenticated',
          to_regprocedure('public.can_delete_own_visit_photo(uuid,uuid)'),
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
      'visit-photo:anon-cannot-call-current-user-delete-guard',
      COALESCE(
        NOT has_function_privilege(
          'anon',
          to_regprocedure('public.can_delete_own_visit_photo(uuid,uuid)'),
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
      'visit-photo:authenticated-cannot-call-internal-delete-helper',
      COALESCE(
        NOT has_function_privilege(
          'authenticated',
          to_regprocedure('public.can_delete_visit_photo(uuid,uuid,uuid)'),
          'EXECUTE'
        ),
        false
      )
    ),
    (
      'visit-photo:manage-guard-respects-uploaded-by',
      COALESCE(
        (SELECT position('uploaded_by' IN manage_def) > 0 FROM function_defs),
        false
      )
    ),
    (
      'visit-photo:delete-guard-respects-uploaded-by-and-admin',
      COALESCE(
        (
          SELECT position('uploaded_by' IN delete_def) > 0
            AND position('has_group_role' IN delete_def) > 0
          FROM function_defs
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
      'visit-photo:delete-policy-uses-current-user-delete-guard',
      COALESCE(
        (
          SELECT position('can_delete_own_visit_photo' IN qual) > 0
            AND position('can_delete_original_visit' IN qual) > 0
            AND position('owner' IN qual) > 0
          FROM pg_policies
          WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND policyname = 'visit photos allowed delete'
            AND cmd = 'DELETE'
        ),
        false
      )
    ),
    (
      'visit-photo:upsert-preserves-uploader-ownership',
      COALESCE(
        (
          SELECT position('_previous_uploader' IN upsert_def) > 0
            AND position('uploaded_by = EXCLUDED.uploaded_by' IN upsert_def) = 0
            AND position('visit_media.uploaded_by = excluded.uploaded_by' IN lower(upsert_def)) > 0
          FROM function_defs
        ),
        false
      )
    ),
    (
      'visit-photo:upsert-serializes-concurrent-first-photo',
      COALESCE(
        (SELECT position('pg_advisory_xact_lock' IN upsert_def) > 0 FROM function_defs),
        false
      )
    ),
    (
      'visit-photo:upsert-requires-owned-storage-object',
      COALESCE(
        (
          SELECT position('storage.objects' IN upsert_def) > 0
            AND position('owner = _uid' IN upsert_def) > 0
          FROM function_defs
        ),
        false
      )
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
