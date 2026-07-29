BEGIN;

-- Självbetjänad kontoradering för v1. Historiska sifferbetyg och
-- besöksdeltagande behålls på en anonymiserad profilrad. Auth-användaren
-- mjukraderas separat av den autentiserade serverfunktionen.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'scrubbed'
    CHECK (status IN ('scrubbed', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

REVOKE ALL ON public.account_deletion_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletion_jobs TO service_role;
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_account_deletion_requirements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _groups jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'groupId', g.id,
        'name', g.name,
        'emoji', COALESCE(g.emoji, '🍽️'),
        'lifecycleStatus', g.lifecycle_status,
        'otherMemberCount', (
          SELECT count(*)::int
          FROM public.memberships other_member
          WHERE other_member.group_id = g.id
            AND other_member.user_id <> _uid
            AND other_member.status = 'active'
        ),
        'requiresSuccessor', EXISTS (
          SELECT 1
          FROM public.memberships other_member
          WHERE other_member.group_id = g.id
            AND other_member.user_id <> _uid
            AND other_member.status = 'active'
        ),
        'willBeDeleted', NOT EXISTS (
          SELECT 1
          FROM public.memberships other_member
          WHERE other_member.group_id = g.id
            AND other_member.user_id <> _uid
            AND other_member.status = 'active'
        ),
        'candidates', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', candidate.user_id,
            'name', COALESCE(NULLIF(trim(profile.display_name), ''), 'Medlem'),
            'avatar', profile.avatar_emoji
          ) ORDER BY COALESCE(NULLIF(trim(profile.display_name), ''), 'Medlem')), '[]'::jsonb)
          FROM public.memberships candidate
          LEFT JOIN public.profiles profile ON profile.id = candidate.user_id
          WHERE candidate.group_id = g.id
            AND candidate.user_id <> _uid
            AND candidate.status = 'active'
        )
      )
      ORDER BY g.name
    ),
    '[]'::jsonb
  )
  INTO _groups
  FROM public.memberships ownership
  JOIN public.groups g ON g.id = ownership.group_id
  WHERE ownership.user_id = _uid
    AND ownership.role = 'owner'
    AND ownership.status = 'active';

  RETURN jsonb_build_object(
    'groups', _groups,
    'transferGroupCount', (
      SELECT count(*)::int
      FROM public.memberships ownership
      WHERE ownership.user_id = _uid
        AND ownership.role = 'owner'
        AND ownership.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.memberships other_member
          WHERE other_member.group_id = ownership.group_id
            AND other_member.user_id <> _uid
            AND other_member.status = 'active'
        )
    ),
    'soloGroupCount', (
      SELECT count(*)::int
      FROM public.memberships ownership
      WHERE ownership.user_id = _uid
        AND ownership.role = 'owner'
        AND ownership.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.memberships other_member
          WHERE other_member.group_id = ownership.group_id
            AND other_member.user_id <> _uid
            AND other_member.status = 'active'
        )
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_account_deletion_requirements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_account_deletion_requirements() TO authenticated;

CREATE OR REPLACE FUNCTION public.prepare_own_account_deletion(
  _successors jsonb DEFAULT '{}'::jsonb,
  _confirm_solo_group_deletion boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _owned record;
  _successor uuid;
  _storage_paths text[] := '{}';
  _solo_group_ids uuid[] := '{}';
  _solo_original_visit_ids uuid[] := '{}';
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Ett avbrutet serveranrop kan säkert återupptas innan auth-raden tas bort.
  IF EXISTS (
    SELECT 1 FROM public.account_deletion_jobs WHERE user_id = _uid
  ) THEN
    SELECT storage_paths INTO _storage_paths
    FROM public.account_deletion_jobs
    WHERE user_id = _uid;
    RETURN jsonb_build_object('storagePaths', to_jsonb(COALESCE(_storage_paths, '{}')));
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profilen finns inte'; END IF;

  -- Lås samtliga ägarskap innan validering och mutation.
  PERFORM 1
  FROM public.memberships
  WHERE user_id = _uid AND role = 'owner' AND status = 'active'
  FOR UPDATE;

  FOR _owned IN
    SELECT m.group_id, g.name,
      EXISTS (
        SELECT 1 FROM public.memberships other_member
        WHERE other_member.group_id = m.group_id
          AND other_member.user_id <> _uid
          AND other_member.status = 'active'
      ) AS has_other_members
    FROM public.memberships m
    JOIN public.groups g ON g.id = m.group_id
    WHERE m.user_id = _uid
      AND m.role = 'owner'
      AND m.status = 'active'
    ORDER BY m.group_id
  LOOP
    IF _owned.has_other_members THEN
      BEGIN
        _successor := NULLIF(_successors ->> _owned.group_id::text, '')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Ogiltig ny ägare för gruppen %', _owned.name;
      END;

      IF _successor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.memberships successor
        WHERE successor.group_id = _owned.group_id
          AND successor.user_id = _successor
          AND successor.user_id <> _uid
          AND successor.status = 'active'
      ) THEN
        RAISE EXCEPTION 'Välj en ny ägare för gruppen %', _owned.name;
      END IF;
    ELSE
      IF NOT _confirm_solo_group_deletion THEN
        RAISE EXCEPTION 'Bekräfta att grupper där du är ensam medlem får raderas';
      END IF;
      _solo_group_ids := array_append(_solo_group_ids, _owned.group_id);
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(DISTINCT vm.storage_path), '{}')
  INTO _storage_paths
  FROM public.visit_media vm
  WHERE vm.uploaded_by = _uid
     OR vm.group_id = ANY(_solo_group_ids);

  SELECT COALESCE(array_agg(DISTINCT vgl.visit_id), '{}')
  INTO _solo_original_visit_ids
  FROM public.visit_group_links vgl
  WHERE vgl.group_id = ANY(_solo_group_ids)
    AND vgl.link_type = 'original';

  -- Ägartriggern skyddar normala klientmutationer. Den här funktionen har
  -- redan låst och validerat samtliga berörda medlemskap.
  PERFORM set_config('matrundan.allow_owner_change', 'on', true);

  FOR _owned IN
    SELECT m.group_id
    FROM public.memberships m
    WHERE m.user_id = _uid
      AND m.role = 'owner'
      AND m.status = 'active'
      AND NOT (m.group_id = ANY(_solo_group_ids))
    ORDER BY m.group_id
  LOOP
    _successor := (_successors ->> _owned.group_id::text)::uuid;
    UPDATE public.memberships
    SET role = 'member'
    WHERE group_id = _owned.group_id AND user_id = _uid;
    UPDATE public.memberships
    SET role = 'owner'
    WHERE group_id = _owned.group_id AND user_id = _successor;
  END LOOP;

  -- Ett originalbesök som ägs av en borttagen ensamgrupp försvinner även ur
  -- grupper som det tidigare delats till. UI:t varnar uttryckligen för detta.
  DELETE FROM public.visits
  WHERE id = ANY(_solo_original_visit_ids);

  DELETE FROM public.groups
  WHERE id = ANY(_solo_group_ids);

  DELETE FROM public.visit_media WHERE uploaded_by = _uid;
  DELETE FROM public.favorites WHERE user_id = _uid;
  DELETE FROM public.next_stop_date_responses WHERE member_id = _uid;

  UPDATE public.invitations
  SET revoked_at = now()
  WHERE invited_by = _uid
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  UPDATE public.reviews
  SET comment = NULL
  WHERE user_id = _uid;

  UPDATE public.review_group_visibility
  SET comment_visible = false
  WHERE review_id IN (
    SELECT id FROM public.reviews WHERE user_id = _uid
  );

  UPDATE public.activity
  SET actor_id = NULL,
      payload = jsonb_set(
        COALESCE(payload, '{}'::jsonb),
        '{text}',
        to_jsonb('Tidigare medlem bidrog till gruppens historik'::text),
        true
      )
  WHERE actor_id = _uid;

  UPDATE public.memberships
  SET status = 'left',
      role = 'member',
      left_at = COALESCE(left_at, now())
  WHERE user_id = _uid
    AND status = 'active';

  UPDATE public.profiles
  SET display_name = 'Tidigare medlem',
      avatar_url = NULL,
      avatar_emoji = NULL,
      deleted_at = now()
  WHERE id = _uid;

  INSERT INTO public.account_deletion_jobs (user_id, storage_paths, status)
  VALUES (_uid, COALESCE(_storage_paths, '{}'), 'scrubbed');

  PERFORM set_config('matrundan.allow_owner_change', 'off', true);

  RETURN jsonb_build_object('storagePaths', to_jsonb(COALESCE(_storage_paths, '{}')));
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_own_account_deletion(jsonb, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_own_account_deletion(jsonb, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_account_deletion(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  UPDATE public.account_deletion_jobs
  SET status = 'completed',
      completed_at = COALESCE(completed_at, now())
  WHERE user_id = _user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_account_deletion(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_account_deletion(uuid)
  TO service_role;

COMMIT;
