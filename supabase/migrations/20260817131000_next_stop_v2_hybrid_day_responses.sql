BEGIN;

-- Issue #106 — hybrid mellan det enkla v1-kortet och v2:s bevarade ställesförslag.
--
-- V2 äger fortsatt ett fokuserat Nästa stopp + alternativa ställesförslag och
-- en valfri gemensam dag. Platsstöd tas bort. Dagsvaren återanvänder den redan
-- privata legacy-tabellen next_stop_date_responses så utrullningen har en enda
-- underliggande sanning för "Jag kan" / "Jag kan inte".

DROP FUNCTION IF EXISTS public.set_next_stop_place_support_v2(uuid, uuid, boolean);
DROP TABLE IF EXISTS public.next_stop_place_supports CASCADE;

-- När v2 byter fokus ska legacy-datumet inte stängas av den gamla triggern.
-- Vanliga äldre set_next_place-anrop behåller däremot tidigare beteende.
CREATE OR REPLACE FUNCTION public.close_next_stop_date_on_next_place_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('matrundan.next_stop_v2_sync', true) = '1' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

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

-- V2 speglar sin enda gemensamma dag till den befintliga legacy-proposalraden.
-- Fokusbyte med oförändrad dag uppdaterar bara place_id och bevarar svaren.
-- Dagbyte eller borttagen dag rensar svaren, eftersom de bara gäller just dagen.
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
DECLARE
  _proposal_id uuid;
  _current_date date;
BEGIN
  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);

  SELECT p.id, p.proposed_date
  INTO _proposal_id, _current_date
  FROM public.next_stop_date_proposals p
  WHERE p.group_id = _group_id
    AND p.status IN ('active', 'confirmed')
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _place_id IS NULL OR _planned_date IS NULL THEN
    IF _proposal_id IS NOT NULL THEN
      DELETE FROM public.next_stop_date_responses
      WHERE proposal_id = _proposal_id;

      UPDATE public.next_stop_date_proposals
      SET status = 'cancelled',
          cancelled_at = now(),
          cancelled_by = _uid,
          updated_at = now()
      WHERE id = _proposal_id;
    END IF;

    PERFORM set_config('matrundan.next_stop_v2_sync', '', true);
    RETURN;
  END IF;

  IF _proposal_id IS NULL THEN
    INSERT INTO public.next_stop_date_proposals (
      group_id,
      place_id,
      proposed_date,
      proposed_time,
      created_by,
      status
    ) VALUES (
      _group_id,
      _place_id,
      _planned_date,
      NULL,
      _uid,
      'active'
    );
  ELSE
    IF _current_date IS DISTINCT FROM _planned_date THEN
      DELETE FROM public.next_stop_date_responses
      WHERE proposal_id = _proposal_id;
    END IF;

    UPDATE public.next_stop_date_proposals
    SET place_id = _place_id,
        proposed_date = _planned_date,
        proposed_time = NULL,
        status = 'active',
        confirmed_at = NULL,
        confirmed_by = NULL,
        cancelled_at = NULL,
        cancelled_by = NULL,
        updated_at = now()
    WHERE id = _proposal_id;
  END IF;

  PERFORM set_config('matrundan.next_stop_v2_sync', '', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.next_stop_v2_sync_legacy_date(
  uuid, uuid, date, time without time zone, uuid
) FROM PUBLIC, anon, authenticated;

-- NULL betyder att gruppen inte längre har ett Nästa stopp. I hybridmodellen
-- finns då inte heller någon fristående dag eller några dagsvar.
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

  IF _place_id IS NULL THEN
    _planned_date := NULL;
  END IF;

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
  SET planned_date = _planned_date,
      planned_time = NULL,
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

-- Hybridens dag hör alltid till ett faktiskt Nästa stopp. Dagen är fortsatt
-- den enda schemadimensionen och dagbyte nollställer gruppens dagsvar via
-- next_stop_v2_sync_legacy_date.
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

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = _group_id
  FOR UPDATE;

  IF _planned_date IS NOT NULL AND _selected_place_id IS NULL THEN
    RAISE EXCEPTION 'Välj nästa stopp innan ni lägger till en dag';
  END IF;

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

-- Dagsresponsen är avsiktligt binär. NULL tar bort användarens svar.
CREATE OR REPLACE FUNCTION public.set_next_stop_day_response_v2(
  _group_id uuid,
  _response text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _planned_date date;
  _selected_place_id uuid;
  _proposal_id uuid;
  _legacy_response text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _response IS NOT NULL AND _response NOT IN ('can', 'cannot') THEN
    RAISE EXCEPTION 'Ogiltigt svar';
  END IF;

  PERFORM public.next_stop_v2_lock(_group_id);

  SELECT planned_date INTO _planned_date
  FROM public.next_stop_plans
  WHERE group_id = _group_id
  FOR UPDATE;

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = _group_id
  FOR UPDATE;

  IF _planned_date IS NULL OR _selected_place_id IS NULL THEN
    RAISE EXCEPTION 'Lägg till en dag för nästa stopp först';
  END IF;

  SELECT p.id INTO _proposal_id
  FROM public.next_stop_date_proposals p
  WHERE p.group_id = _group_id
    AND p.place_id = _selected_place_id
    AND p.proposed_date = _planned_date
    AND p.status IN ('active', 'confirmed')
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _proposal_id IS NULL THEN
    PERFORM public.next_stop_v2_sync_legacy_date(
      _group_id,
      _selected_place_id,
      _planned_date,
      NULL,
      _uid
    );

    SELECT p.id INTO _proposal_id
    FROM public.next_stop_date_proposals p
    WHERE p.group_id = _group_id
      AND p.place_id = _selected_place_id
      AND p.proposed_date = _planned_date
      AND p.status IN ('active', 'confirmed')
    ORDER BY p.created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF _proposal_id IS NULL THEN
    RAISE EXCEPTION 'Kunde inte hitta gruppens aktuella dag';
  END IF;

  IF _response IS NULL THEN
    DELETE FROM public.next_stop_date_responses
    WHERE proposal_id = _proposal_id AND member_id = _uid;
    RETURN;
  END IF;

  _legacy_response := CASE WHEN _response = 'can' THEN 'fits' ELSE 'not_fits' END;

  INSERT INTO public.next_stop_date_responses (proposal_id, member_id, response)
  VALUES (_proposal_id, _uid, _legacy_response)
  ON CONFLICT (proposal_id, member_id) DO UPDATE
  SET response = EXCLUDED.response,
      updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.set_next_stop_day_response_v2(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_stop_day_response_v2(uuid, text)
  TO authenticated;

-- Arkiveras det fokuserade stället följer dag och svar med ett ersättande
-- alternativ. Finns inget alternativ kvar försvinner även dagen och svaren.
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
  _planned_date date;
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

      SELECT planned_date INTO _planned_date
      FROM public.next_stop_plans
      WHERE group_id = NEW.group_id;

      IF _replacement_place_id IS NULL THEN
        _planned_date := NULL;
      END IF;

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

      PERFORM public.next_stop_v2_sync_legacy_date(
        NEW.group_id,
        _replacement_place_id,
        _planned_date,
        NULL,
        auth.uid()
      );
    END IF;

    IF _deleted > 0 OR _was_selected THEN
      UPDATE public.next_stop_plans
      SET planned_date = CASE WHEN _was_selected THEN _planned_date ELSE planned_date END,
          planned_time = NULL,
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

-- v5k behåller supports-fältet som tom kompatibilitetsarray för klienter som
-- redan hunnit läsa en tidigare preview, men supporttabellen och mutations-RPC:n
-- finns inte längre i slutmodellen.
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
      'supports', '[]'::jsonb
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
  IF to_regclass('public.next_stop_place_supports') IS NOT NULL
     OR to_regprocedure('public.set_next_stop_place_support_v2(uuid,uuid,boolean)') IS NOT NULL THEN
    RAISE EXCEPTION 'platsstöd finns kvar trots hybridmodellen';
  END IF;

  IF NOT has_function_privilege(
    'authenticated', 'public.set_next_stop_day_response_v2(uuid,text)', 'EXECUTE'
  ) OR has_function_privilege(
    'anon', 'public.set_next_stop_day_response_v2(uuid,text)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'dagsvars-RPC har fel execute-grants';
  END IF;

  IF position(
    'Välj nästa stopp innan ni lägger till en dag'
    IN pg_get_functiondef('public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'dagen är inte längre bunden till ett faktiskt nästa stopp';
  END IF;
END;
$assertions$;

COMMIT;
