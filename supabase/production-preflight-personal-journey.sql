-- Issue #109 — driftgrind för Min matresas server-side read-modell.
WITH checks(name, ok) AS (
  VALUES
    ('personal_journey:overview-v1',
      to_regprocedure('public.get_personal_journey_overview_v1()') IS NOT NULL),
    ('personal_journey:places-v1',
      to_regprocedure('public.list_personal_journey_places_v1(text,boolean,boolean,text,uuid,integer)') IS NOT NULL),
    ('personal_journey:place-detail-v1',
      to_regprocedure('public.get_personal_journey_place_v1(uuid)') IS NOT NULL),
    ('personal_journey:visits-v1',
      to_regprocedure('public.list_personal_journey_visits_v1(boolean,date,uuid,integer)') IS NOT NULL),
    ('personal_journey:visit-detail-v1',
      to_regprocedure('public.get_personal_journey_visit_v1(uuid)') IS NOT NULL),
    ('personal_journey:favorites-group-scope',
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint constraint_row
        JOIN pg_catalog.pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND table_row.relname = 'favorites'
          AND constraint_row.contype = 'p'
          AND pg_get_constraintdef(constraint_row.oid) = 'PRIMARY KEY (user_id, place_id, group_id)'
      )),
    ('personal_journey:index-participant-user',
      to_regclass('public.visit_participants_user_visit_idx') IS NOT NULL),
    ('personal_journey:index-review-visibility-group',
      to_regclass('public.review_group_visibility_group_review_idx') IS NOT NULL),
    ('personal_journey:source-media-delivery-trigger',
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger trigger_row
        WHERE trigger_row.tgname = 'trg_visit_media_personal_journey_visibility'
          AND NOT trigger_row.tgisinternal
      )),
    ('personal_journey:auth-grants',
      COALESCE(has_function_privilege('authenticated', to_regprocedure('public.get_personal_journey_overview_v1()'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege('authenticated', to_regprocedure('public.list_personal_journey_places_v1(text,boolean,boolean,text,uuid,integer)'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege('authenticated', to_regprocedure('public.get_personal_journey_place_v1(uuid)'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege('authenticated', to_regprocedure('public.list_personal_journey_visits_v1(boolean,date,uuid,integer)'), 'EXECUTE'), false)
      AND COALESCE(has_function_privilege('authenticated', to_regprocedure('public.get_personal_journey_visit_v1(uuid)'), 'EXECUTE'), false)),
    ('personal_journey:no-anon-grants',
      COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.get_personal_journey_overview_v1()'), 'EXECUTE'), false)
      AND COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.list_personal_journey_places_v1(text,boolean,boolean,text,uuid,integer)'), 'EXECUTE'), false)
      AND COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.get_personal_journey_place_v1(uuid)'), 'EXECUTE'), false)
      AND COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.list_personal_journey_visits_v1(boolean,date,uuid,integer)'), 'EXECUTE'), false)
      AND COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.get_personal_journey_visit_v1(uuid)'), 'EXECUTE'), false)),
    ('personal_journey:helper-private',
      COALESCE(NOT has_function_privilege('anon', to_regprocedure('public.personal_journey_effective_review_overall_v1(uuid)'), 'EXECUTE'), false)
      AND COALESCE(NOT has_function_privilege('authenticated', to_regprocedure('public.personal_journey_effective_review_overall_v1(uuid)'), 'EXECUTE'), false)
      AND COALESCE(NOT has_function_privilege('authenticated', to_regprocedure('public.ensure_personal_journey_media_visibility_v1()'), 'EXECUTE'), false)),
    ('personal_journey:no-user-or-group-input',
      to_regprocedure('public.get_personal_journey_overview_v1(uuid)') IS NULL
      AND to_regprocedure('public.get_personal_journey_overview_v1(uuid[])') IS NULL)
)
SELECT name, ok
FROM checks
ORDER BY name;
