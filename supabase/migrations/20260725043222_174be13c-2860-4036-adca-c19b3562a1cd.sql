
-- Paket 3A migration (retry med extensions-schema)

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS left_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS rejoined_at timestamptz NULL;

ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_status_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_status_check CHECK (status IN ('active','left'));

UPDATE public.memberships SET status = 'active' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS memberships_active_user_idx
  ON public.memberships(user_id) WHERE status = 'active';

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS accepted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invitations_group_active_idx
  ON public.invitations(group_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS invitations_token_hash_idx
  ON public.invitations(token_hash);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_emoji text NULL;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.has_membership(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships
    WHERE group_id = _group_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_group_role(_group_id uuid, _user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships
    WHERE group_id = _group_id AND user_id = _user_id
      AND status = 'active' AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_group(_user_a uuid, _user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON a.group_id = b.group_id
    WHERE a.user_id = _user_a AND b.user_id = _user_b
      AND a.status = 'active' AND b.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.protect_owner_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _bypass text;
BEGIN
  BEGIN _bypass := current_setting('matrundan.allow_owner_change', true);
  EXCEPTION WHEN OTHERS THEN _bypass := NULL; END;
  IF _bypass = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF (TG_OP = 'UPDATE' AND OLD.role = 'owner') THEN
    RAISE EXCEPTION 'owner membership is immutable; use a dedicated ownership-transfer function';
  END IF;
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') THEN
    RAISE EXCEPTION 'owner membership cannot be deleted directly';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP POLICY IF EXISTS "invitations admins delete" ON public.invitations;
DROP POLICY IF EXISTS "invitations admins insert" ON public.invitations;
DROP POLICY IF EXISTS "invitations admins update" ON public.invitations;
DROP POLICY IF EXISTS "memberships admin update" ON public.memberships;
DROP POLICY IF EXISTS "memberships self leave" ON public.memberships;

CREATE OR REPLACE FUNCTION public._token_hash(_token text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(_token::bytea, 'sha256'::text), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.create_group_invitation(
  _group_id uuid, _invited_email text DEFAULT NULL, _expires_in_days integer DEFAULT 7
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _raw text; _hash text; _id uuid; _exp timestamptz; _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan skapa inbjudningar';
  END IF;
  IF _expires_in_days IS NULL OR _expires_in_days < 1 OR _expires_in_days > 30 THEN
    _expires_in_days := 7;
  END IF;
  _email := NULLIF(lower(trim(coalesce(_invited_email, ''))), '');
  IF _email IS NOT NULL THEN
    UPDATE public.invitations SET revoked_at = now()
      WHERE group_id = _group_id AND lower(invited_email) = _email
        AND accepted_at IS NULL AND revoked_at IS NULL;
  END IF;
  _raw := encode(extensions.gen_random_bytes(32), 'hex');
  _hash := public._token_hash(_raw);
  _exp := now() + make_interval(days => _expires_in_days);
  INSERT INTO public.invitations (group_id, token_hash, invited_email, role, invited_by, expires_at)
  VALUES (_group_id, _hash, _email, 'member', _uid, _exp)
  RETURNING id INTO _id;
  RETURN jsonb_build_object('invitation_id', _id, 'token', _raw, 'expires_at', _exp);
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_group_invitation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _hash text; _row record; _state text;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'state', 'invalid');
  END IF;
  _hash := public._token_hash(_token);
  SELECT i.id, i.group_id, i.expires_at, i.accepted_at, i.revoked_at,
         (i.invited_email IS NOT NULL) AS email_bound,
         g.name AS group_name, g.emoji AS group_emoji
    INTO _row
  FROM public.invitations i
  JOIN public.groups g ON g.id = i.group_id
  WHERE i.token_hash = _hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'state', 'invalid'); END IF;
  IF _row.revoked_at IS NOT NULL THEN _state := 'revoked';
  ELSIF _row.accepted_at IS NOT NULL THEN _state := 'accepted';
  ELSIF _row.expires_at < now() THEN _state := 'expired';
  ELSE _state := 'valid'; END IF;
  RETURN jsonb_build_object(
    'valid', _state = 'valid', 'state', _state,
    'group_id', _row.group_id, 'group_name', _row.group_name,
    'group_emoji', _row.group_emoji, 'expires_at', _row.expires_at,
    'email_bound', _row.email_bound);
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_group_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _email text; _hash text; _inv record; _existing record; _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  _hash := public._token_hash(_token);
  SELECT * INTO _inv FROM public.invitations WHERE token_hash = _hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inbjudan hittades inte'; END IF;
  IF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Inbjudan är återkallad'; END IF;
  IF _inv.accepted_at IS NOT NULL THEN
    IF _inv.accepted_by = _uid THEN
      RETURN jsonb_build_object('group_id', _inv.group_id, 'already', true);
    END IF;
    RAISE EXCEPTION 'Inbjudan är redan använd';
  END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'Inbjudan har gått ut'; END IF;
  IF _inv.invited_email IS NOT NULL AND lower(_inv.invited_email) <> _email THEN
    RAISE EXCEPTION 'Inbjudan är knuten till en annan e-postadress';
  END IF;
  SELECT * INTO _existing FROM public.memberships WHERE group_id = _inv.group_id AND user_id = _uid;
  IF FOUND THEN
    IF _existing.status = 'active' THEN
      UPDATE public.invitations SET accepted_at = now(), accepted_by = _uid WHERE id = _inv.id;
      RETURN jsonb_build_object('group_id', _inv.group_id, 'already', true);
    ELSE
      UPDATE public.memberships
        SET status = 'active', left_at = NULL, rejoined_at = now(),
            role = CASE WHEN role = 'owner' THEN role ELSE 'member' END
        WHERE group_id = _inv.group_id AND user_id = _uid;
    END IF;
  ELSE
    INSERT INTO public.memberships (group_id, user_id, role, status)
    VALUES (_inv.group_id, _uid, 'member', 'active');
  END IF;
  UPDATE public.invitations SET accepted_at = now(), accepted_by = _uid WHERE id = _inv.id;
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, payload)
  VALUES (_inv.group_id, 'member-joined', _uid,
    jsonb_build_object('text', coalesce(_actor_name, 'Någon') || ' gick med i gruppen'));
  RETURN jsonb_build_object('group_id', _inv.group_id, 'already', false);
END; $$;

REVOKE EXECUTE ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_group_invitation(_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _gid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT group_id INTO _gid FROM public.invitations WHERE id = _invitation_id;
  IF _gid IS NULL THEN RAISE EXCEPTION 'Inbjudan finns inte'; END IF;
  IF NOT public.has_group_role(_gid, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan återkalla inbjudningar';
  END IF;
  UPDATE public.invitations SET revoked_at = now()
    WHERE id = _invitation_id AND revoked_at IS NULL AND accepted_at IS NULL;
END; $$;

REVOKE EXECUTE ON FUNCTION public.revoke_group_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_group_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_group_invitations(_group_id uuid)
RETURNS TABLE(id uuid, invited_email text, role text, invited_by uuid,
  invited_by_name text, expires_at timestamptz, accepted_at timestamptz,
  revoked_at timestamptz, created_at timestamptz, state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.invited_email, i.role, i.invited_by,
         p.display_name, i.expires_at, i.accepted_at, i.revoked_at, i.created_at,
         CASE
           WHEN i.revoked_at IS NOT NULL THEN 'revoked'
           WHEN i.accepted_at IS NOT NULL THEN 'accepted'
           WHEN i.expires_at < now() THEN 'expired'
           ELSE 'active' END
  FROM public.invitations i
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.group_id = _group_id
    AND public.has_group_role(_group_id, auth.uid(), ARRAY['owner','admin'])
  ORDER BY i.created_at DESC LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.list_group_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_invitations(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_profile(_display_name text, _avatar_emoji text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _name := trim(coalesce(_display_name, ''));
  IF length(_name) < 2 OR length(_name) > 50 THEN
    RAISE EXCEPTION 'Namnet måste vara 2–50 tecken';
  END IF;
  INSERT INTO public.profiles (id, display_name, avatar_emoji)
  VALUES (_uid, _name, NULLIF(_avatar_emoji, ''))
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        avatar_emoji = EXCLUDED.avatar_emoji,
        updated_at = now();
END; $$;

REVOKE EXECUTE ON FUNCTION public.update_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_group_settings(
  _group_id uuid, _name text, _emoji text DEFAULT NULL, _home_label text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _n text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ändra gruppens inställningar';
  END IF;
  _n := trim(coalesce(_name, ''));
  IF length(_n) < 2 OR length(_n) > 60 THEN
    RAISE EXCEPTION 'Gruppnamnet måste vara 2–60 tecken';
  END IF;
  UPDATE public.groups
    SET name = _n,
        emoji = NULLIF(trim(coalesce(_emoji, '')), ''),
        home_location_label = NULLIF(trim(coalesce(_home_label, '')), ''),
        updated_at = now()
    WHERE id = _group_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.update_group_settings(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_settings(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_member_role(_group_id uuid, _user_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _target record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Endast ägaren kan ändra roller';
  END IF;
  IF _role NOT IN ('member','admin') THEN RAISE EXCEPTION 'Ogiltig roll'; END IF;
  SELECT * INTO _target FROM public.memberships WHERE group_id = _group_id AND user_id = _user_id;
  IF NOT FOUND OR _target.status <> 'active' THEN
    RAISE EXCEPTION 'Medlemmen är inte aktiv i gruppen';
  END IF;
  IF _target.role = 'owner' THEN
    RAISE EXCEPTION 'Ägarens roll ändras via ägaröverföring';
  END IF;
  UPDATE public.memberships SET role = _role WHERE group_id = _group_id AND user_id = _user_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_group_member(_group_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _actor_role text; _target record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _uid = _user_id THEN RAISE EXCEPTION 'Använd Lämna gruppen'; END IF;
  SELECT role INTO _actor_role FROM public.memberships
    WHERE group_id = _group_id AND user_id = _uid AND status = 'active';
  IF _actor_role IS NULL OR _actor_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Otillräcklig behörighet';
  END IF;
  SELECT * INTO _target FROM public.memberships WHERE group_id = _group_id AND user_id = _user_id;
  IF NOT FOUND OR _target.status <> 'active' THEN
    RAISE EXCEPTION 'Medlemmen är inte aktiv i gruppen';
  END IF;
  IF _target.role = 'owner' THEN RAISE EXCEPTION 'Ägaren kan inte tas bort'; END IF;
  IF _actor_role = 'admin' AND _target.role <> 'member' THEN
    RAISE EXCEPTION 'Admin kan bara ta bort vanliga medlemmar';
  END IF;
  UPDATE public.memberships SET status = 'left', left_at = now()
    WHERE group_id = _group_id AND user_id = _user_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_group(_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _m record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _m FROM public.memberships WHERE group_id = _group_id AND user_id = _uid;
  IF NOT FOUND OR _m.status <> 'active' THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _m.role = 'owner' THEN
    RAISE EXCEPTION 'Ägaren kan inte lämna gruppen förrän ägarskapet är överfört';
  END IF;
  UPDATE public.memberships SET status = 'left', left_at = now()
    WHERE group_id = _group_id AND user_id = _uid;
END; $$;

REVOKE EXECUTE ON FUNCTION public.leave_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_group(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_group_ownership(_group_id uuid, _new_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _target record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _uid = _new_owner_id THEN RAISE EXCEPTION 'Du är redan ägare'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Endast nuvarande ägare kan överföra ägarskapet';
  END IF;
  SELECT * INTO _target FROM public.memberships WHERE group_id = _group_id AND user_id = _new_owner_id;
  IF NOT FOUND OR _target.status <> 'active' OR _target.role NOT IN ('member','admin') THEN
    RAISE EXCEPTION 'Mottagaren måste vara aktiv medlem eller admin';
  END IF;
  PERFORM set_config('matrundan.allow_owner_change', 'on', true);
  UPDATE public.memberships SET role = 'admin' WHERE group_id = _group_id AND user_id = _uid;
  UPDATE public.memberships SET role = 'owner' WHERE group_id = _group_id AND user_id = _new_owner_id;
  PERFORM set_config('matrundan.allow_owner_change', 'off', true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
