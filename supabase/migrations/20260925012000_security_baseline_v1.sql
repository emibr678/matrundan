BEGIN;

-- Issue #399: stäng historisk Data API-drift och gör framtida objekt
-- default-deny. Befintliga explicita service_role-grants lämnas orörda.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;

-- Normalisera den direkta klientytan till den redan verifierade stagingmodellen.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE, DELETE ON TABLE public.activity TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_next_place TO authenticated;
GRANT SELECT, INSERT ON TABLE public.groups TO authenticated;
GRANT SELECT ON TABLE public.memberships TO authenticated;
GRANT SELECT ON TABLE public.notification_preferences TO authenticated;
GRANT SELECT ON TABLE public.places TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.visit_media TO authenticated;

-- Pushabonnemang, notispreferenser och outbox saknar profil-FK och måste
-- rensas explicit när kontoborttagningen soft-deletar profilen.
CREATE OR REPLACE FUNCTION public.clear_private_notifications_on_profile_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.push_subscriptions WHERE user_id = OLD.id;
    DELETE FROM public.notification_preferences WHERE user_id = OLD.id;
    DELETE FROM public.notification_outbox WHERE user_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_private_notifications_on_profile_soft_delete()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_clear_private_notifications_on_soft_delete
  ON public.profiles;
CREATE TRIGGER profiles_clear_private_notifications_on_soft_delete
AFTER UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.clear_private_notifications_on_profile_soft_delete();

-- Service-role-only driftkontroll. Resultatet innehåller kontrollnamn men
-- aldrig användar-, grupp- eller mediainnehåll.
CREATE OR REPLACE FUNCTION public.run_release_security_gate_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH expected_authenticated(table_name, privilege_type) AS (
    VALUES
      ('activity', 'DELETE'),
      ('activity', 'SELECT'),
      ('activity', 'UPDATE'),
      ('favorites', 'DELETE'),
      ('favorites', 'INSERT'),
      ('favorites', 'SELECT'),
      ('favorites', 'UPDATE'),
      ('group_next_place', 'DELETE'),
      ('group_next_place', 'INSERT'),
      ('group_next_place', 'SELECT'),
      ('group_next_place', 'UPDATE'),
      ('groups', 'INSERT'),
      ('groups', 'SELECT'),
      ('memberships', 'SELECT'),
      ('notification_preferences', 'SELECT'),
      ('places', 'SELECT'),
      ('profiles', 'SELECT'),
      ('push_subscriptions', 'SELECT'),
      ('visit_media', 'SELECT')
  ),
  actual_authenticated AS (
    SELECT DISTINCT table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee = 'authenticated'
  ),
  forbidden_default_acl AS (
    SELECT 1
    FROM pg_catalog.pg_default_acl defaults
    CROSS JOIN LATERAL pg_catalog.aclexplode(defaults.defaclacl) acl
    LEFT JOIN pg_catalog.pg_roles granted_role
      ON granted_role.oid = acl.grantee
    WHERE defaults.defaclrole = (
      SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'postgres'
    )
      AND defaults.defaclnamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public'
      )
      AND (
        acl.grantee = 0
        OR granted_role.rolname IN ('anon', 'authenticated', 'service_role')
      )
  ),
  checks(name, ok) AS (
    SELECT
      'table-grants:anon-none',
      NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee = 'anon'
      )

    UNION ALL

    SELECT
      'table-grants:authenticated-exact',
      NOT EXISTS (
        (SELECT table_name, privilege_type FROM actual_authenticated
         EXCEPT
         SELECT table_name, privilege_type FROM expected_authenticated)
        UNION ALL
        (SELECT table_name, privilege_type FROM expected_authenticated
         EXCEPT
         SELECT table_name, privilege_type FROM actual_authenticated)
      )

    UNION ALL

    SELECT
      'default-privileges:least-privilege',
      NOT EXISTS (SELECT 1 FROM forbidden_default_acl)
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_default_acl defaults
        WHERE defaults.defaclrole = (
          SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'postgres'
        )
          AND defaults.defaclnamespace = (
            SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public'
          )
          AND defaults.defaclobjtype = 'f'
      )

    UNION ALL

    SELECT
      'rls:all-public-tables',
      NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class relation
        JOIN pg_catalog.pg_namespace namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p')
          AND pg_catalog.pg_get_userbyid(relation.relowner) = 'postgres'
          AND relation.relrowsecurity = false
      )

    UNION ALL

    SELECT
      'security-definer:search-path',
      NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc function
        JOIN pg_catalog.pg_namespace namespace
          ON namespace.oid = function.pronamespace
        WHERE namespace.nspname = 'public'
          AND function.prosecdef
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(COALESCE(function.proconfig, ARRAY[]::text[])) config
            WHERE config LIKE 'search_path=%'
          )
      )

    UNION ALL

    SELECT
      'security-definer:anon-allowlist',
      NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc function
        JOIN pg_catalog.pg_namespace namespace
          ON namespace.oid = function.pronamespace
        WHERE namespace.nspname = 'public'
          AND function.prosecdef
          AND pg_catalog.has_function_privilege('anon', function.oid, 'EXECUTE')
          AND function.proname <> 'get_invitation_preview'
      )
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc function
        JOIN pg_catalog.pg_namespace namespace
          ON namespace.oid = function.pronamespace
        WHERE namespace.nspname = 'public'
          AND function.prosecdef
          AND function.proname = 'get_invitation_preview'
          AND pg_catalog.has_function_privilege('anon', function.oid, 'EXECUTE')
      )

    UNION ALL

    SELECT
      'storage:private-jpeg-bucket',
      EXISTS (
        SELECT 1
        FROM storage.buckets bucket
        WHERE bucket.id = 'visit-photos'
          AND bucket.public = false
          AND bucket.file_size_limit = 1500000
          AND bucket.allowed_mime_types = ARRAY['image/jpeg']::text[]
      )

    UNION ALL

    SELECT
      'storage:policy-set',
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'visit photos members read'
      )
      AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'visit photos allowed upload'
      )
      AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'visit photos allowed delete'
      )

    UNION ALL

    SELECT
      'account-delete:private-notifications-trigger',
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger trigger
        JOIN pg_catalog.pg_class relation ON relation.oid = trigger.tgrelid
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname = 'profiles'
          AND trigger.tgname = 'profiles_clear_private_notifications_on_soft_delete'
          AND trigger.tgenabled <> 'D'
          AND NOT trigger.tgisinternal
      )

    UNION ALL

    SELECT
      'release-gate:service-role-only',
      pg_catalog.has_function_privilege(
        'service_role',
        'public.run_release_security_gate_v1()',
        'EXECUTE'
      )
      AND NOT pg_catalog.has_function_privilege(
        'authenticated',
        'public.run_release_security_gate_v1()',
        'EXECUTE'
      )
      AND NOT pg_catalog.has_function_privilege(
        'anon',
        'public.run_release_security_gate_v1()',
        'EXECUTE'
      )
  )
  SELECT jsonb_build_object(
    'ok',
    COALESCE(bool_and(ok), false),
    'failedChecks',
    COALESCE(
      jsonb_agg(name ORDER BY name) FILTER (WHERE NOT ok),
      '[]'::jsonb
    )
  )
  FROM checks;
$function$;

REVOKE ALL ON FUNCTION public.run_release_security_gate_v1()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_release_security_gate_v1()
  TO service_role;

COMMIT;
