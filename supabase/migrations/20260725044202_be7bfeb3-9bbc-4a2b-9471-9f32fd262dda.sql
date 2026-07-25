
-- 1) Invitations: sluta exponera token_hash för klienten.
DROP POLICY IF EXISTS "invitations admins read" ON public.invitations;
DROP POLICY IF EXISTS "invitations admins insert" ON public.invitations;
DROP POLICY IF EXISTS "invitations admins update" ON public.invitations;
DROP POLICY IF EXISTS "invitations admins delete" ON public.invitations;

REVOKE ALL ON public.invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.invitations TO service_role;

-- Behåll RLS PÅ (defense in depth) – utan grants + utan policies är tabellen otillgänglig
-- från anon/authenticated, medan SECURITY DEFINER-RPC:erna fortsätter att fungera.

-- Intern hjälpare för token-hash ska inte kunna anropas direkt från klienten.
REVOKE ALL ON FUNCTION public._token_hash(text) FROM PUBLIC, anon, authenticated;

-- 2) shares_group: viewer måste vara aktiv, target får vara aktiv eller lämnad.
CREATE OR REPLACE FUNCTION public.shares_group(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON a.group_id = b.group_id
    WHERE a.user_id = _user_a AND a.status = 'active'
      AND b.user_id = _user_b
  );
$$;

-- 3) Exakt en aktiv ägare per grupp – ersätt äldre partial index som inte
-- tog hänsyn till status. Data är redan konsekvent (0 grupper med >1 aktiv ägare).
DROP INDEX IF EXISTS public.memberships_one_owner_per_group;
CREATE UNIQUE INDEX memberships_one_active_owner_per_group
  ON public.memberships (group_id)
  WHERE role = 'owner' AND status = 'active';

-- 4) Lås direkta skrivrättigheter på memberships/profiles – alla mutationer
--    går via RPC:erna. SELECT behålls för session/live-repository.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.memberships FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 5) Rensa nu redundanta RLS-policies på memberships/profiles som gav
--    direktskrivrättigheter – utan grant kan de ändå inte köras, men
--    stäng ytan explicit.
DROP POLICY IF EXISTS "memberships admin update" ON public.memberships;
DROP POLICY IF EXISTS "memberships self leave" ON public.memberships;
DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
