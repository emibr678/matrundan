BEGIN;

-- Issue #106 — slutlig förenkling av Nästa stopp v2.
--
-- Produktinvarianten är nu enkel: om gruppen har ett eller flera aktiva
-- ställesförslag finns alltid exakt ett av dem som gruppens nästa stopp i
-- group_next_place. Det första förslaget får momentum automatiskt; senare
-- förslag bevaras som alternativ tills gruppen uttryckligen byter. V2 bär bara
-- en valfri gemensam dag. Klockslag och öppet "Bestäm"-läge ingår inte.

-- Tid kan ha skrivits i en tidigare kandidat på samma ännu ej driftsatta
-- migrationskedja. Nollställ den och lås v2-planen till dag-only. Den äldre
-- next_stop_date_proposals-tabellen behålls för bakåtkompatibla klienter.
UPDATE public.next_stop_plans
SET planned_time = NULL
WHERE planned_time IS NOT NULL;

ALTER TABLE public.next_stop_plans
  DROP CONSTRAINT IF EXISTS next_stop_plans_no_time;
ALTER TABLE public.next_stop_plans
  ADD CONSTRAINT next_stop_plans_no_time CHECK (planned_time IS NULL);

-- V2 speglar dag till legacy-modellen men aldrig klockslag.
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
      NULL,
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

-- En äldre klient får fortfarande ändra datumet. Tiden ignoreras av v2.
CREATE OR REPLACE FUNCTION public.mirror_legacy_next_stop_date_to_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_date date;
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
    SELECT planned_date INTO _current_date
    FROM public.next_stop_plans
    WHERE group_id = _group_id
    FOR UPDATE;

    IF _current_date IS DISTINCT FROM NEW.proposed_date THEN
      UPDATE public.next_stop_plans
      SET planned_date = NEW.proposed_date,
          planned_time = NULL,
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
      AND planned_date IS NOT DISTINCT FROM OLD.proposed_date;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mirror_legacy_next_stop_date_to_v2()
  FROM PUBLIC, anon, authenticated;

-- Legacy set_next_place används fortfarande av redan publicerade klienter och
-- är också den gemensamma interna vägen för att byta fokus. NULL betyder i den
-- gamla modellen "inget nästa stopp" och rensar därför alla aktiva v2-förslag;
-- dagen får ligga kvar som fristående gruppinformation.
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

  SELECT planned_date INTO _planned_date
  FROM public.next_stop_plans
  WHERE group_id = _group_id
  FOR UPDATE;

  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);

  IF _place_id IS NULL THEN
    DELETE FROM public.group_next_place WHERE group_id = _group_id;
    DELETE FROM public.next_stop_place_proposals WHERE group_id = _group_id;
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
  SET planned_time = NULL,
      revision = revision + 1,
      updated_by = _uid
  WHERE group_id = _group_id;

  PERFORM public.next_stop_v2_sync_legacy_date(
    _group_id,
    _place_id,
    _planned_date,
    NULL,
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

-- Första förslaget blir nästa stopp automatiskt. Senare förslag läggs bara till
-- och kan aldrig skriva över det befintliga nästa stoppet.
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
  _current_place_id uuid;
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

  SELECT place_id INTO _current_place_id
  FROM public.group_next_place
  WHERE group_id = _group_id;

  IF _proposal_id IS NOT NULL THEN
    IF _current_place_id IS NULL THEN
      PERFORM public.set_next_place(_group_id, _place_id);
    END IF;
    RETURN _proposal_id;
  END IF;

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

  IF _current_place_id IS NULL THEN
    PERFORM public.set_next_place(_group_id, _place_id);
  ELSE
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

-- Det enda uttryckliga beslutet i v2 är att byta från nuvarande nästa stopp till
-- ett redan bevarat alternativ.
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

-- Ett fokuserat förslag får inte lämna gruppen i ett tomt "öppet" state. Tas
-- det bort flyttas nästa stopp därför deterministiskt till äldsta kvarvarande
-- aktiva förslag. Finns inget alternativ återgår gruppen till inget nästa stopp.
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
  _replacement_place_id uuid;
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
    SELECT p.place_id INTO _replacement_place_id
    FROM public.next_stop_place_proposals p
    JOIN public.group_places gp
      ON gp.group_id = p.group_id
     AND gp.place_id = p.place_id
     AND gp.collection_status = 'active'
    WHERE p.group_id = _group_id
    ORDER BY p.created_at, p.id
    LIMIT 1;

    PERFORM public.set_next_place(_group_id, _replacement_place_id);
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

-- Behåll den gamla RPC-signaturen genom utrullningen men gör den strikt
-- dag-only. Klockslag avvisas server-side så en gammal previewklient inte kan
-- återinföra en produktdimension som den nya klienten inte visar.
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _planned_time IS NOT NULL THEN
    RAISE EXCEPTION 'Nästa stopp använder bara dag, inte klockslag';
  END IF;
  IF _planned_date IS NOT NULL
     AND _planned_date < (now() AT TIME ZONE 'Europe/Stockholm')::date THEN
    RAISE EXCEPTION 'Dagen kan inte ligga i det förflutna';
  END IF;

  PERFORM public.next_stop_v2_lock(_group_id);
  PERFORM public.next_stop_v2_ensure_plan(_group_id, _uid);
  PERFORM public.next_stop_v2_assert_revision(_group_id, _expected_revision);

  SELECT planned_date INTO _current_date
  FROM public.next_stop_plans
  WHERE group_id = _group_id
  FOR UPDATE;

  IF _current_date IS NOT DISTINCT FROM _planned_date THEN RETURN; END IF;

  UPDATE public.next_stop_plans
  SET planned_date = _planned_date,
      planned_time = NULL,
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
    NULL,
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

-- Den tidigare v2-kandidaten hade ett öppet val-RPC. Ingen publicerad klient
-- använder det och det strider mot den slutliga produktmodellen.
DROP FUNCTION IF EXISTS public.clear_next_stop_selection_v2(uuid, bigint);

-- Om ett ställe arkiveras försvinner förslaget. Var det gruppens nästa stopp
-- flyttas fokus till äldsta kvarvarande alternativ; annars påverkas inte fokus.
CREATE OR REPLACE FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _deleted integer;
  _was_selected boolean := false;
  _replacement_place_id uuid;
BEGIN
  IF OLD.collection_status IS DISTINCT FROM NEW.collection_status
     AND NEW.collection_status = 'archived' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.group_next_place
      WHERE group_id = NEW.group_id
        AND place_id = NEW.place_id
    ) INTO _was_selected;

    DELETE FROM public.next_stop_place_proposals
    WHERE group_id = NEW.group_id AND place_id = NEW.place_id;
    GET DIAGNOSTICS _deleted = ROW_COUNT;

    IF _was_selected THEN
      SELECT p.place_id INTO _replacement_place_id
      FROM public.next_stop_place_proposals p
      JOIN public.group_places gp
        ON gp.group_id = p.group_id
       AND gp.place_id = p.place_id
       AND gp.collection_status = 'active'
      WHERE p.group_id = NEW.group_id
      ORDER BY p.created_at, p.id
      LIMIT 1;

      PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);
      IF _replacement_place_id IS NULL THEN
        DELETE FROM public.group_next_place WHERE group_id = NEW.group_id;
      ELSE
        INSERT INTO public.group_next_place (group_id, place_id, selected_by, selected_at)
        VALUES (NEW.group_id, _replacement_place_id, auth.uid(), now())
        ON CONFLICT (group_id) DO UPDATE
        SET place_id = EXCLUDED.place_id,
            selected_by = EXCLUDED.selected_by,
            selected_at = EXCLUDED.selected_at;
      END IF;
      PERFORM set_config('matrundan.next_stop_v2_sync', '', true);
    END IF;

    IF _deleted > 0 OR _was_selected THEN
      UPDATE public.next_stop_plans
      SET planned_time = NULL,
          revision = revision + 1,
          updated_by = auth.uid()
      WHERE group_id = NEW.group_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()
  FROM PUBLIC, anon, authenticated;

DO $assertions$
BEGIN
  IF position(
    'IF _current_place_id IS NULL THEN'
    IN pg_get_functiondef('public.propose_next_stop_place_v2(uuid,uuid)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'första nästa-stopp-förslaget får inte lämnas utan fokus';
  END IF;

  IF position(
    'Nästa stopp använder bara dag, inte klockslag'
    IN pg_get_functiondef('public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'next-stop-v2 saknar dag-only-vakt';
  END IF;
END;
$assertions$;

COMMIT;
