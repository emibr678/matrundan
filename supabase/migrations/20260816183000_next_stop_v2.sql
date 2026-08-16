BEGIN;

-- Issue #106 — Nästa stopp v2.
--
-- Den nya modellen skiljer öppna ställesförslag från det uttryckligen valda
-- nästa stoppet i group_next_place. Dag är gemensam planeringsdata för gruppen
-- och kan finnas utan valt ställe; klockslag är endast en valfri detalj till
-- dagen. Befintliga klienter och datum-RPC:er bevaras under övergången.

CREATE TABLE public.next_stop_plans (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  planned_date date,
  planned_time time without time zone,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT next_stop_plans_time_requires_date
    CHECK (planned_time IS NULL OR planned_date IS NOT NULL)
);

CREATE TABLE public.next_stop_place_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL,
  proposed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT next_stop_place_proposals_group_place_fk
    FOREIGN KEY (group_id, place_id)
    REFERENCES public.group_places(group_id, place_id)
    ON DELETE CASCADE,
  CONSTRAINT next_stop_place_proposals_unique UNIQUE (group_id, place_id)
);

CREATE INDEX next_stop_place_proposals_group_created_idx
  ON public.next_stop_place_proposals(group_id, created_at, id);

CREATE TABLE public.next_stop_place_supports (
  proposal_id uuid NOT NULL
    REFERENCES public.next_stop_place_proposals(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, member_id)
);

CREATE INDEX next_stop_place_supports_member_idx
  ON public.next_stop_place_supports(member_id);

CREATE TRIGGER trg_next_stop_plans_updated_at
  BEFORE UPDATE ON public.next_stop_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_next_stop_place_supports_updated_at
  BEFORE UPDATE ON public.next_stop_place_supports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.next_stop_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.next_stop_place_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.next_stop_place_supports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.next_stop_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.next_stop_place_proposals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.next_stop_place_supports FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.next_stop_plans TO service_role;
GRANT ALL ON TABLE public.next_stop_place_proposals TO service_role;
GRANT ALL ON TABLE public.next_stop_place_supports TO service_role;

-- Befintligt bestämt nästa stopp blir ett redan bestämt v2-läge. Ett aktivt
-- legacy-datum följer med som gruppens gemensamma dag/tid.
INSERT INTO public.next_stop_plans (
  group_id,
  planned_date,
  planned_time,
  revision,
  updated_by,
  created_at,
  updated_at
)
SELECT
  gnp.group_id,
  legacy.proposed_date,
  legacy.proposed_time,
  1,
  COALESCE(legacy.confirmed_by, legacy.created_by, gnp.selected_by),
  LEAST(gnp.selected_at, COALESCE(legacy.created_at, gnp.selected_at)),
  GREATEST(gnp.selected_at, COALESCE(legacy.updated_at, gnp.selected_at))
FROM public.group_next_place gnp
LEFT JOIN LATERAL (
  SELECT p.*
  FROM public.next_stop_date_proposals p
  WHERE p.group_id = gnp.group_id
    AND p.status IN ('active', 'confirmed')
  ORDER BY p.created_at DESC
  LIMIT 1
) legacy ON true
ON CONFLICT (group_id) DO NOTHING;

INSERT INTO public.next_stop_place_proposals (
  group_id,
  place_id,
  proposed_by,
  created_at
)
SELECT
  gnp.group_id,
  gnp.place_id,
  gnp.selected_by,
  gnp.selected_at
FROM public.group_next_place gnp
JOIN public.group_places gp
  ON gp.group_id = gnp.group_id
 AND gp.place_id = gnp.place_id
 AND gp.collection_status = 'active'
ON CONFLICT (group_id, place_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_stop_v2_lock(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('next-stop-v2:' || _group_id::text, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.next_stop_v2_lock(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_stop_v2_ensure_plan(
  _group_id uuid,
  _uid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.next_stop_plans (group_id, updated_by)
  VALUES (_group_id, _uid)
  ON CONFLICT (group_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.next_stop_v2_ensure_plan(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_stop_v2_assert_revision(
  _group_id uuid,
  _expected_revision bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _revision bigint;
BEGIN
  IF _expected_revision IS NULL THEN RETURN; END IF;

  SELECT revision INTO _revision
  FROM public.next_stop_plans
  WHERE group_id = _group_id;

  IF _revision IS NULL OR _revision <> _expected_revision THEN
    RAISE EXCEPTION 'Planeringen ändrades nyss av någon annan. Ladda om och försök igen.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.next_stop_v2_assert_revision(uuid, bigint)
  FROM PUBLIC, anon, authenticated;

-- Håll den gamla singeldatum-modellen läsbar för cachade klienter. Denna helper
-- används bara av v2-RPC:er och speglar inte svar/omröstning till den nya UX:en.
CREATE OR REPLACE FUNCTION public.next_stop_v2_sync_legacy_date(
  _group_id uuid,
  _place_id uuid,
  _planned_date date,
  _planned_time time without time zone,
  _uid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);

  UPDATE public.next_stop_date_proposals
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = _uid,
      updated_at = now()
  WHERE group_id = _group_id
    AND status IN ('active', 'confirmed');

  IF _place_id IS NOT NULL AND _planned_date IS NOT NULL THEN
    INSERT INTO public.next_stop_date_proposals (
      group_id,
      place_id,
      proposed_date,
      proposed_time,
      created_by,
      status,
      confirmed_at,
      confirmed_by
    ) VALUES (
      _group_id,
      _place_id,
      _planned_date,
      _planned_time,
      _uid,
      'confirmed',
      now(),
      _uid
    );
  END IF;

  PERFORM set_config('matrundan.next_stop_v2_sync', '', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.next_stop_v2_sync_legacy_date(
  uuid, uuid, date, time without time zone, uuid
) FROM PUBLIC, anon, authenticated;

-- Legacy-datum som skrivs av en äldre klient förs in i v2-planen. Ändringar
-- som v2 själv gör på legacy-tabellen ignoreras för att undvika feedbackloop.
CREATE OR REPLACE FUNCTION public.mirror_legacy_next_stop_date_to_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_date date;
  _current_time time without time zone;
  _group_id uuid := COALESCE(NEW.group_id, OLD.group_id);
BEGIN
  IF current_setting('matrundan.next_stop_v2_sync', true) = '1'
     OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.next_stop_plans (group_id, updated_by)
  VALUES (_group_id, auth.uid())
  ON CONFLICT (group_id) DO NOTHING;

  IF NEW.status IN ('active', 'confirmed') THEN
    SELECT planned_date, planned_time
    INTO _current_date, _current_time
    FROM public.next_stop_plans
    WHERE group_id = _group_id
    FOR UPDATE;

    IF _current_date IS DISTINCT FROM NEW.proposed_date
       OR _current_time IS DISTINCT FROM NEW.proposed_time THEN
      UPDATE public.next_stop_plans
      SET planned_date = NEW.proposed_date,
          planned_time = NEW.proposed_time,
          revision = revision + 1,
          updated_by = auth.uid()
      WHERE group_id = _group_id;
    END IF;
  ELSIF OLD.status IN ('active', 'confirmed') AND NEW.status = 'cancelled' THEN
    UPDATE public.next_stop_plans
    SET planned_date = NULL,
        planned_time = NULL,
        revision = revision + 1,
        updated_by = auth.uid()
    WHERE group_id = _group_id
      AND planned_date IS NOT DISTINCT FROM OLD.proposed_date
      AND planned_time IS NOT DISTINCT FROM OLD.proposed_time;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mirror_legacy_next_stop_date_to_v2()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_next_stop_date_mirror_v2
  ON public.next_stop_date_proposals;
CREATE TRIGGER trg_next_stop_date_mirror_v2
  AFTER INSERT OR UPDATE OF proposed_date, proposed_time, status
  ON public.next_stop_date_proposals
  FOR EACH ROW EXECUTE FUNCTION public.mirror_legacy_next_stop_date_to_v2();

-- Äldre klienter fortsätter använda set_next_place. Funktionen behåller den
-- gamla signaturen och aktivitetssemantiken men bump:ar v2-revisionen så att
-- en ny klient aldrig kan skriva över ett parallellt val tyst.
CREATE OR REPLACE FUNCTION public.set_next_place(_group_id uuid, _place_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_name text;
  _current uuid;
  _actor_name text;
  _planned_date date;
  _planned_time time without time zone;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  PERFORM public.next_stop_v2_lock(_group_id);
  PERFORM public.next_stop_v2_ensure_plan(_group_id, _uid);

  SELECT place_id INTO _current
  FROM public.group_next_place
  WHERE group_id = _group_id
  FOR UPDATE;

  IF _current IS NOT DISTINCT FROM _place_id THEN RETURN; END IF;

  IF _place_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.group_places
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppens aktiva lista';
  END IF;

  SELECT planned_date, planned_time
  INTO _planned_date, _planned_time
  FROM public.next_stop_plans
  WHERE group_id = _group_id
  FOR UPDATE;

  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);

  IF _place_id IS NULL THEN
    DELETE FROM public.group_next_place WHERE group_id = _group_id;
  ELSE
    INSERT INTO public.group_next_place (group_id, place_id, selected_by, selected_at)
    VALUES (_group_id, _place_id, _uid, now())
    ON CONFLICT (group_id) DO UPDATE
    SET place_id = EXCLUDED.place_id,
        selected_by = EXCLUDED.selected_by,
        selected_at = EXCLUDED.selected_at;
  END IF;

  PERFORM set_config('matrundan.next_stop_v2_sync', '', true);

  UPDATE public.next_stop_plans
  SET revision = revision + 1,
      updated_by = _uid
  WHERE group_id = _group_id;

  PERFORM public.next_stop_v2_sync_legacy_date(
    _group_id,
    _place_id,
    _planned_date,
    _planned_time,
    _uid
  );

  IF _place_id IS NOT NULL THEN
    SELECT name INTO _place_name FROM public.places WHERE id = _place_id;
    SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;

    INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
    VALUES (
      _group_id,
      'next-picked',
      _uid,
      _place_id,
      jsonb_build_object(
        'text',
        COALESCE(_actor_name, 'Någon') || ' valde ' ||
          COALESCE(_place_name, 'ett ställe') || ' som nästa stopp'
      )
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_next_place(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_place(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.propose_next_stop_place_v2(
  _group_id uuid,
  _place_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _proposal_id uuid;
  _proposal_count integer;
  _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_places
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppens aktiva lista';
  END IF;

  PERFORM public.next_stop_v2_lock(_group_id);
  PERFORM public.next_stop_v2_ensure_plan(_group_id, _uid);

  SELECT id INTO _proposal_id
  FROM public.next_stop_place_proposals
  WHERE group_id = _group_id AND place_id = _place_id;

  IF _proposal_id IS NOT NULL THEN RETURN _proposal_id; END IF;

  SELECT count(*) INTO _proposal_count
  FROM public.next_stop_place_proposals p
  JOIN public.group_places gp
    ON gp.group_id = p.group_id
   AND gp.place_id = p.place_id
   AND gp.collection_status = 'active'
  WHERE p.group_id = _group_id;

  IF _proposal_count >= 5 THEN
    RAISE EXCEPTION 'Ni har redan fem ställen på förslag. Ta bort ett innan ni lägger till ett nytt.';
  END IF;

  INSERT INTO public.next_stop_place_proposals (
    group_id, place_id, proposed_by
  ) VALUES (
    _group_id, _place_id, _uid
  )
  RETURNING id INTO _proposal_id;
  _inserted := true;

  IF _inserted THEN
    UPDATE public.next_stop_plans
    SET revision = revision + 1,
        updated_by = _uid
    WHERE group_id = _group_id;
  END IF;

  RETURN _proposal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.propose_next_stop_place_v2(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_next_stop_place_v2(uuid, uuid)
  TO authenticated;

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
    SELECT 1 FROM public.next_stop_place_proposals p
    JOIN public.group_places gp
      ON gp.group_id = p.group_id
     AND gp.place_id = p.place_id
     AND gp.collection_status = 'active'
    WHERE p.id = _proposal_id AND p.group_id = _group_id
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
    WHERE proposal_id = _proposal_id AND member_id = _uid;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_next_stop_place_support_v2(uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_stop_place_support_v2(uuid, uuid, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.select_next_stop_place_v2(
  _group_id uuid,
  _proposal_id uuid,
  _expected_revision bigint DEFAULT NULL
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
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  PERFORM public.next_stop_v2_lock(_group_id);
  PERFORM public.next_stop_v2_ensure_plan(_group_id, _uid);
  PERFORM public.next_stop_v2_assert_revision(_group_id, _expected_revision);

  SELECT p.place_id INTO _place_id
  FROM public.next_stop_place_proposals p
  JOIN public.group_places gp
    ON gp.group_id = p.group_id
   AND gp.place_id = p.place_id
   AND gp.collection_status = 'active'
  WHERE p.id = _proposal_id AND p.group_id = _group_id;

  IF _place_id IS NULL THEN RAISE EXCEPTION 'Förslaget är inte längre aktivt'; END IF;

  PERFORM public.set_next_place(_group_id, _place_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.select_next_stop_place_v2(uuid, uuid, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_next_stop_place_v2(uuid, uuid, bigint)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_next_stop_selection_v2(
  _group_id uuid,
  _expected_revision bigint DEFAULT NULL
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

  PERFORM public.next_stop_v2_lock(_group_id);
  PERFORM public.next_stop_v2_ensure_plan(_group_id, _uid);
  PERFORM public.next_stop_v2_assert_revision(_group_id, _expected_revision);
  PERFORM public.set_next_place(_group_id, NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_next_stop_selection_v2(uuid, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_next_stop_selection_v2(uuid, bigint)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_next_stop_place_v2(
  _group_id uuid,
  _proposal_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _proposal public.next_stop_place_proposals%ROWTYPE;
  _selected_place_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  PERFORM public.next_stop_v2_lock(_group_id);

  SELECT * INTO _proposal
  FROM public.next_stop_place_proposals
  WHERE id = _proposal_id AND group_id = _group_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF _proposal.proposed_by IS DISTINCT FROM _uid
     AND NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast förslagsställaren, ägare eller admin kan ta bort förslaget';
  END IF;

  PERFORM public.next_stop_v2_ensure_plan(_group_id, _uid);

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = _group_id
  FOR UPDATE;

  DELETE FROM public.next_stop_place_proposals WHERE id = _proposal_id;

  IF _selected_place_id IS NOT DISTINCT FROM _proposal.place_id THEN
    PERFORM public.set_next_place(_group_id, NULL);
  ELSE
    UPDATE public.next_stop_plans
    SET revision = revision + 1,
        updated_by = _uid
    WHERE group_id = _group_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.withdraw_next_stop_place_v2(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_next_stop_place_v2(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_next_stop_schedule_v2(
  _group_id uuid,
  _planned_date date,
  _planned_time time without time zone DEFAULT NULL,
  _expected_revision bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _selected_place_id uuid;
  _current_date date;
  _current_time time without time zone;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _planned_time IS NOT NULL AND _planned_date IS NULL THEN
    RAISE EXCEPTION 'Välj en dag innan du lägger till en tid';
  END IF;
  IF _planned_date IS NOT NULL
     AND _planned_date < (now() AT TIME ZONE 'Europe/Stockholm')::date THEN
    RAISE EXCEPTION 'Dagen kan inte ligga i det förflutna';
  END IF;

  PERFORM public.next_stop_v2_lock(_group_id);
  PERFORM public.next_stop_v2_ensure_plan(_group_id, _uid);
  PERFORM public.next_stop_v2_assert_revision(_group_id, _expected_revision);

  SELECT planned_date, planned_time
  INTO _current_date, _current_time
  FROM public.next_stop_plans
  WHERE group_id = _group_id
  FOR UPDATE;

  IF _current_date IS NOT DISTINCT FROM _planned_date
     AND _current_time IS NOT DISTINCT FROM _planned_time THEN
    RETURN;
  END IF;

  UPDATE public.next_stop_plans
  SET planned_date = _planned_date,
      planned_time = _planned_time,
      revision = revision + 1,
      updated_by = _uid
  WHERE group_id = _group_id;

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = _group_id;

  PERFORM public.next_stop_v2_sync_legacy_date(
    _group_id,
    _selected_place_id,
    _planned_date,
    _planned_time,
    _uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_next_stop_schedule_v2(
  uuid, date, time without time zone, bigint
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_stop_schedule_v2(
  uuid, date, time without time zone, bigint
) TO authenticated;

-- Arkivering av ett ställe tar bort just det förslaget. Den gemensamma dagen
-- får ligga kvar eftersom dag utan ställe är ett giltigt v2-läge.
CREATE OR REPLACE FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _deleted integer;
BEGIN
  IF OLD.collection_status IS DISTINCT FROM NEW.collection_status
     AND NEW.collection_status = 'archived' THEN
    DELETE FROM public.next_stop_place_proposals
    WHERE group_id = NEW.group_id AND place_id = NEW.place_id;
    GET DIAGNOSTICS _deleted = ROW_COUNT;

    IF _deleted > 0 THEN
      UPDATE public.next_stop_plans
      SET revision = revision + 1,
          updated_by = auth.uid()
      WHERE group_id = NEW.group_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_group_place_cleanup_next_stop_v2 ON public.group_places;
CREATE TRIGGER trg_group_place_cleanup_next_stop_v2
  AFTER UPDATE OF collection_status ON public.group_places
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2();

-- Arkiverad grupp ska inte bära aktiv nästa-stopp-planering.
CREATE OR REPLACE FUNCTION public.cleanup_next_stop_on_group_archive_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status
     AND NEW.lifecycle_status = 'archived' THEN
    DELETE FROM public.next_stop_plans WHERE group_id = NEW.id;
    DELETE FROM public.next_stop_place_proposals WHERE group_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_next_stop_on_group_archive_v2()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_group_cleanup_next_stop_v2 ON public.groups;
CREATE TRIGGER trg_group_cleanup_next_stop_v2
  AFTER UPDATE OF lifecycle_status ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_next_stop_on_group_archive_v2();

-- Ett originalbesök på ett valt eller föreslaget ställe är den verkliga
-- händelsen och avslutar just det pågående nästa-stopp-flödet. Delade besök gör
-- aldrig detta och ett besök på ett helt annat ställe lämnar förslagen orörda.
CREATE OR REPLACE FUNCTION public.close_next_stop_v2_on_original_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _place_id uuid;
  _matches boolean;
BEGIN
  IF NEW.link_type <> 'original' THEN RETURN NEW; END IF;

  SELECT place_id INTO _place_id
  FROM public.visits
  WHERE id = NEW.visit_id;

  SELECT (
    EXISTS (
      SELECT 1 FROM public.next_stop_place_proposals
      WHERE group_id = NEW.group_id AND place_id = _place_id
    )
    OR EXISTS (
      SELECT 1 FROM public.group_next_place
      WHERE group_id = NEW.group_id AND place_id = _place_id
    )
  ) INTO _matches;

  IF NOT _matches THEN RETURN NEW; END IF;

  PERFORM public.next_stop_v2_lock(NEW.group_id);
  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);
  DELETE FROM public.group_next_place WHERE group_id = NEW.group_id;
  PERFORM set_config('matrundan.next_stop_v2_sync', '', true);
  DELETE FROM public.next_stop_place_proposals WHERE group_id = NEW.group_id;
  DELETE FROM public.next_stop_plans WHERE group_id = NEW.group_id;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_next_stop_v2_on_original_visit()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_visit_group_link_close_next_stop_v2
  ON public.visit_group_links;
CREATE TRIGGER trg_visit_group_link_close_next_stop_v2
  AFTER INSERT ON public.visit_group_links
  FOR EACH ROW EXECUTE FUNCTION public.close_next_stop_v2_on_original_visit();

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
      'plannedTime', CASE
        WHEN _plan.planned_time IS NULL THEN NULL
        ELSE to_char(_plan.planned_time, 'HH24:MI')
      END,
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
  IF has_table_privilege('authenticated', 'public.next_stop_plans', 'SELECT')
     OR has_table_privilege('authenticated', 'public.next_stop_place_proposals', 'SELECT')
     OR has_table_privilege('authenticated', 'public.next_stop_place_supports', 'SELECT')
     OR has_table_privilege('anon', 'public.next_stop_plans', 'SELECT') THEN
    RAISE EXCEPTION 'next-stop-v2 tables are directly readable by client roles';
  END IF;

  IF NOT has_function_privilege(
    'authenticated', 'public.get_group_app_state_v5k(uuid)', 'EXECUTE'
  ) OR has_function_privilege(
    'anon', 'public.get_group_app_state_v5k(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'v5k has incorrect execute grants';
  END IF;

  IF NOT has_function_privilege(
    'authenticated', 'public.propose_next_stop_place_v2(uuid,uuid)', 'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated', 'public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'next-stop-v2 mutation grants are missing';
  END IF;
END;
$assertions$;

COMMIT;
