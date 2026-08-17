BEGIN;

-- Issue #106 — platsintresse i hybridmodellen.
--
-- Dagsvaren (Jag kan/Jag kan inte) beskriver om den gemensamma dagen fungerar.
-- Den här separata signalen beskriver bara om medlemmen vill till ett visst
-- ställe. Flera ställen får stödjas samtidigt och signalerna väljer eller
-- rankar aldrig gruppens nästa stopp server-side.

CREATE TABLE public.next_stop_place_supports (
  proposal_id uuid NOT NULL
    REFERENCES public.next_stop_place_proposals(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, member_id)
);

CREATE INDEX next_stop_place_supports_member_idx
  ON public.next_stop_place_supports(member_id);

CREATE TRIGGER trg_next_stop_place_supports_updated_at
  BEFORE UPDATE ON public.next_stop_place_supports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.next_stop_place_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.next_stop_place_supports FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.next_stop_place_supports TO service_role;

CREATE OR REPLACE FUNCTION public.set_next_stop_place_support_v2(
  _group_id uuid,
  _proposal_id uuid,
  _supported boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
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
    FROM public.next_stop_place_proposals p
    JOIN public.group_places gp
      ON gp.group_id = p.group_id
     AND gp.place_id = p.place_id
     AND gp.collection_status = 'active'
    WHERE p.id = _proposal_id
      AND p.group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Förslaget är inte längre aktivt';
  END IF;

  IF _supported THEN
    INSERT INTO public.next_stop_place_supports (proposal_id, member_id)
    VALUES (_proposal_id, _uid)
    ON CONFLICT (proposal_id, member_id) DO UPDATE
    SET updated_at = now();
  ELSE
    DELETE FROM public.next_stop_place_supports
    WHERE proposal_id = _proposal_id
      AND member_id = _uid;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_next_stop_place_support_v2(uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_stop_place_support_v2(uuid, uuid, boolean)
  TO authenticated;

-- v5k exponerar bara minimerad medlemsidentitet/tidsstämpel för den privata
-- gruppens ställessignaler. Inga signaler påverkar selectedPlaceId.
CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _next_stop jsonb;
  _plan public.next_stop_plans%ROWTYPE;
  _selected_place_id uuid;
  _proposals jsonb;
BEGIN
  _result := public.get_group_app_state_v5j(_group_id);

  SELECT * INTO _plan
  FROM public.next_stop_plans
  WHERE group_id = _group_id;

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = _group_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'placeId', p.place_id,
      'proposedBy', p.proposed_by,
      'createdAt', p.created_at,
      'supports', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'memberId', s.member_id,
            'updatedAt', s.updated_at
          )
          ORDER BY s.updated_at, s.member_id
        )
        FROM public.next_stop_place_supports s
        JOIN public.memberships m
          ON m.group_id = p.group_id
         AND m.user_id = s.member_id
         AND m.status = 'active'
        WHERE s.proposal_id = p.id
      ), '[]'::jsonb)
    )
    ORDER BY p.created_at, p.id
  ), '[]'::jsonb)
  INTO _proposals
  FROM public.next_stop_place_proposals p
  JOIN public.group_places gp
    ON gp.group_id = p.group_id
   AND gp.place_id = p.place_id
   AND gp.collection_status = 'active'
  WHERE p.group_id = _group_id;

  IF _plan.group_id IS NULL
     AND _selected_place_id IS NULL
     AND jsonb_array_length(_proposals) = 0 THEN
    _next_stop := NULL;
  ELSE
    _next_stop := jsonb_build_object(
      'revision', COALESCE(_plan.revision, 0),
      'plannedDate', CASE
        WHEN _plan.planned_date IS NULL THEN NULL
        ELSE to_char(_plan.planned_date, 'YYYY-MM-DD')
      END,
      'plannedTime', NULL,
      'selectedPlaceId', _selected_place_id,
      'proposals', _proposals
    );
  END IF;

  RETURN jsonb_set(
    _result,
    '{nextStop}',
    COALESCE(_next_stop, 'null'::jsonb),
    true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5k(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5k(uuid) TO authenticated;

DO $assertions$
BEGIN
  IF to_regclass('public.next_stop_place_supports') IS NULL THEN
    RAISE EXCEPTION 'next_stop_place_supports saknas';
  END IF;

  IF has_table_privilege('authenticated', 'public.next_stop_place_supports', 'SELECT')
     OR has_table_privilege('anon', 'public.next_stop_place_supports', 'SELECT') THEN
    RAISE EXCEPTION 'platsintresse får inte läsas direkt av klientroller';
  END IF;

  IF NOT has_function_privilege(
    'authenticated', 'public.set_next_stop_place_support_v2(uuid,uuid,boolean)', 'EXECUTE'
  ) OR has_function_privilege(
    'anon', 'public.set_next_stop_place_support_v2(uuid,uuid,boolean)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'platsintresse-RPC har fel execute-grants';
  END IF;

  IF position(
    'next_stop_place_supports'
    IN pg_get_functiondef('public.get_group_app_state_v5k(uuid)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'v5k exponerar inte platsintresse';
  END IF;
END;
$assertions$;

COMMIT;
