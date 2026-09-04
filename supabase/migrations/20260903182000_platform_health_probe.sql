BEGIN;

-- Minimal, data-free database activity for the public platform health endpoint.
-- The function intentionally reads no group/user data and is safe for anon calls.
CREATE OR REPLACE FUNCTION public.health_probe_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT true;
$function$;

REVOKE ALL ON FUNCTION public.health_probe_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_probe_v1() TO anon, authenticated, service_role;

COMMIT;
