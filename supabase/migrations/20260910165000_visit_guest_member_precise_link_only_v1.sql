BEGIN;

-- Issue #214 — slutlig modell: en specifik gäst kopplas till en specifik medlem.
-- De tillfälliga mottagargrupps-/självvägarna tas bort framåtriktat.

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    JOIN public.reviews review
      ON review.visit_id = proposal.visit_id
     AND review.user_id = proposal.target_user_id
    WHERE proposal.proposal_kind = 'shared_member'
      AND proposal.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Kan inte återställa generell deltagarkoppling med efterföljande omdöme';
  END IF;
END;
$guard$;

UPDATE public.visit_participation_self_corrections correction
SET status = 'declined',
    updated_at = now()
WHERE correction.status = 'restored'
  AND EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals proposal
    WHERE proposal.visit_id = correction.visit_id
      AND proposal.target_user_id = correction.user_id
      AND proposal.proposal_kind = 'shared_member'
      AND proposal.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1
        FROM public.visit_guest_member_proposals precise
        WHERE precise.visit_id = proposal.visit_id
          AND precise.target_user_id = proposal.target_user_id
          AND precise.proposal_kind = 'guest_link'
          AND precise.status = 'accepted'
      )
  );

DELETE FROM public.visit_participants participant
WHERE EXISTS (
  SELECT 1
  FROM public.visit_guest_member_proposals proposal
  WHERE proposal.visit_id = participant.visit_id
    AND proposal.target_user_id = participant.user_id
    AND proposal.proposal_kind = 'shared_member'
    AND proposal.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1
      FROM public.visit_guest_member_proposals precise
      WHERE precise.visit_id = proposal.visit_id
        AND precise.target_user_id = proposal.target_user_id
        AND precise.proposal_kind = 'guest_link'
        AND precise.status = 'accepted'
    )
);

DELETE FROM public.visit_guest_member_proposals
WHERE proposal_kind = 'shared_member';

DROP FUNCTION IF EXISTS public.confirm_shared_visit_self_v1(uuid, uuid);
DROP FUNCTION IF EXISTS public.propose_shared_visit_member_v1(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.list_visit_shared_member_candidates_v1(uuid, uuid);

ALTER TABLE public.visit_guest_member_proposals
  DROP CONSTRAINT IF EXISTS visit_guest_member_proposals_kind_guest_check;
ALTER TABLE public.visit_guest_member_proposals
  ALTER COLUMN guest_id SET NOT NULL;
ALTER TABLE public.visit_guest_member_proposals
  ADD CONSTRAINT visit_guest_member_proposals_kind_guest_check
  CHECK (proposal_kind = 'guest_link' AND guest_id IS NOT NULL);

DO $assertions$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.visit_guest_member_proposals
    WHERE proposal_kind <> 'guest_link'
  ) THEN
    RAISE EXCEPTION 'Endast precisa gästkopplingar får finnas kvar';
  END IF;

  IF to_regprocedure('public.confirm_shared_visit_self_v1(uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.propose_shared_visit_member_v1(uuid,uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.list_visit_shared_member_candidates_v1(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Generella mottagar-RPC:er får inte finnas kvar';
  END IF;

  IF to_regprocedure('public.propose_visit_guest_member_v1(uuid,uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.respond_visit_guest_proposal_v1(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Den precisa gästkopplingsvägen saknas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'visit_guest_member_proposals'
      AND column_name = 'guest_id'
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION 'guest_id måste vara obligatoriskt i slutmodellen';
  END IF;

  IF position('link_type = ''original''' IN pg_get_functiondef(
    to_regprocedure('public.validate_visit_participant()')
  )) > 0 THEN
    RAISE EXCEPTION 'Bekräftad målmedlem får inte åter blockeras av originalgruppstvång';
  END IF;
END;
$assertions$;

NOTIFY pgrst, 'reload schema';

COMMIT;
