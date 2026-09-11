BEGIN;

-- Issue #214 — egen bekräftelse från mottagargruppen.
--
-- En medlem som själv ser ett redan delat besök får bekräfta sitt eget
-- deltagande direkt när det fortfarande finns en anonym gästplats kvar.
-- Ingen privat guest_id eller ursprungsgrupp exponeras. Förslag till andra
-- medlemmar fortsätter att kräva den utpekade personens separata bekräftelse.

CREATE OR REPLACE FUNCTION public.list_visit_shared_member_candidates_v1(
  _group_id uuid,
  _visit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
  _guest_count integer;
  _reserved_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RETURN '[]'::jsonb; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN RETURN '[]'::jsonb; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links link
    WHERE link.visit_id = _visit_id
      AND link.group_id = _group_id
      AND link.link_type = 'shared'
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT count(*)::integer INTO _guest_count
  FROM public.visit_guests guest
  WHERE guest.visit_id = _visit_id;

  IF _guest_count = 0 THEN RETURN '[]'::jsonb; END IF;

  SELECT count(*)::integer INTO _reserved_count
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.visit_id = _visit_id
    AND proposal.status IN ('pending', 'deferred', 'accepted');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'memberId', candidate.user_id,
        'memberName', COALESCE(profile.display_name, 'Medlem'),
        'memberAvatar', profile.avatar_emoji,
        'memberAvatarImage', profile.avatar_url,
        'proposalStatus', latest.status
      )
      ORDER BY CASE WHEN candidate.user_id = _uid THEN 0 ELSE 1 END,
               profile.display_name,
               candidate.user_id
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM public.memberships candidate
  JOIN public.profiles profile
    ON profile.id = candidate.user_id
   AND profile.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT proposal.status
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = _visit_id
      AND proposal.target_group_id = _group_id
      AND proposal.target_user_id = candidate.user_id
      AND proposal.status <> 'cancelled'
    ORDER BY proposal.created_at DESC, proposal.id DESC
    LIMIT 1
  ) latest ON true
  WHERE candidate.group_id = _group_id
    AND candidate.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.visit_participants participant
      WHERE participant.visit_id = _visit_id
        AND participant.user_id = candidate.user_id
    )
    AND (latest.status IS NOT NULL OR _reserved_count < _guest_count);

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_visit_shared_member_candidates_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visit_shared_member_candidates_v1(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_shared_visit_self_v1(
  _group_id uuid,
  _visit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _guest_count integer;
  _reserved_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links link
    WHERE link.visit_id = _visit_id
      AND link.group_id = _group_id
      AND link.link_type = 'shared'
  ) THEN
    RAISE EXCEPTION 'Besöket är inte ett delat besök i gruppen';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.visit_participants participant
    WHERE participant.visit_id = _visit_id
      AND participant.user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Du är redan registrerad som deltagare på besöket';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('visit-guest-proposal:' || _visit_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('visit-guest-identity:' || _visit_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = _visit_id
      AND proposal.target_user_id = _uid
      AND proposal.status IN ('pending', 'deferred', 'accepted')
  ) THEN
    RAISE EXCEPTION 'Du har redan en deltagandefråga eller är bekräftad på besöket';
  END IF;

  SELECT count(*)::integer INTO _guest_count
  FROM public.visit_guests guest
  WHERE guest.visit_id = _visit_id;

  SELECT count(*)::integer INTO _reserved_count
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.visit_id = _visit_id
    AND proposal.status IN ('pending', 'deferred', 'accepted');

  IF _guest_count = 0 OR _reserved_count >= _guest_count THEN
    RAISE EXCEPTION 'Det finns ingen ledig deltagarplats kvar på besöket';
  END IF;

  INSERT INTO public.visit_guest_member_proposals (
    visit_id,
    guest_id,
    target_group_id,
    target_user_id,
    proposed_by,
    status,
    proposal_kind,
    responded_at
  ) VALUES (
    _visit_id,
    NULL,
    _group_id,
    _uid,
    _uid,
    'accepted',
    'shared_member',
    now()
  );

  INSERT INTO public.visit_participants (visit_id, user_id)
  VALUES (_visit_id, _uid)
  ON CONFLICT (visit_id, user_id) DO NOTHING;

  UPDATE public.visit_participation_self_corrections
  SET status = 'restored',
      updated_at = now()
  WHERE visit_id = _visit_id
    AND user_id = _uid
    AND status = 'declined';
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_shared_visit_self_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_shared_visit_self_v1(uuid, uuid)
  TO authenticated;

DO $assertions$
BEGIN
  IF to_regprocedure('public.confirm_shared_visit_self_v1(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'egen deltagarbekräftelse saknas';
  END IF;
  IF has_function_privilege(
    'anon',
    'public.confirm_shared_visit_self_v1(uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon får inte bekräfta deltagande';
  END IF;
  IF position('candidate.user_id <> _uid' IN pg_get_functiondef(
    to_regprocedure('public.list_visit_shared_member_candidates_v1(uuid,uuid)')
  )) > 0 THEN
    RAISE EXCEPTION 'mottagarlistan måste kunna erbjuda aktuell användare separat i klienten';
  END IF;
  IF position('link.link_type = ''shared''' IN pg_get_functiondef(
    to_regprocedure('public.confirm_shared_visit_self_v1(uuid,uuid)')
  )) = 0 THEN
    RAISE EXCEPTION 'egen bekräftelse måste kräva delat besök';
  END IF;
  IF position('_reserved_count >= _guest_count' IN pg_get_functiondef(
    to_regprocedure('public.confirm_shared_visit_self_v1(uuid,uuid)')
  )) = 0 THEN
    RAISE EXCEPTION 'egen bekräftelse måste kräva ledig gästkapacitet';
  END IF;
END;
$assertions$;

NOTIFY pgrst, 'reload schema';

COMMIT;
