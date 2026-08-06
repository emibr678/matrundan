-- Issue #142: skilj fleranvändarlänkar från e-postbundna engångsinbjudningar.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS is_multi_use boolean NOT NULL DEFAULT false;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.invitations'::regclass
      AND conname = 'invitations_multi_use_requires_open_check'
  ) THEN
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_multi_use_requires_open_check
      CHECK (NOT is_multi_use OR invited_email IS NULL) NOT VALID;
  END IF;
END;
$constraint$;

ALTER TABLE public.invitations
  VALIDATE CONSTRAINT invitations_multi_use_requires_open_check;

-- Bevara tidigare använda, återkallade och utgångna länkar som stängda.
-- Endast aktiva och oanvända äldre länkar utan e-post får det nya kontraktet.
UPDATE public.invitations
SET is_multi_use = true
WHERE invited_email IS NULL
  AND accepted_at IS NULL
  AND revoked_at IS NULL
  AND expires_at >= now()
  AND is_multi_use = false;

CREATE OR REPLACE FUNCTION public.create_group_invitation(
  _group_id uuid,
  _invited_email text DEFAULT NULL,
  _expires_in_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _raw text;
  _hash text;
  _id uuid;
  _exp timestamptz;
  _email text;
  _is_multi_use boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan skapa inbjudningar';
  END IF;

  IF _expires_in_days IS NULL OR _expires_in_days < 1 OR _expires_in_days > 30 THEN
    _expires_in_days := 7;
  END IF;

  _email := NULLIF(lower(trim(coalesce(_invited_email, ''))), '');
  _is_multi_use := _email IS NULL;

  IF _email IS NOT NULL THEN
    UPDATE public.invitations
    SET revoked_at = now()
    WHERE group_id = _group_id
      AND lower(invited_email) = _email
      AND accepted_at IS NULL
      AND revoked_at IS NULL;
  END IF;

  _raw := encode(extensions.gen_random_bytes(32), 'hex');
  _hash := public._token_hash(_raw);
  _exp := now() + make_interval(days => _expires_in_days);

  INSERT INTO public.invitations (
    group_id,
    token_hash,
    invited_email,
    role,
    invited_by,
    expires_at,
    is_multi_use
  )
  VALUES (
    _group_id,
    _hash,
    _email,
    'member',
    _uid,
    _exp,
    _is_multi_use
  )
  RETURNING id INTO _id;

  RETURN jsonb_build_object(
    'invitation_id', _id,
    'token', _raw,
    'expires_at', _exp,
    'is_multi_use', _is_multi_use
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_group_invitation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  _hash text;
  _row record;
  _state text;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'state', 'invalid');
  END IF;

  _hash := public._token_hash(_token);

  SELECT
    i.id,
    i.group_id,
    i.expires_at,
    i.accepted_at,
    i.revoked_at,
    i.is_multi_use,
    (i.invited_email IS NOT NULL) AS email_bound,
    g.name AS group_name,
    g.emoji AS group_emoji
  INTO _row
  FROM public.invitations i
  JOIN public.groups g ON g.id = i.group_id
  WHERE i.token_hash = _hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'state', 'invalid');
  END IF;

  IF _row.revoked_at IS NOT NULL THEN
    _state := 'revoked';
  ELSIF NOT _row.is_multi_use AND _row.accepted_at IS NOT NULL THEN
    _state := 'accepted';
  ELSIF _row.expires_at < now() THEN
    _state := 'expired';
  ELSE
    _state := 'valid';
  END IF;

  RETURN jsonb_build_object(
    'valid', _state = 'valid',
    'state', _state,
    'group_id', _row.group_id,
    'group_name', _row.group_name,
    'group_emoji', _row.group_emoji,
    'expires_at', _row.expires_at,
    'email_bound', _row.email_bound,
    'is_multi_use', _row.is_multi_use
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_group_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _hash text;
  _inv record;
  _existing record;
  _actor_name text;
  _joined boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _email := lower(coalesce(auth.jwt() ->> 'email', ''));
  _hash := public._token_hash(_token);

  SELECT *
  INTO _inv
  FROM public.invitations
  WHERE token_hash = _hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inbjudan hittades inte';
  END IF;

  IF _inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Inbjudan är återkallad';
  END IF;

  IF NOT _inv.is_multi_use AND _inv.accepted_at IS NOT NULL THEN
    IF _inv.accepted_by = _uid THEN
      RETURN jsonb_build_object('group_id', _inv.group_id, 'already', true);
    END IF;
    RAISE EXCEPTION 'Inbjudan är redan använd';
  END IF;

  IF _inv.expires_at < now() THEN
    RAISE EXCEPTION 'Inbjudan har gått ut';
  END IF;

  IF _inv.invited_email IS NOT NULL AND lower(_inv.invited_email) <> _email THEN
    RAISE EXCEPTION 'Inbjudan är knuten till en annan e-postadress';
  END IF;

  SELECT *
  INTO _existing
  FROM public.memberships
  WHERE group_id = _inv.group_id
    AND user_id = _uid;

  IF FOUND THEN
    IF _existing.status = 'active' THEN
      IF NOT _inv.is_multi_use THEN
        UPDATE public.invitations
        SET accepted_at = now(), accepted_by = _uid
        WHERE id = _inv.id;
      END IF;

      RETURN jsonb_build_object('group_id', _inv.group_id, 'already', true);
    END IF;

    UPDATE public.memberships
    SET
      status = 'active',
      left_at = NULL,
      rejoined_at = now(),
      role = CASE WHEN role = 'owner' THEN role ELSE 'member' END
    WHERE group_id = _inv.group_id
      AND user_id = _uid;

    _joined := true;
  ELSE
    INSERT INTO public.memberships (group_id, user_id, role, status)
    VALUES (_inv.group_id, _uid, 'member', 'active');

    _joined := true;
  END IF;

  IF NOT _inv.is_multi_use THEN
    UPDATE public.invitations
    SET accepted_at = now(), accepted_by = _uid
    WHERE id = _inv.id;
  END IF;

  IF _joined THEN
    SELECT display_name
    INTO _actor_name
    FROM public.profiles
    WHERE id = _uid;

    INSERT INTO public.activity (group_id, kind, actor_id, payload)
    VALUES (
      _inv.group_id,
      'member-joined',
      _uid,
      jsonb_build_object('text', coalesce(_actor_name, 'Någon') || ' gick med i gruppen')
    );
  END IF;

  RETURN jsonb_build_object('group_id', _inv.group_id, 'already', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_group_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _gid uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT group_id
  INTO _gid
  FROM public.invitations
  WHERE id = _invitation_id;

  IF _gid IS NULL THEN
    RAISE EXCEPTION 'Inbjudan finns inte';
  END IF;

  IF NOT public.has_group_role(_gid, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan återkalla inbjudningar';
  END IF;

  UPDATE public.invitations
  SET revoked_at = now()
  WHERE id = _invitation_id
    AND revoked_at IS NULL
    AND (is_multi_use OR accepted_at IS NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_group_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_group_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_group_invitations(_group_id uuid)
RETURNS TABLE(
  id uuid,
  invited_email text,
  role text,
  invited_by uuid,
  invited_by_name text,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    i.id,
    i.invited_email,
    i.role,
    i.invited_by,
    p.display_name,
    i.expires_at,
    i.accepted_at,
    i.revoked_at,
    i.created_at,
    CASE
      WHEN i.revoked_at IS NOT NULL THEN 'revoked'
      WHEN NOT i.is_multi_use AND i.accepted_at IS NOT NULL THEN 'accepted'
      WHEN i.expires_at < now() THEN 'expired'
      ELSE 'active'
    END
  FROM public.invitations i
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.group_id = _group_id
    AND public.has_group_role(_group_id, auth.uid(), ARRAY['owner', 'admin'])
  ORDER BY i.created_at DESC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.list_group_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_invitations(uuid) TO authenticated;

DO $assertions$
DECLARE
  _create_def text;
  _preview_def text;
  _accept_def text;
  _list_def text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.invitations'::regclass
      AND attname = 'is_multi_use'
      AND attnotnull
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'invitations.is_multi_use saknas eller är nullable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.invitations
    WHERE is_multi_use
      AND invited_email IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Fleranvändarinbjudning får inte vara e-postbunden';
  END IF;

  SELECT pg_get_functiondef('public.create_group_invitation(uuid,text,integer)'::regprocedure)
  INTO _create_def;
  SELECT pg_get_functiondef('public.get_invitation_preview(text)'::regprocedure)
  INTO _preview_def;
  SELECT pg_get_functiondef('public.accept_group_invitation(text)'::regprocedure)
  INTO _accept_def;
  SELECT pg_get_functiondef('public.list_group_invitations(uuid)'::regprocedure)
  INTO _list_def;

  IF position('is_multi_use' IN _create_def) = 0
    OR position('is_multi_use' IN _preview_def) = 0
    OR position('is_multi_use' IN _accept_def) = 0
    OR position('is_multi_use' IN _list_def) = 0 THEN
    RAISE EXCEPTION 'Inbjudningsfunktionerna saknar fleranvändarkontraktet';
  END IF;

  IF has_function_privilege('anon', 'public.create_group_invitation(uuid,text,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.accept_group_invitation(text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.revoke_group_invitation(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.list_group_invitations(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anon får inte köra skyddade inbjudningsfunktioner';
  END IF;

  IF NOT has_function_privilege('anon', 'public.get_invitation_preview(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anon måste kunna läsa en säker inbjudningspreview';
  END IF;
END;
$assertions$;
