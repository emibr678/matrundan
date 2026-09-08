-- Produktions-preflight för Issue #101 och regressionsfix #244: privata
-- omdömesreaktioner, kommentarsynlighet och notis om senare deltagaromdömen.
-- Körs skrivskyddat efter migration. Alla rader ska ge ok=true.

WITH checks(name, ok) AS (
  VALUES
    ('review_reactions:table',
      to_regclass('public.review_group_reactions') IS NOT NULL),
    ('review_reactions:read-rpc',
      to_regprocedure('public.get_visit_review_reactions_v1(uuid,uuid)') IS NOT NULL),
    ('review_reactions:write-rpc',
      to_regprocedure('public.set_own_review_reaction_v1(uuid,uuid,uuid,text)') IS NOT NULL),
    ('review_reactions:group-and-comment-guard',
      COALESCE(
        position('visit_group_links' IN pg_get_functiondef(to_regprocedure('public.set_own_review_reaction_v1(uuid,uuid,uuid,text)'))) > 0
        AND position('review_group_visibility' IN pg_get_functiondef(to_regprocedure('public.set_own_review_reaction_v1(uuid,uuid,uuid,text)'))) > 0
        AND position('comment_visible=true' IN regexp_replace(
          pg_get_functiondef(to_regprocedure('public.set_own_review_reaction_v1(uuid,uuid,uuid,text)')),
          '[[:space:]]+',
          '',
          'g'
        )) > 0
        AND position('group_is_active' IN pg_get_functiondef(to_regprocedure('public.set_own_review_reaction_v1(uuid,uuid,uuid,text)'))) > 0,
        false
      )),
    ('review_reactions:edit-first-comment-visibility',
      COALESCE(
        position('_previous_comment' IN pg_get_functiondef(to_regprocedure('public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('_normalized_comment' IN pg_get_functiondef(to_regprocedure('public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('review_group_visibility' IN pg_get_functiondef(to_regprocedure('public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('group_id = _group_id' IN pg_get_functiondef(to_regprocedure('public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('rating_visible = true' IN pg_get_functiondef(to_regprocedure('public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('comment_visible = false' IN pg_get_functiondef(to_regprocedure('public.update_own_review(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0,
        false
      )),
    ('review_reactions:read-is-minified',
      COALESCE(
        position('source_group_id' IN pg_get_functiondef(to_regprocedure('public.get_visit_review_reactions_v1(uuid,uuid)'))) = 0
        AND position('comment_visible=true' IN regexp_replace(
          pg_get_functiondef(to_regprocedure('public.get_visit_review_reactions_v1(uuid,uuid)')),
          '[[:space:]]+',
          '',
          'g'
        )) > 0,
        false
      )),
    ('review_reactions:authenticated-rpcs',
      has_function_privilege('authenticated', 'public.get_visit_review_reactions_v1(uuid,uuid)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.set_own_review_reaction_v1(uuid,uuid,uuid,text)', 'EXECUTE')),
    ('review_reactions:no-anon-rpcs',
      NOT has_function_privilege('anon', 'public.get_visit_review_reactions_v1(uuid,uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.set_own_review_reaction_v1(uuid,uuid,uuid,text)', 'EXECUTE')),
    ('review_reactions:no-client-table-read',
      NOT has_table_privilege('authenticated', 'public.review_group_reactions', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.review_group_reactions', 'SELECT')),
    ('review_reactions:no-client-table-write',
      NOT has_table_privilege('authenticated', 'public.review_group_reactions', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.review_group_reactions', 'UPDATE')
      AND NOT has_table_privilege('authenticated', 'public.review_group_reactions', 'DELETE')),
    ('review_reactions:account-delete-cleanup',
      to_regprocedure('public.clear_review_reactions_on_profile_soft_delete()') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.profiles'::regclass
          AND tgname = 'profiles_clear_review_reactions_on_soft_delete'
          AND NOT tgisinternal
      )),
    ('review_notifications:type-enabled',
      COALESCE(
        position('review_added' IN pg_get_functiondef(to_regprocedure('public.set_notification_preference(text,boolean)'))) > 0
        AND position('review_added' IN pg_get_functiondef(to_regprocedure('public.get_notification_settings()'))) > 0,
        false
      )),
    ('review_notifications:first-later-review-only',
      COALESCE(
        position('_existing_review_id IS NULL' IN pg_get_functiondef(to_regprocedure('public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('review_added' IN pg_get_functiondef(to_regprocedure('public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0
        AND position('/besok?group=' IN pg_get_functiondef(to_regprocedure('public.save_own_review_for_visit_v1(uuid,uuid,smallint,smallint,smallint,smallint,text)'))) > 0,
        false
      ))
)
SELECT name, ok
FROM checks
ORDER BY name;
