BEGIN;

-- Issue #214 — cross-group gäst → medlem.
--
-- En privat gästidentitet får bara användas från originalgruppens kontext.
-- Kopplingen blir ett serverstyrt förslag till en medlem i en redan länkad
-- målgrupp. Först den utpekade användarens accept lägger till samma användare
-- som deltagare på det kanoniska besöket.

CREATE TABLE public.visit_guest_member_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.visit_guests(id) ON DELETE CASCADE,
  target_group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'deferred', 'declined', 'accepted', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX visit_guest_member_proposals_visit_idx
  ON public.visit_guest_member_proposals(visit_id, target_group_id);
CREATE INDEX visit_guest_member_proposals_target_idx
  ON public.visit_guest_member_proposals(target_user_id, target_group_id, status);

-- En gäst kan bara ha en pågående/fastställd kontoidentitet åt gången och samma
-- användare kan inte samtidigt föreslås som flera olika gäster på samma visit.
CREATE UNIQUE INDEX visit_guest_member_proposals_guest_open_unique
  ON public.visit_guest_member_proposals(guest_id)
  WHERE status IN ('pending', 'deferred', 'accepted');
CREATE UNIQUE INDEX visit_guest_member_proposals_visit_user_open_unique
  ON public.visit_guest_member_proposals(visit_id, target_user_id)
  WHERE status IN ('pending', 'deferred', 'accepted');

ALTER TABLE public.visit_guest_member_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visit_guest_member_proposals FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.visit_guest_member_proposals TO service_role;

-- Flat, minimerad kandidatlista för originalgruppens privata gästvy.
-- Varje rad innehåller exakt en gäst + en redan länkad målgrupp + en aktiv
-- medlem i den målgruppen. Ingen global personkatalog eller olänkad grupp läcks.
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
        'proposalStatus', (
          SELECT proposal.status
          FROM public.visit_guest_member_proposals proposal
          WHERE proposal.guest_id = guest.id
            AND proposal.target_group_id = target_group.id
            AND proposal.target_user_id = candidate.user_id
            AND proposal.status <> 'cancelled'
          ORDER BY proposal.created_at DESC, proposal.id DESC
          LIMIT 1
        )
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
  WHERE guest.visit_id = _visit_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.visit_participants participant
      WHERE participant.visit_id = _visit_id
        AND participant.user_id = candidate.user_id
    );

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_visit_guest_member_targets_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visit_guest_member_targets_v1(uuid, uuid)
  TO authenticated;

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

  -- Frigör endast relevanta förslag som blivit omöjliga att besvara efter
  -- unlink, arkivering eller medlemskapsförlust. Ingen legitim pending-rad
  -- skrivs över av en annan användare.
  UPDATE public.visit_guest_member_proposals proposal
  SET status = 'cancelled',
      updated_at = now(),
      responded_at = now()
  WHERE proposal.status IN ('pending', 'deferred')
    AND (proposal.guest_id = _guest_id
      OR (proposal.visit_id = _visit_id AND proposal.target_user_id = _target_user_id))
    AND (
      NOT public.group_is_active(proposal.target_group_id)
      OR NOT EXISTS (
        SELECT 1
        FROM public.visit_group_links link
        WHERE link.visit_id = proposal.visit_id
          AND link.group_id = proposal.target_group_id
      )
      OR NOT EXISTS (
        SELECT 1
        FROM public.memberships membership
        WHERE membership.group_id = proposal.target_group_id
          AND membership.user_id = proposal.target_user_id
          AND membership.status = 'active'
      )
    );

  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = _guest_id
      AND proposal.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Gästen är redan kopplad till en bekräftad deltagare';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visit_participants participant
    WHERE participant.visit_id = _visit_id
      AND participant.user_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Personen är redan identifierad deltagare på besöket';
  END IF;

  SELECT proposal.id
  INTO _proposal_id
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.guest_id = _guest_id
    AND proposal.target_group_id = _target_group_id
    AND proposal.target_user_id = _target_user_id
    AND proposal.status IN ('pending', 'deferred')
  ORDER BY proposal.created_at DESC
  LIMIT 1;

  IF _proposal_id IS NOT NULL THEN
    RETURN _proposal_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = _guest_id
      AND proposal.target_group_id = _target_group_id
      AND proposal.target_user_id = _target_user_id
      AND proposal.status = 'declined'
  ) THEN
    RAISE EXCEPTION 'Personen har redan svarat att hen inte var med';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = _guest_id
      AND proposal.status IN ('pending', 'deferred')
  ) THEN
    RAISE EXCEPTION 'Gästen har redan ett väntande deltagandeförslag';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = _visit_id
      AND proposal.target_user_id = _target_user_id
      AND proposal.status IN ('pending', 'deferred')
  ) THEN
    RAISE EXCEPTION 'Personen har redan ett väntande deltagandeförslag för besöket';
  END IF;

  INSERT INTO public.visit_guest_member_proposals (
    visit_id,
    guest_id,
    target_group_id,
    target_user_id,
    proposed_by,
    status
  ) VALUES (
    _visit_id,
    _guest_id,
    _target_group_id,
    _target_user_id,
    _uid,
    'pending'
  )
  RETURNING id INTO _proposal_id;

  RETURN _proposal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.propose_visit_guest_member_v1(uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_visit_guest_member_v1(uuid, uuid, uuid, uuid, uuid)
  TO authenticated;

-- Den utpekade medlemmen får bara veta att det finns ett förslag på det visit
-- som redan är synligt i den aktuella gruppen. Source group, gästnamn, guest_id,
-- proposer och andra medlemskap returneras inte.
CREATE OR REPLACE FUNCTION public.get_own_visit_guest_proposal_v1(
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RETURN NULL; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links link
    WHERE link.visit_id = _visit_id
      AND link.group_id = _group_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'proposalId', proposal.id,
    'status', proposal.status
  )
  INTO _result
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.visit_id = _visit_id
    AND proposal.target_group_id = _group_id
    AND proposal.target_user_id = _uid
    AND proposal.status IN ('pending', 'deferred')
  ORDER BY CASE proposal.status WHEN 'pending' THEN 0 ELSE 1 END,
           proposal.updated_at DESC,
           proposal.id DESC
  LIMIT 1;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_own_visit_guest_proposal_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_visit_guest_proposal_v1(uuid, uuid)
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
    SELECT 1
    FROM public.visit_group_links link
    WHERE link.visit_id = _proposal.visit_id
      AND link.group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte längre synligt i gruppen';
  END IF;

  IF _response = 'defer' THEN
    UPDATE public.visit_guest_member_proposals
    SET status = 'deferred',
        updated_at = now(),
        responded_at = now()
    WHERE id = _proposal.id;
    RETURN;
  END IF;

  IF _response = 'decline' THEN
    UPDATE public.visit_guest_member_proposals
    SET status = 'declined',
        updated_at = now(),
        responded_at = now()
    WHERE id = _proposal.id;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('visit-guest-identity:' || _proposal.visit_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.guest_id = _proposal.guest_id
      AND proposal.status = 'accepted'
      AND proposal.id <> _proposal.id
  ) THEN
    RAISE EXCEPTION 'Gästen har redan bekräftats som en annan deltagare';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = _proposal.visit_id
      AND proposal.target_user_id = _uid
      AND proposal.status = 'accepted'
      AND proposal.id <> _proposal.id
  ) THEN
    RAISE EXCEPTION 'Du är redan bekräftad via en annan gäst på besöket';
  END IF;

  INSERT INTO public.visit_participants (visit_id, user_id)
  VALUES (_proposal.visit_id, _uid)
  ON CONFLICT (visit_id, user_id) DO NOTHING;

  UPDATE public.visit_participation_self_corrections
  SET status = 'restored',
      updated_at = now()
  WHERE visit_id = _proposal.visit_id
    AND user_id = _uid
    AND status = 'declined';

  UPDATE public.visit_guest_member_proposals
  SET status = 'accepted',
      updated_at = now(),
      responded_at = now()
  WHERE id = _proposal.id;

  UPDATE public.visit_guest_member_proposals
  SET status = 'cancelled',
      updated_at = now(),
      responded_at = now()
  WHERE id <> _proposal.id
    AND status IN ('pending', 'deferred')
    AND (
      guest_id = _proposal.guest_id
      OR (visit_id = _proposal.visit_id AND target_user_id = _uid)
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_visit_guest_proposal_v1(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_visit_guest_proposal_v1(uuid, uuid, text)
  TO authenticated;

-- Behåll det etablerade v5k-kontraktet men neutralisera dubbelpresentation efter
-- en accepterad gästidentitet. Bas-RPC:n blir serverintern.
ALTER FUNCTION public.get_group_app_state_v5k(uuid)
  RENAME TO get_group_app_state_v5k_guest_identity_base;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5k_guest_identity_base(uuid)
  FROM PUBLIC, anon, authenticated;

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
            ),
            '{externalParticipantCount}',
            to_jsonb(
              GREATEST(
                0,
                visit_row.external_count
                - GREATEST(0, visit_row.accepted_count - visit_row.accepted_visible_count)
              )
            ),
            true
          )
        ELSE
          jsonb_set(
            visit_row.item,
            '{externalParticipantCount}',
            to_jsonb(GREATEST(0, visit_row.external_count - visit_row.accepted_count)),
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
        SELECT 1
        FROM public.visit_group_links original_link
        WHERE original_link.visit_id = (visit_item.item->>'id')::uuid
          AND original_link.group_id = _group_id
          AND original_link.link_type = 'original'
      ) AS is_original,
      (
        SELECT count(*)::integer
        FROM public.visit_guest_member_proposals proposal
        WHERE proposal.visit_id = (visit_item.item->>'id')::uuid
          AND proposal.status = 'accepted'
      ) AS accepted_count,
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
  IF to_regclass('public.visit_guest_member_proposals') IS NULL THEN
    RAISE EXCEPTION 'visit_guest_member_proposals saknas';
  END IF;
  IF has_table_privilege('authenticated', 'public.visit_guest_member_proposals', 'SELECT')
     OR has_table_privilege('anon', 'public.visit_guest_member_proposals', 'SELECT') THEN
    RAISE EXCEPTION 'gäst-medlem-förslag får inte läsas direkt av klientroller';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.list_visit_guest_member_targets_v1(uuid,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.list_visit_guest_member_targets_v1(uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'kandidat-RPC har fel execute-grants';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.respond_visit_guest_proposal_v1(uuid,uuid,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.respond_visit_guest_proposal_v1(uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'svars-RPC har fel execute-grants';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.get_group_app_state_v5k_guest_identity_base(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'serverintern v5k-bas får inte vara klientkörbar';
  END IF;
END;
$assertions$;

COMMIT;
