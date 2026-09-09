BEGIN;

-- Issue #214 follow-up after staging feedback.
--
-- 1. Den historiska visit_participants-vakten får inte längre kräva medlemskap
--    i originalgruppen. Ett kanoniskt deltagande är legitimt när användaren är
--    aktiv medlem i minst en grupp där samma visit redan är länkad.
-- 2. En mottagargrupp får föreslå en egen medlem som deltagare utan att få se
--    eller välja privat guest_id/source group. Originalgruppen behåller den
--    precisa guest -> member-kopplingen.
-- 3. Högst lika många öppna/bekräftade identitetsförslag som faktiska fria
--    gäster får finnas samtidigt på samma visit.

CREATE OR REPLACE FUNCTION public.validate_visit_participant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links link
    JOIN public.memberships membership
      ON membership.group_id = link.group_id
     AND membership.user_id = NEW.user_id
     AND membership.status = 'active'
    WHERE link.visit_id = NEW.visit_id
  ) THEN
    RAISE EXCEPTION 'Deltagaren är inte aktiv medlem i någon grupp där besöket finns';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.visit_guest_member_proposals
  ALTER COLUMN guest_id DROP NOT NULL;

ALTER TABLE public.visit_guest_member_proposals
  ADD COLUMN proposal_kind text NOT NULL DEFAULT 'guest_link'
    CHECK (proposal_kind IN ('guest_link', 'shared_member'));

ALTER TABLE public.visit_guest_member_proposals
  ADD CONSTRAINT visit_guest_member_proposals_kind_guest_check
  CHECK (
    (proposal_kind = 'guest_link' AND guest_id IS NOT NULL)
    OR (proposal_kind = 'shared_member' AND guest_id IS NULL)
  );

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
   AND target_link.group_id <> _source_group_id
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
  IF _source_group_id = _target_group_id THEN
    RAISE EXCEPTION 'Välj en annan grupp som målgrupp';
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
      ORDER BY profile.display_name, candidate.user_id
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
    AND candidate.user_id <> _uid
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

CREATE OR REPLACE FUNCTION public.propose_shared_visit_member_v1(
  _group_id uuid,
  _visit_id uuid,
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
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _target_user_id = _uid THEN
    RAISE EXCEPTION 'En annan gruppmedlem behöver föreslå ditt deltagande';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_group_links link
    WHERE link.visit_id = _visit_id
      AND link.group_id = _group_id
      AND link.link_type = 'shared'
  ) THEN
    RAISE EXCEPTION 'Besöket är inte ett delat besök i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships membership
    WHERE membership.group_id = _group_id
      AND membership.user_id = _target_user_id
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Personen är inte aktiv medlem i gruppen';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('visit-guest-proposal:' || _visit_id::text, 0));

  UPDATE public.visit_guest_member_proposals proposal
  SET status = 'cancelled', updated_at = now(), responded_at = now()
  WHERE proposal.status IN ('pending', 'deferred')
    AND proposal.visit_id = _visit_id
    AND proposal.target_user_id = _target_user_id
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
  WHERE proposal.visit_id = _visit_id
    AND proposal.target_group_id = _group_id
    AND proposal.target_user_id = _target_user_id
    AND proposal.status IN ('pending', 'deferred')
  ORDER BY proposal.created_at DESC
  LIMIT 1;

  IF _proposal_id IS NOT NULL THEN RETURN _proposal_id; END IF;

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
    WHERE proposal.visit_id = _visit_id
      AND proposal.target_user_id = _target_user_id
      AND proposal.status IN ('pending', 'deferred', 'accepted')
  ) THEN
    RAISE EXCEPTION 'Personen har redan ett deltagandeförslag för besöket';
  END IF;

  SELECT count(*)::integer INTO _guest_count
  FROM public.visit_guests guest
  WHERE guest.visit_id = _visit_id;

  SELECT count(*)::integer INTO _reserved_count
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.visit_id = _visit_id
    AND proposal.status IN ('pending', 'deferred', 'accepted');

  IF _guest_count = 0 OR _reserved_count >= _guest_count THEN
    RAISE EXCEPTION 'Det finns ingen okopplad gäst kvar att bekräfta';
  END IF;

  INSERT INTO public.visit_guest_member_proposals (
    visit_id, guest_id, target_group_id, target_user_id, proposed_by, status, proposal_kind
  ) VALUES (
    _visit_id, NULL, _group_id, _target_user_id, _uid, 'pending', 'shared_member'
  )
  RETURNING id INTO _proposal_id;

  RETURN _proposal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.propose_shared_visit_member_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_shared_visit_member_v1(uuid, uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_visit_guest_proposal_v1(
  _group_id uuid,
  _proposal_id uuid,
  _response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _proposal public.visit_guest_member_proposals%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _response NOT IN ('accept', 'decline', 'defer') THEN
    RAISE EXCEPTION 'Ogiltigt svar på deltagandeförslaget';
  END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  SELECT proposal.*
  INTO _proposal
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.id = _proposal_id
    AND proposal.target_group_id = _group_id
    AND proposal.target_user_id = _uid
    AND proposal.status IN ('pending', 'deferred')
  FOR UPDATE;

  IF _proposal.id IS NULL THEN
    RAISE EXCEPTION 'Deltagandeförslaget finns inte längre eller tillhör inte dig';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_group_links link
    WHERE link.visit_id = _proposal.visit_id
      AND link.group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte längre synligt i gruppen';
  END IF;

  IF _response = 'defer' THEN
    UPDATE public.visit_guest_member_proposals
    SET status = 'deferred', updated_at = now(), responded_at = now()
    WHERE id = _proposal.id;
    RETURN;
  END IF;

  IF _response = 'decline' THEN
    UPDATE public.visit_guest_member_proposals
    SET status = 'declined', updated_at = now(), responded_at = now()
    WHERE id = _proposal.id;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('visit-guest-identity:' || _proposal.visit_id::text, 0));

  IF _proposal.guest_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = _proposal.guest_id
      AND proposal.status = 'accepted'
      AND proposal.id <> _proposal.id
  ) THEN
    RAISE EXCEPTION 'Gästen har redan bekräftats som en annan deltagare';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = _proposal.visit_id
      AND proposal.target_user_id = _uid
      AND proposal.status = 'accepted'
      AND proposal.id <> _proposal.id
  ) THEN
    RAISE EXCEPTION 'Du är redan bekräftad via ett annat deltagandeförslag';
  END IF;

  INSERT INTO public.visit_participants (visit_id, user_id)
  VALUES (_proposal.visit_id, _uid)
  ON CONFLICT (visit_id, user_id) DO NOTHING;

  UPDATE public.visit_participation_self_corrections
  SET status = 'restored', updated_at = now()
  WHERE visit_id = _proposal.visit_id
    AND user_id = _uid
    AND status = 'declined';

  UPDATE public.visit_guest_member_proposals
  SET status = 'accepted', updated_at = now(), responded_at = now()
  WHERE id = _proposal.id;

  UPDATE public.visit_guest_member_proposals
  SET status = 'cancelled', updated_at = now(), responded_at = now()
  WHERE id <> _proposal.id
    AND status IN ('pending', 'deferred')
    AND (
      (guest_id IS NOT NULL AND guest_id = _proposal.guest_id)
      OR (visit_id = _proposal.visit_id AND target_user_id = _uid)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _visits jsonb;
BEGIN
  _result := public.get_group_app_state_v5k_guest_identity_base(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN visit_row.is_original THEN
          jsonb_set(
            visit_row.item,
            '{participants}',
            COALESCE((
              SELECT jsonb_agg(participant.item ORDER BY participant.ordinality)
              FROM jsonb_array_elements(
                COALESCE(visit_row.item->'participants', '[]'::jsonb)
              ) WITH ORDINALITY AS participant(item, ordinality)
              WHERE NOT (
                participant.item->>'status' = 'guest'
                AND EXISTS (
                  SELECT 1
                  FROM public.visit_guest_member_proposals proposal
                  WHERE proposal.visit_id = visit_row.visit_id
                    AND proposal.guest_id IS NOT NULL
                    AND proposal.status = 'accepted'
                    AND 'guest:' || proposal.guest_id::text = participant.item->>'id'
                    AND EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements(
                        COALESCE(visit_row.item->'participants', '[]'::jsonb)
                      ) AS identified(item)
                      WHERE identified.item->>'id' = proposal.target_user_id::text
                    )
                )
              )
            ), '[]'::jsonb),
            true
          )
        ELSE
          jsonb_set(
            visit_row.item,
            '{externalParticipantCount}',
            to_jsonb(GREATEST(0, visit_row.external_count - visit_row.accepted_visible_count)),
            true
          )
      END
      ORDER BY visit_row.ordinality
    ),
    '[]'::jsonb
  )
  INTO _visits
  FROM (
    SELECT
      visit_item.item,
      visit_item.ordinality,
      (visit_item.item->>'id')::uuid AS visit_id,
      COALESCE((visit_item.item->>'externalParticipantCount')::integer, 0) AS external_count,
      EXISTS (
        SELECT 1 FROM public.visit_group_links original_link
        WHERE original_link.visit_id = (visit_item.item->>'id')::uuid
          AND original_link.group_id = _group_id
          AND original_link.link_type = 'original'
      ) AS is_original,
      (
        SELECT count(*)::integer
        FROM public.visit_guest_member_proposals proposal
        WHERE proposal.visit_id = (visit_item.item->>'id')::uuid
          AND proposal.status = 'accepted'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              COALESCE(visit_item.item->'participants', '[]'::jsonb)
            ) AS identified(item)
            WHERE identified.item->>'id' = proposal.target_user_id::text
          )
      ) AS accepted_visible_count
    FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
      WITH ORDINALITY AS visit_item(item, ordinality)
  ) AS visit_row;

  RETURN jsonb_set(_result, '{visits}', _visits, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5k(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5k(uuid) TO authenticated;

DO $assertions$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'visit_guest_member_proposals'
      AND column_name = 'guest_id'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'guest_id måste vara nullable för neutrala mottagarförslag';
  END IF;
  IF to_regprocedure('public.list_visit_shared_member_candidates_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.propose_shared_visit_member_v1(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'mottagargruppens deltagar-RPC:er saknas';
  END IF;
  IF has_function_privilege('anon', 'public.propose_shared_visit_member_v1(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon får inte skapa deltagandeförslag';
  END IF;
  IF position('link_type = ''original''' IN pg_get_functiondef(
    to_regprocedure('public.validate_visit_participant()')
  )) > 0 THEN
    RAISE EXCEPTION 'deltagarvakten får inte längre kräva originalgrupp';
  END IF;
END;
$assertions$;

COMMIT;
