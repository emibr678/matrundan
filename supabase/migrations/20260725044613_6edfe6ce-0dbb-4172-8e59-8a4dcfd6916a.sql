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
            role = 'member'
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