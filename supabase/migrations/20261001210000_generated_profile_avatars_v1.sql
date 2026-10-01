BEGIN;

-- Issue #102: personliga avatarer med lokalt genererad Multiavatar.
-- avatar_url är den effektiva bildreferensen som befintliga read-modeller redan
-- exponerar: provider-URL för kontobild eller ett lokalt multiavatar-token.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_kind text NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS avatar_seed text NULL;

UPDATE public.profiles
SET avatar_kind = CASE
      WHEN NULLIF(trim(COALESCE(avatar_emoji, '')), '') IS NOT NULL THEN 'emoji'
      ELSE 'account'
    END;

UPDATE public.profiles
SET avatar_url = NULL
WHERE avatar_kind = 'emoji';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_kind_check,
  DROP CONSTRAINT IF EXISTS profiles_avatar_seed_check,
  ADD CONSTRAINT profiles_avatar_kind_check
    CHECK (avatar_kind IN ('account', 'generated', 'emoji')),
  ADD CONSTRAINT profiles_avatar_seed_check
    CHECK (
      avatar_seed IS NULL
      OR (
        length(avatar_seed) BETWEEN 8 AND 100
        AND avatar_seed ~ '^[A-Za-z0-9._-]+$'
      )
    );

CREATE OR REPLACE FUNCTION public.update_profile_v2(
  _display_name text,
  _avatar_kind text,
  _avatar_emoji text DEFAULT NULL,
  _avatar_seed text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _kind text;
  _emoji text;
  _seed text;
  _existing_seed text;
  _account_avatar text;
  _effective_avatar_url text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  _name := trim(COALESCE(_display_name, ''));
  IF length(_name) < 2 OR length(_name) > 50 THEN
    RAISE EXCEPTION 'Namnet måste vara 2–50 tecken';
  END IF;

  _kind := lower(trim(COALESCE(_avatar_kind, '')));
  IF _kind NOT IN ('account', 'generated', 'emoji') THEN
    RAISE EXCEPTION 'Ogiltigt avatarval';
  END IF;

  SELECT profile.avatar_seed
  INTO _existing_seed
  FROM public.profiles profile
  WHERE profile.id = _uid;

  _seed := COALESCE(NULLIF(trim(COALESCE(_avatar_seed, '')), ''), _existing_seed);
  IF _seed IS NOT NULL
     AND (length(_seed) < 8 OR length(_seed) > 100 OR _seed !~ '^[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'Ogiltig avatar-seed';
  END IF;
  IF _kind = 'generated' AND _seed IS NULL THEN
    RAISE EXCEPTION 'En genererad avatar måste ha en seed';
  END IF;

  _emoji := CASE
    WHEN _kind = 'emoji' THEN NULLIF(trim(COALESCE(_avatar_emoji, '')), '')
    ELSE NULL
  END;
  IF _kind = 'emoji' AND _emoji IS NULL THEN
    RAISE EXCEPTION 'Välj en emoji';
  END IF;
  IF _emoji IS NOT NULL AND length(_emoji) > 16 THEN
    RAISE EXCEPTION 'Ogiltig emoji';
  END IF;

  SELECT COALESCE(
    NULLIF(trim(raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(trim(raw_user_meta_data->>'picture'), '')
  )
  INTO _account_avatar
  FROM auth.users
  WHERE id = _uid;

  _effective_avatar_url := CASE _kind
    WHEN 'account' THEN _account_avatar
    WHEN 'generated' THEN 'multiavatar:v1:' || _seed
    ELSE NULL
  END;

  INSERT INTO public.profiles (
    id, display_name, avatar_kind, avatar_seed, avatar_emoji, avatar_url
  )
  VALUES (
    _uid, _name, _kind, _seed, _emoji, _effective_avatar_url
  )
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      avatar_kind = EXCLUDED.avatar_kind,
      avatar_seed = EXCLUDED.avatar_seed,
      avatar_emoji = EXCLUDED.avatar_emoji,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.update_profile_v2(text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_v2(text, text, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.update_profile(
  _display_name text,
  _avatar_emoji text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.update_profile_v2(
    _display_name,
    CASE
      WHEN NULLIF(trim(COALESCE(_avatar_emoji, '')), '') IS NULL THEN 'account'
      ELSE 'emoji'
    END,
    _avatar_emoji,
    NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_profile(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile(text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.scrub_profile_avatar_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    NEW.avatar_kind := 'account';
    NEW.avatar_seed := NULL;
    NEW.avatar_url := NULL;
    NEW.avatar_emoji := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.scrub_profile_avatar_on_delete()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_scrub_profile_avatar_on_delete ON public.profiles;
CREATE TRIGGER trg_scrub_profile_avatar_on_delete
BEFORE UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.scrub_profile_avatar_on_delete();

DO $assertions$
DECLARE
  _update_def text := pg_get_functiondef(
    'public.update_profile_v2(text,text,text,text)'::regprocedure
  );
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'avatar_kind'
      AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'avatar_seed'
  ) THEN
    RAISE EXCEPTION 'profilens avatarkolumner saknas';
  END IF;

  IF position('auth.users' IN _update_def) = 0
     OR position('multiavatar:v1:' IN _update_def) = 0 THEN
    RAISE EXCEPTION 'profiluppdateringen bevarar inte kontobild eller lokal avatar-token';
  END IF;

  IF has_function_privilege('anon', 'public.update_profile_v2(text,text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege(
       'authenticated',
       'public.update_profile_v2(text,text,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'update_profile_v2 har fel execute-grants';
  END IF;
END;
$assertions$;

NOTIFY pgrst, 'reload schema';

COMMIT;
