BEGIN;

-- Paket 5D: ett datumförslag för gruppens aktuella nästa stopp.
-- Förslaget är privat för gruppen, kräver aktivt medlemskap och stängs
-- automatiskt när nästa stopp byts, tas bort eller registreras som besökt.

CREATE TABLE public.next_stop_date_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL,
  proposed_date date NOT NULL,
  proposed_time time without time zone,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'confirmed', 'cancelled')),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT next_stop_date_proposals_group_place_fk
    FOREIGN KEY (group_id, place_id)
    REFERENCES public.group_places(group_id, place_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX next_stop_date_proposals_one_open_per_group
  ON public.next_stop_date_proposals(group_id)
  WHERE status IN ('active', 'confirmed');
CREATE INDEX next_stop_date_proposals_group_idx
  ON public.next_stop_date_proposals(group_id, created_at DESC);

CREATE TRIGGER trg_next_stop_date_proposals_updated_at
  BEFORE UPDATE ON public.next_stop_date_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.next_stop_date_responses (
  proposal_id uuid NOT NULL
    REFERENCES public.next_stop_date_proposals(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('fits', 'not_fits', 'unsure')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, member_id)
);

CREATE INDEX next_stop_date_responses_member_idx
  ON public.next_stop_date_responses(member_id);
CREATE TRIGGER trg_next_stop_date_responses_updated_at
  BEFORE UPDATE ON public.next_stop_date_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.next_stop_date_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.next_stop_date_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.next_stop_date_proposals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.next_stop_date_responses FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.next_stop_date_proposals TO service_role;
GRANT ALL ON public.next_stop_date_responses TO service_role;

DROP TRIGGER IF EXISTS trg_next_stop_date_proposals_writable
  ON public.next_stop_date_proposals;
CREATE TRIGGER trg_next_stop_date_proposals_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.next_stop_date_proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

CREATE OR REPLACE FUNCTION public.close_next_stop_date_on_next_place_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.place_id IS DISTINCT FROM OLD.place_id THEN
    UPDATE public.next_stop_date_proposals
      SET status = 'cancelled',
          cancelled_at = now(),
          cancelled_by = auth.uid(),
          updated_at = now()
      WHERE group_id = OLD.group_id
        AND status IN ('active', 'confirmed');
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_next_stop_date_on_next_place_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_group_next_place_close_date_proposal
  ON public.group_next_place;
CREATE TRIGGER trg_group_next_place_close_date_proposal
  AFTER UPDATE OF place_id OR DELETE ON public.group_next_place
  FOR EACH ROW EXECUTE FUNCTION public.close_next_stop_date_on_next_place_change();

CREATE OR REPLACE FUNCTION public.propose_next_stop_date(
  _group_id uuid,
  _proposed_date date,
  _proposed_time time without time zone DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _proposal_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _proposed_date IS NULL THEN RAISE EXCEPTION 'Välj ett datum'; END IF;
  IF _proposed_date < (now() AT TIME ZONE 'Europe/Stockholm')::date THEN
    RAISE EXCEPTION 'Datumet kan inte ligga i det förflutna';
  END IF;

  SELECT gnp.place_id
  INTO _place_id
  FROM public.group_next_place gnp
  WHERE gnp.group_id = _group_id
  FOR UPDATE;

  IF _place_id IS NULL THEN
    RAISE EXCEPTION 'Välj nästa stopp innan ett datum föreslås';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_places gp
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Nästa stopp finns inte längre i gruppens lista';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.next_stop_date_proposals p
    WHERE p.group_id = _group_id
      AND p.status IN ('active', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Det finns redan ett datumförslag för nästa stopp';
  END IF;

  INSERT INTO public.next_stop_date_proposals (
    group_id, place_id, proposed_date, proposed_time, created_by
  ) VALUES (
    _group_id, _place_id, _proposed_date, _proposed_time, _uid
  )
  RETURNING id INTO _proposal_id;

  RETURN _proposal_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_next_stop_date(
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
  _place_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _response NOT IN ('fits', 'not_fits', 'unsure') THEN
    RAISE EXCEPTION 'Ogiltigt svar';
  END IF;

  SELECT p.place_id
  INTO _place_id
  FROM public.next_stop_date_proposals p
  WHERE p.id = _proposal_id
    AND p.group_id = _group_id
    AND p.status = 'active'
  FOR UPDATE;

  IF _place_id IS NULL THEN
    RAISE EXCEPTION 'Datumförslaget är inte längre aktivt';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_next_place gnp
    WHERE gnp.group_id = _group_id AND gnp.place_id = _place_id
  ) THEN
    RAISE EXCEPTION 'Datumförslaget hör inte längre till nästa stopp';
  END IF;

  INSERT INTO public.next_stop_date_responses (proposal_id, member_id, response)
  VALUES (_proposal_id, _uid, _response)
  ON CONFLICT (proposal_id, member_id) DO UPDATE SET
    response = EXCLUDED.response,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_next_stop_date_status(
  _group_id uuid,
  _proposal_id uuid,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _proposal public.next_stop_date_proposals%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _status NOT IN ('confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'Ogiltig status';
  END IF;

  SELECT * INTO _proposal
  FROM public.next_stop_date_proposals p
  WHERE p.id = _proposal_id AND p.group_id = _group_id
  FOR UPDATE;

  IF NOT FOUND OR _proposal.status = 'cancelled' THEN
    RAISE EXCEPTION 'Datumförslaget är inte längre aktivt';
  END IF;
  IF _proposal.created_by <> _uid
     AND NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast förslagsställaren, ägare eller admin kan ändra status';
  END IF;

  IF _status = 'confirmed' THEN
    IF _proposal.status <> 'active' THEN RETURN; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.group_next_place gnp
      WHERE gnp.group_id = _group_id AND gnp.place_id = _proposal.place_id
    ) THEN
      RAISE EXCEPTION 'Datumförslaget hör inte längre till nästa stopp';
    END IF;

    UPDATE public.next_stop_date_proposals
      SET status = 'confirmed',
          confirmed_at = now(),
          confirmed_by = _uid,
          updated_at = now()
      WHERE id = _proposal_id;
  ELSE
    UPDATE public.next_stop_date_proposals
      SET status = 'cancelled',
          cancelled_at = now(),
          cancelled_by = _uid,
          updated_at = now()
      WHERE id = _proposal_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.propose_next_stop_date(uuid, date, time without time zone)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_next_stop_date(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_next_stop_date_status(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_next_stop_date(uuid, date, time without time zone)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_next_stop_date(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_next_stop_date_status(uuid, uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5d(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _proposal jsonb;
BEGIN
  _result := public.get_group_app_state_v5c(_group_id);

  SELECT jsonb_build_object(
    'id', p.id,
    'placeId', p.place_id,
    'date', to_char(p.proposed_date, 'YYYY-MM-DD'),
    'time', CASE
      WHEN p.proposed_time IS NULL THEN NULL
      ELSE to_char(p.proposed_time, 'HH24:MI')
    END,
    'createdBy', p.created_by,
    'status', p.status,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'confirmedAt', p.confirmed_at,
    'confirmedBy', p.confirmed_by,
    'cancelledAt', p.cancelled_at,
    'cancelledBy', p.cancelled_by,
    'responses', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'memberId', r.member_id,
        'response', r.response,
        'updatedAt', r.updated_at
      ) ORDER BY r.updated_at), '[]'::jsonb)
      FROM public.next_stop_date_responses r
      JOIN public.memberships m
        ON m.group_id = p.group_id
       AND m.user_id = r.member_id
       AND m.status = 'active'
      WHERE r.proposal_id = p.id
    )
  )
  INTO _proposal
  FROM public.next_stop_date_proposals p
  WHERE p.group_id = _group_id
    AND p.status IN ('active', 'confirmed')
  ORDER BY p.created_at DESC
  LIMIT 1;

  RETURN jsonb_set(
    _result,
    '{nextStopDateProposal}',
    COALESCE(_proposal, 'null'::jsonb),
    true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5d(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5d(uuid) TO authenticated;

COMMIT;
