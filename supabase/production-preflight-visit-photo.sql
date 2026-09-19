-- Kompletterande skrivskyddad produktionskontroll för besöksbilder.
-- Kör efter den ordinarie supabase/production-preflight.sql när migrationen
-- 20260919164000_visit_photo_gallery_v1.sql har driftsatts.

WITH function_defs AS (
  SELECT
    COALESCE(
      pg_get_functiondef(to_regprocedure('public.can_manage_visit_photo(uuid,uuid,uuid)')),
      ''
    ) AS manage_def,
    COALESCE(
      pg_get_functiondef(to_regprocedure('public.can_delete_visit_photo(uuid,uuid,uuid,uuid)')),
      ''
    ) AS delete_def,
    COALESCE(
      pg_get_functiondef(
        to_regprocedure('public.upsert_visit_photo(uuid,uuid,text,text,integer,integer,integer)')
      ),
      ''
    ) AS upsert_def,
    COALESCE(
      pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5c(uuid)')),
      ''
    ) AS v5c_def,
    COALESCE(
      pg_get_functiondef(to_regprocedure('public.get_group_app_state_v5m(uuid)')),
      ''
    ) AS v5m_def
),
checks(name, ok) AS (
  VALUES
    (
      'visit-photo:one-active-photo-per-participant',
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND table_row.relname = 'visit_media'
          AND constraint_row.conname = 'visit_media_visit_group_uploader_unique'
          AND lower(pg_get_constraintdef(constraint_row.oid))
            LIKE '%unique (visit_id, group_id, uploaded_by)%'
      )
    ),
    (
      'visit-photo:legacy-single-photo-constraint-removed',
      NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND table_row.relname = 'visit_media'
          AND constraint_row.conname = 'visit_media_visit_group_unique'
      )
    ),
    (
      'visit-photo:actual-participant-required-for-upload',
      COALESCE(
        (
          SELECT position('visit_participants' IN manage_def) > 0
            AND position('has_group_role' IN manage_def) = 0
          FROM function_defs
        ),
        false
      )
    ),
    (
      'visit-photo:targeted-delete-supports-owner-admin-moderation',
      COALESCE(
        (
          SELECT position('uploaded_by' IN delete_def) > 0
            AND position('has_group_role' IN delete_def) > 0
            AND position('owner' IN delete_def) > 0
            AND position('admin' IN delete_def) > 0
          FROM function_defs
        ),
        false
      )
    ),
    (
      'visit-photo:authenticated-can-call-current-user-upload-guard',
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
      'visit-photo:authenticated-can-call-current-user-delete-path-guard',
      COALESCE(
        has_function_privilege(
          'authenticated',
          to_regprocedure('public.can_delete_own_visit_photo_path(text)'),
          'EXECUTE'
        ),
        false
      )
    ),
    (
      'visit-photo:authenticated-cannot-call-internal-manage-helper',
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
          to_regprocedure('public.can_delete_visit_photo(uuid,uuid,uuid,uuid)'),
          'EXECUTE'
        ),
        false
      )
    ),
    (
      'visit-photo:authenticated-can-call-targeted-delete',
      COALESCE(
        has_function_privilege(
          'authenticated',
          to_regprocedure('public.delete_visit_photo_v2(uuid,uuid,uuid)'),
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
      'visit-photo:delete-policy-uses-target-aware-path-guard',
      COALESCE(
        (
          SELECT position('can_delete_own_visit_photo_path' IN qual) > 0
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
      'visit-photo:delete-policy-cleans-moderated-orphan',
      COALESCE(
        (
          SELECT position('has_group_role' IN qual) > 0
            AND position('can_delete_original_visit' IN qual) > 0
            AND position('not exists' IN lower(qual)) > 0
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
      'visit-photo:upsert-conflicts-per-uploader',
      COALESCE(
        (
          SELECT position(
            'on conflict (visit_id, group_id, uploaded_by)'
            IN lower(upsert_def)
          ) > 0
          FROM function_defs
        ),
        false
      )
    ),
    (
      'visit-photo:upsert-serializes-own-slot',
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
    ),
    (
      'visit-photo:legacy-read-model-keeps-one-representative',
      COALESCE(
        (
          SELECT position('order by vm.created_at, vm.id' IN lower(v5c_def)) > 0
            AND position('limit 1' IN lower(v5c_def)) > 0
          FROM function_defs
        ),
        false
      )
    ),
    (
      'visit-photo:current-read-model-exposes-photo-array',
      COALESCE(
        (
          SELECT position('''photos''' IN lower(v5m_def)) > 0
            AND position('visit_media' IN lower(v5m_def)) > 0
          FROM function_defs
        ),
        false
      )
    )
)
SELECT name, ok
FROM checks
ORDER BY name;
