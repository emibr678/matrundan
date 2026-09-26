BEGIN;

-- Issue #350: riktade interna gruppinbjudningar och inbjudan som medlemsrättighet.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invited_user_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz NULL;

ALTER TABLE public.invitations
  ALTER COLUMN token_hash DROP NOT NULL;

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_target_shape_check,
  DROP CONSTRAINT IF EXISTS invitations_terminal_state_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_target_shape_check
  CHECK (
    (
      invited_user_id IS NULL
      AND token_hash IS NOT NULL
    )
    OR
    (
      invited_user_id IS NOT NULL
      AND token_hash IS NULL
      AND invited_email IS NULL
      AND NOT is_multi_use
    )
  ) NOT VALID,
  ADD CONSTRAINT invitations_terminal_state_check
  CHECK (
    NOT (accepted_at IS NOT NULL AND declined_at IS NOT NULL)
    AND NOT (declined_at IS NOT NULL AND revoked_at IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.invitations
  VALIDATE CONSTRAINT invitations_target_shape_check;
ALTER TABLE public.invitations
  VALIDATE CONSTRAINT invitations_terminal_state_check;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_one_pending_user_per_group
  ON public.invitations (group_id, invited_user_id)
  WHERE invited_user_id IS NOT NULL
    AND accepted_at IS NULL
    AND declined_at IS NULL
    AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_one_pending_email_per_group
  ON public.invitations (group_id, lower(invited_email))
  WHERE invited_email IS NOT NULL
    AND accepted_at IS NULL
    AND declined_at IS NULL
    AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.revoke_invitations_when_membership_ends()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'active' AND NEW.status <> 'active' THEN
    UPDATE public.invitations
    SET revoked_at = now()
    WHERE group_id = OLD.group_id
      AND invited_by = OLD.user_id
      AND accepted_at IS NULL
      AND declined_at IS NULL
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_invitations_when_membership_ends()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_revoke_invitations_when_membership_ends
  ON public.memberships;
CREATE TRIGGER trg_revoke_invitations_when_membership_ends
AFTER UPDATE OF status ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.revoke_invitations_when_membership_ends();

CREATE OR REPLACE FUNCTION public.revoke_pending_invites_for_deleted_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.invitations
    SET revoked_at = now()
    WHERE invited_user_id = NEW.id
      AND accepted_at IS NULL
      AND declined_at IS NULL
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_pending_invites_for_deleted_profile()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_revoke_pending_invites_for_deleted_profile
  ON public.profiles;
CREATE TRIGGER trg_revoke_pending_invites_for_deleted_profile
AFTER UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.revoke_pending_invites_for_deleted_profile();

CREATE OR REPLACE FUNCTION public.create_group_invitation(
  _group_id uuid,
  _invited_email text DEFAULT NULL,
  _expires_in_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
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

  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE membership.group_id = _group_id
      AND membership.user_id = _uid
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Du måste vara aktiv medlem i gruppen för att bjuda in';
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
      AND declined_at IS NULL
      AND revoked_at IS NULL
      AND (
        expires_at < now()
        OR invited_by = _uid
      );

    IF EXISTS (
      SELECT 1
      FROM public.invitations invitation
      WHERE invitation.group_id = _group_id
        AND lower(invitation.invited_email) = _email
        AND invitation.accepted_at IS NULL
        AND invitation.declined_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expires_at >= now()
    ) THEN
      RAISE EXCEPTION 'Det finns redan en aktiv inbjudan till den e-postadressen';
    END IF;
  END IF;

  _raw := encode(extensions.gen_random_bytes(32), 'hex');
  _hash := public._token_hash(_raw);
  _exp := now() + make_interval(days => _expires_in_days);

  INSERT INTO public.invitations (
    group_id,
    token_hash,
    invited_email,
    invited_user_id,
    role,
    invited_by,
    expires_at,
    is_multi_use
  )
  VALUES (
    _group_id,
    _hash,
    _email,
    NULL,
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

REVOKE ALL ON FUNCTION public.create_group_invitation(uuid, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(uuid, text, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.list_group_invite_candidates(_target_group_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_emoji text,
  avatar_url text,
  shared_group_names text[],
  invitation_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.group_is_active(_target_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE membership.group_id = _target_group_id
      AND membership.user_id = _uid
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Du måste vara aktiv medlem i gruppen';
  END IF;

  RETURN QUERY
  WITH shared_people AS (
    SELECT
      other_membership.user_id,
      array_agg(DISTINCT source_group.name ORDER BY source_group.name) AS shared_names
    FROM public.memberships own_membership
    JOIN public.memberships other_membership
      ON other_membership.group_id = own_membership.group_id
     AND other_membership.status = 'active'
    JOIN public.groups source_group
      ON source_group.id = own_membership.group_id
     AND source_group.lifecycle_status = 'active'
    WHERE own_membership.user_id = _uid
      AND own_membership.status = 'active'
      AND other_membership.user_id <> _uid
    GROUP BY other_membership.user_id
  )
  SELECT
    profile.id,
    COALESCE(NULLIF(trim(profile.display_name), ''), 'Medlem') AS display_name,
    profile.avatar_emoji,
    profile.avatar_url,
    shared_people.shared_names,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.invitations invitation
        WHERE invitation.group_id = _target_group_id
          AND invitation.invited_user_id = profile.id
          AND invitation.accepted_at IS NULL
          AND invitation.declined_at IS NULL
          AND invitation.revoked_at IS NULL
          AND invitation.expires_at >= now()
      ) THEN 'pending'
      ELSE NULL
    END AS invitation_state
  FROM shared_people
  JOIN public.profiles profile
    ON profile.id = shared_people.user_id
   AND profile.deleted_at IS NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.memberships target_membership
    WHERE target_membership.group_id = _target_group_id
      AND target_membership.user_id = profile.id
      AND target_membership.status = 'active'
  )
  ORDER BY lower(COALESCE(NULLIF(trim(profile.display_name), ''), 'Medlem'));
END;
$function$;

REVOKE ALL ON FUNCTION public.list_group_invite_candidates(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_invite_candidates(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_group_member_invitations(
  _target_group_id uuid,
  _invitee_user_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _invitee uuid;
  _deduped uuid[];
  _created integer := 0;
  _already_pending integer := 0;
  _already_member integer := 0;
  _row_count integer := 0;
  _expires_at timestamptz := now() + interval '7 days';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.group_is_active(_target_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE membership.group_id = _target_group_id
      AND membership.user_id = _uid
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Du måste vara aktiv medlem i gruppen för att bjuda in';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT invitee_id), '{}'::uuid[])
  INTO _deduped
  FROM unnest(COALESCE(_invitee_user_ids, '{}'::uuid[])) invitee_id
  WHERE invitee_id IS NOT NULL
    AND invitee_id <> _uid;

  IF cardinality(_deduped) > 25 THEN
    RAISE EXCEPTION 'Du kan bjuda in högst 25 personer åt gången';
  END IF;

  FOREACH _invitee IN ARRAY _deduped
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.memberships own_membership
      JOIN public.memberships other_membership
        ON other_membership.group_id = own_membership.group_id
       AND other_membership.user_id = _invitee
       AND other_membership.status = 'active'
      JOIN public.groups source_group
        ON source_group.id = own_membership.group_id
       AND source_group.lifecycle_status = 'active'
      JOIN public.profiles invitee_profile
        ON invitee_profile.id = other_membership.user_id
       AND invitee_profile.deleted_at IS NULL
      WHERE own_membership.user_id = _uid
        AND own_membership.status = 'active'
    ) THEN
      RAISE EXCEPTION 'En vald person kan inte bjudas in från dina grupper';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.memberships target_membership
      WHERE target_membership.group_id = _target_group_id
        AND target_membership.user_id = _invitee
        AND target_membership.status = 'active'
    ) THEN
      _already_member := _already_member + 1;
      CONTINUE;
    END IF;

    UPDATE public.invitations
    SET revoked_at = now()
    WHERE group_id = _target_group_id
      AND invited_user_id = _invitee
      AND accepted_at IS NULL
      AND declined_at IS NULL
      AND revoked_at IS NULL
      AND expires_at < now();

    IF EXISTS (
      SELECT 1
      FROM public.invitations invitation
      WHERE invitation.group_id = _target_group_id
        AND invitation.invited_user_id = _invitee
        AND invitation.accepted_at IS NULL
        AND invitation.declined_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expires_at >= now()
    ) THEN
      _already_pending := _already_pending + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.invitations (
      group_id,
      token_hash,
      invited_email,
      invited_user_id,
      role,
      invited_by,
      expires_at,
      is_multi_use
    )
    VALUES (
      _target_group_id,
      NULL,
      NULL,
      _invitee,
      'member',
      _uid,
      _expires_at,
      false
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS _row_count = ROW_COUNT;
    IF _row_count = 1 THEN
      _created := _created + 1;
    ELSE
      _already_pending := _already_pending + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', _created,
    'already_pending_count', _already_pending,
    'already_member_count', _already_member
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_group_member_invitations(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_member_invitations(uuid, uuid[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_group_invitations()
RETURNS TABLE(
  id uuid,
  group_id uuid,
  group_name text,
  group_emoji text,
  invited_by_name text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    invitation.id,
    invitation.group_id,
    target_group.name,
    target_group.emoji,
    COALESCE(NULLIF(trim(inviter.display_name), ''), 'En medlem'),
    invitation.expires_at
  FROM public.invitations invitation
  JOIN public.groups target_group
    ON target_group.id = invitation.group_id
   AND target_group.lifecycle_status = 'active'
  LEFT JOIN public.profiles inviter
    ON inviter.id = invitation.invited_by
  WHERE auth.uid() IS NOT NULL
    AND invitation.invited_user_id = auth.uid()
    AND invitation.accepted_at IS NULL
    AND invitation.declined_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at >= now()
  ORDER BY invitation.created_at ASC;
$function$;

REVOKE ALL ON FUNCTION public.list_my_group_invitations()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_group_invitations()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_group_member_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _invitation record;
  _existing record;
  _actor_name text;
  _joined boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO _invitation
  FROM public.invitations
  WHERE id = _invitation_id
  FOR UPDATE;

  IF NOT FOUND OR _invitation.invited_user_id IS NULL THEN
    RAISE EXCEPTION 'Inbjudan finns inte';
  END IF;

  IF _invitation.invited_user_id <> _uid THEN
    RAISE EXCEPTION 'Inbjudan tillhör en annan användare';
  END IF;

  IF _invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Inbjudan är återkallad';
  END IF;
  IF _invitation.declined_at IS NOT NULL THEN
    RAISE EXCEPTION 'Inbjudan är avböjd';
  END IF;
  IF _invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('group_id', _invitation.group_id, 'already', true);
  END IF;
  IF _invitation.expires_at < now() THEN
    RAISE EXCEPTION 'Inbjudan har gått ut';
  END IF;
  IF NOT public.group_is_active(_invitation.group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad';
  END IF;

  SELECT *
  INTO _existing
  FROM public.memberships
  WHERE group_id = _invitation.group_id
    AND user_id = _uid;

  IF FOUND THEN
    IF _existing.status = 'active' THEN
      UPDATE public.invitations
      SET accepted_at = now(), accepted_by = _uid
      WHERE id = _invitation.id;

      RETURN jsonb_build_object('group_id', _invitation.group_id, 'already', true);
    END IF;

    UPDATE public.memberships
    SET
      status = 'active',
      left_at = NULL,
      rejoined_at = now(),
      role = CASE WHEN role = 'owner' THEN role ELSE 'member' END
    WHERE group_id = _invitation.group_id
      AND user_id = _uid;

    _joined := true;
  ELSE
    INSERT INTO public.memberships (group_id, user_id, role, status)
    VALUES (_invitation.group_id, _uid, 'member', 'active');

    _joined := true;
  END IF;

  UPDATE public.invitations
  SET accepted_at = now(), accepted_by = _uid
  WHERE id = _invitation.id;

  IF _joined THEN
    SELECT display_name
    INTO _actor_name
    FROM public.profiles
    WHERE id = _uid;

    INSERT INTO public.activity (group_id, kind, actor_id, payload)
    VALUES (
      _invitation.group_id,
      'member-joined',
      _uid,
      jsonb_build_object('text', coalesce(_actor_name, 'Någon') || ' gick med i gruppen')
    );
  END IF;

  RETURN jsonb_build_object('group_id', _invitation.group_id, 'already', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_group_member_invitation(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_group_member_invitation(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_group_member_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _invitation record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO _invitation
  FROM public.invitations
  WHERE id = _invitation_id
  FOR UPDATE;

  IF NOT FOUND OR _invitation.invited_user_id IS NULL THEN
    RAISE EXCEPTION 'Inbjudan finns inte';
  END IF;
  IF _invitation.invited_user_id <> _uid THEN
    RAISE EXCEPTION 'Inbjudan tillhör en annan användare';
  END IF;
  IF _invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Inbjudan är redan accepterad';
  END IF;
  IF _invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Inbjudan är återkallad';
  END IF;
  IF _invitation.declined_at IS NOT NULL THEN
    RETURN;
  END IF;
  IF _invitation.expires_at < now() THEN
    RAISE EXCEPTION 'Inbjudan har gått ut';
  END IF;

  UPDATE public.invitations
  SET declined_at = now()
  WHERE id = _invitation.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.decline_group_member_invitation(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_group_member_invitation(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_group_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _invitation record;
  _role text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO _invitation
  FROM public.invitations
  WHERE id = _invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inbjudan finns inte';
  END IF;

  SELECT role
  INTO _role
  FROM public.memberships
  WHERE group_id = _invitation.group_id
    AND user_id = _uid
    AND status = 'active';

  IF _role IS NULL THEN
    RAISE EXCEPTION 'Du måste vara aktiv medlem i gruppen';
  END IF;

  IF _invitation.invited_by <> _uid AND _role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Du kan bara återkalla dina egna inbjudningar';
  END IF;

  UPDATE public.invitations
  SET revoked_at = now()
  WHERE id = _invitation.id
    AND accepted_at IS NULL
    AND declined_at IS NULL
    AND revoked_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_group_invitation(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_group_invitation(uuid)
  TO authenticated;

DROP FUNCTION IF EXISTS public.list_group_invitations(uuid);

CREATE FUNCTION public.list_group_invitations(_group_id uuid)
RETURNS TABLE(
  id uuid,
  invite_kind text,
  invited_email text,
  invited_user_id uuid,
  invited_user_name text,
  role text,
  invited_by uuid,
  invited_by_name text,
  expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    invitation.id,
    CASE
      WHEN invitation.invited_user_id IS NOT NULL THEN 'internal'
      WHEN invitation.invited_email IS NOT NULL THEN 'email'
      ELSE 'link'
    END,
    invitation.invited_email,
    invitation.invited_user_id,
    invitee.display_name,
    invitation.role,
    invitation.invited_by,
    inviter.display_name,
    invitation.expires_at,
    invitation.accepted_at,
    invitation.declined_at,
    invitation.revoked_at,
    invitation.created_at,
    CASE
      WHEN invitation.declined_at IS NOT NULL THEN 'declined'
      WHEN invitation.revoked_at IS NOT NULL THEN 'revoked'
      WHEN NOT invitation.is_multi_use AND invitation.accepted_at IS NOT NULL THEN 'accepted'
      WHEN invitation.expires_at < now() THEN 'expired'
      ELSE 'active'
    END
  FROM public.invitations invitation
  LEFT JOIN public.profiles inviter
    ON inviter.id = invitation.invited_by
  LEFT JOIN public.profiles invitee
    ON invitee.id = invitation.invited_user_id
  WHERE invitation.group_id = _group_id
    AND public.has_group_role(_group_id, auth.uid(), ARRAY['owner', 'admin'])
  ORDER BY invitation.created_at DESC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.list_group_invitations(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_invitations(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.list_own_group_invitations(_group_id uuid)
RETURNS TABLE(
  id uuid,
  invite_kind text,
  invited_email text,
  invited_user_id uuid,
  invited_user_name text,
  expires_at timestamptz,
  created_at timestamptz,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    invitation.id,
    CASE
      WHEN invitation.invited_user_id IS NOT NULL THEN 'internal'
      WHEN invitation.invited_email IS NOT NULL THEN 'email'
      ELSE 'link'
    END,
    invitation.invited_email,
    invitation.invited_user_id,
    invitee.display_name,
    invitation.expires_at,
    invitation.created_at,
    CASE
      WHEN invitation.declined_at IS NOT NULL THEN 'declined'
      WHEN invitation.revoked_at IS NOT NULL THEN 'revoked'
      WHEN NOT invitation.is_multi_use AND invitation.accepted_at IS NOT NULL THEN 'accepted'
      WHEN invitation.expires_at < now() THEN 'expired'
      ELSE 'active'
    END
  FROM public.invitations invitation
  LEFT JOIN public.profiles invitee
    ON invitee.id = invitation.invited_user_id
  WHERE invitation.group_id = _group_id
    AND invitation.invited_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.memberships membership
      WHERE membership.group_id = _group_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
    )
  ORDER BY invitation.created_at DESC
  LIMIT 50;
$function$;

REVOKE ALL ON FUNCTION public.list_own_group_invitations(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_own_group_invitations(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_group(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Endast gruppens ägare kan arkivera gruppen';
  END IF;

  SELECT lifecycle_status INTO _status
  FROM public.groups WHERE id = _group_id FOR UPDATE;

  IF _status IS NULL THEN RAISE EXCEPTION 'Gruppen finns inte'; END IF;
  IF _status = 'archived' THEN RETURN; END IF;

  UPDATE public.invitations
  SET revoked_at = now()
  WHERE group_id = _group_id
    AND accepted_at IS NULL
    AND declined_at IS NULL
    AND revoked_at IS NULL;

  DELETE FROM public.group_next_place WHERE group_id = _group_id;

  UPDATE public.groups
  SET lifecycle_status = 'archived',
      archived_at = now(),
      archived_by = _uid,
      updated_at = now()
  WHERE id = _group_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_group(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_group(uuid)
  TO authenticated;

DO $assertions$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.invitations
    WHERE invited_user_id IS NOT NULL
      AND (
        token_hash IS NOT NULL
        OR invited_email IS NOT NULL
        OR is_multi_use
      )
  ) THEN
    RAISE EXCEPTION 'Interna inbjudningar bryter målkontraktet';
  END IF;

  IF has_function_privilege('anon', 'public.list_group_invite_candidates(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.create_group_member_invitations(uuid,uuid[])', 'EXECUTE')
    OR has_function_privilege('anon', 'public.list_my_group_invitations()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.accept_group_member_invitation(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.decline_group_member_invitation(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anon får inte använda interna gruppinbjudningar';
  END IF;
END;
$assertions$;

COMMIT;
