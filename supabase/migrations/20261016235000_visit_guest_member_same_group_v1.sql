BEGIN;

-- Issue #497. Tillåt identitetskoppling till en aktiv medlem i samma originalgrupp.
-- Behåll originalgruppens privata initiativ, målmedlemskap och uttryckligt eget svar.

CREATE OR REPLACE FUNCTION public.list_visit_guest_member_targets_v1(
  _source_group_id uuid,
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
  IF NOT public.group_is_active(_source_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_source_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links source_link
    WHERE source_link.visit_id = _visit_id
      AND source_link.group_id = _source_group_id
      AND source_link.link_type = 'original'
  ) THEN
    RAISE EXCEPTION 'Gästidentiteter kan bara kopplas från besökets originalgrupp';
  END IF;

  SELECT count(*)::integer
  INTO _guest_count
  FROM public.visit_guests guest
  WHERE guest.visit_id = _visit_id;

  SELECT count(*)::integer
  INTO _reserved_count
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.visit_id = _visit_id
    AND proposal.status IN ('pending', 'deferred', 'accepted');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'guestId', guest.id,
        'guestName', guest.display_name,
        'groupId', target_group.id,
        'groupName', target_group.name,
        'groupEmoji', target_group.emoji,
        'memberId', candidate.user_id,
        'memberName', COALESCE(profile.display_name, 'Medlem'),
        'memberAvatar', profile.avatar_emoji,
        'memberAvatarImage', profile.avatar_url,
        'proposalStatus', latest.status
      )
      ORDER BY guest.sort_order, target_group.name, profile.display_name, candidate.user_id
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM public.visit_guests guest
  JOIN public.visit_group_links target_link
    ON target_link.visit_id = guest.visit_id
  JOIN public.groups target_group
    ON target_group.id = target_link.group_id
   AND target_group.lifecycle_status = 'active'
  JOIN public.memberships actor_membership
    ON actor_membership.group_id = target_group.id
   AND actor_membership.user_id = _uid
   AND actor_membership.status = 'active'
  JOIN public.memberships candidate
    ON candidate.group_id = target_group.id
   AND candidate.status = 'active'
  JOIN public.profiles profile
    ON profile.id = candidate.user_id
   AND profile.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT proposal.status
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = guest.id
      AND proposal.target_group_id = target_group.id
      AND proposal.target_user_id = candidate.user_id
      AND proposal.status <> 'cancelled'
    ORDER BY proposal.created_at DESC, proposal.id DESC
    LIMIT 1
  ) latest ON true
  WHERE guest.visit_id = _visit_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.visit_participants participant
      WHERE participant.visit_id = _visit_id
        AND participant.user_id = candidate.user_id
    )
    AND (
      latest.status IS NOT NULL
      OR _reserved_count < _guest_count
    );

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.propose_visit_guest_member_v1(
  _source_group_id uuid,
  _visit_id uuid,
  _guest_id uuid,
  _target_group_id uuid,
  _target_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _proposal_id uuid;
  _guest_count integer;
  _reserved_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_source_group_id) OR NOT public.group_is_active(_target_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_source_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i originalgruppen';
  END IF;
  IF NOT public.has_membership(_target_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i målgruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links source_link
    WHERE source_link.visit_id = _visit_id
      AND source_link.group_id = _source_group_id
      AND source_link.link_type = 'original'
  ) THEN
    RAISE EXCEPTION 'Gästidentiteter kan bara kopplas från besökets originalgrupp';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_guests guest
    WHERE guest.id = _guest_id
      AND guest.visit_id = _visit_id
  ) THEN
    RAISE EXCEPTION 'Gästen finns inte på besöket';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links target_link
    WHERE target_link.visit_id = _visit_id
      AND target_link.group_id = _target_group_id
  ) THEN
    RAISE EXCEPTION 'Besöket måste först läggas till i målgruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE membership.group_id = _target_group_id
      AND membership.user_id = _target_user_id
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Personen är inte aktiv medlem i målgruppen';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('visit-guest-proposal:' || _visit_id::text, 0));

  UPDATE public.visit_guest_member_proposals proposal
  SET status = 'cancelled', updated_at = now(), responded_at = now()
  WHERE proposal.status IN ('pending', 'deferred')
    AND (proposal.guest_id = _guest_id
      OR (proposal.visit_id = _visit_id AND proposal.target_user_id = _target_user_id))
    AND (
      NOT public.group_is_active(proposal.target_group_id)
      OR NOT EXISTS (
        SELECT 1 FROM public.visit_group_links link
        WHERE link.visit_id = proposal.visit_id
          AND link.group_id = proposal.target_group_id
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.memberships membership
        WHERE membership.group_id = proposal.target_group_id
          AND membership.user_id = proposal.target_user_id
          AND membership.status = 'active'
      )
    );

  SELECT proposal.id
  INTO _proposal_id
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.guest_id = _guest_id
    AND proposal.target_group_id = _target_group_id
    AND proposal.target_user_id = _target_user_id
    AND proposal.status IN ('pending', 'deferred')
  ORDER BY proposal.created_at DESC
  LIMIT 1;

  IF _proposal_id IS NOT NULL THEN RETURN _proposal_id; END IF;

  IF EXISTS (
    SELECT 1 FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = _guest_id
      AND proposal.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Gästen är redan kopplad till en bekräftad deltagare';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visit_participants participant
    WHERE participant.visit_id = _visit_id
      AND participant.user_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Personen är redan identifierad deltagare på besöket';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = _visit_id
      AND proposal.target_user_id = _target_user_id
      AND proposal.status = 'declined'
  ) THEN
    RAISE EXCEPTION 'Personen har redan svarat att hen inte var med';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = _guest_id
      AND proposal.status IN ('pending', 'deferred')
  ) THEN
    RAISE EXCEPTION 'Gästen har redan ett väntande deltagandeförslag';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = _visit_id
      AND proposal.target_user_id = _target_user_id
      AND proposal.status IN ('pending', 'deferred')
  ) THEN
    RAISE EXCEPTION 'Personen har redan ett väntande deltagandeförslag för besöket';
  END IF;

  SELECT count(*)::integer INTO _guest_count
  FROM public.visit_guests guest
  WHERE guest.visit_id = _visit_id;

  SELECT count(*)::integer INTO _reserved_count
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.visit_id = _visit_id
    AND proposal.status IN ('pending', 'deferred', 'accepted');

  IF _reserved_count >= _guest_count THEN
    RAISE EXCEPTION 'Alla gäster på besöket har redan ett väntande eller bekräftat deltagandeförslag';
  END IF;

  INSERT INTO public.visit_guest_member_proposals (
    visit_id, guest_id, target_group_id, target_user_id, proposed_by, status, proposal_kind
  ) VALUES (
    _visit_id, _guest_id, _target_group_id, _target_user_id, _uid, 'pending', 'guest_link'
  )
  RETURNING id INTO _proposal_id;

  RETURN _proposal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_visit_guest_member_targets_v1(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visit_guest_member_targets_v1(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.propose_visit_guest_member_v1(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_visit_guest_member_v1(uuid, uuid, uuid, uuid, uuid) TO authenticated;

COMMIT;
