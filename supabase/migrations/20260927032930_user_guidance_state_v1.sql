BEGIN;

-- Versionsstyrd, kontobunden produktguidning. Gruppdata avgör när en guide är
-- relevant, men kvittot ägs av användaren och följer med mellan grupper.
CREATE TABLE public.user_guidance_state (
  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  guidance_key text NOT NULL
    CHECK (
      length(guidance_key) BETWEEN 1 AND 80
      AND guidance_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),
  guidance_version integer NOT NULL
    CHECK (guidance_version > 0),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, guidance_key, guidance_version)
);

COMMENT ON TABLE public.user_guidance_state IS
  'Kontobundna kvitton för versionsstyrd produktguidning.';

REVOKE ALL ON public.user_guidance_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.user_guidance_state TO authenticated;
GRANT ALL ON public.user_guidance_state TO service_role;

ALTER TABLE public.user_guidance_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_guidance_state_select_own
ON public.user_guidance_state
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_guidance_state_insert_own
ON public.user_guidance_state
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Befintliga användare som redan har eller har haft ett gruppmedlemskap ska inte
-- få kärnintroduktionen retroaktivt. Den mer specifika Passar för-guiden
-- backfillas inte.
INSERT INTO public.user_guidance_state (
  user_id,
  guidance_key,
  guidance_version
)
SELECT
  profile.id,
  'core-intro',
  1
FROM public.profiles profile
WHERE profile.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE membership.user_id = profile.id
  )
ON CONFLICT (user_id, guidance_key, guidance_version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.clear_user_guidance_on_profile_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.user_guidance_state
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_user_guidance_on_profile_soft_delete()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_clear_user_guidance_on_soft_delete
ON public.profiles;

CREATE TRIGGER profiles_clear_user_guidance_on_soft_delete
AFTER UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.clear_user_guidance_on_profile_soft_delete();

COMMIT;
