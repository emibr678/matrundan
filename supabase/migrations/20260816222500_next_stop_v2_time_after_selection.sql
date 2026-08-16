BEGIN;

-- Issue #106 — tid är praktisk kompletteringsinformation först efter att ett
-- ställe har bestämts. Dag får fortsatt finnas utan ställe. Ett byte av dag
-- rensar tid, ett direkt byte mellan två bestämda ställen får behålla den.

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

  -- När valet öppnas helt igen finns inte längre ett bestämt stopp att knyta
  -- klockslaget till. Dagen ligger däremot kvar.
  IF _place_id IS NULL THEN
    _planned_time := NULL;
  END IF;

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
  SET planned_time = _planned_time,
      revision = revision + 1,
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
  _effective_time time without time zone;
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

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = _group_id
  FOR UPDATE;

  IF _planned_time IS NOT NULL AND _selected_place_id IS NULL THEN
    RAISE EXCEPTION 'Bestäm ett nästa stopp innan du lägger till en tid';
  END IF;

  SELECT planned_date, planned_time
  INTO _current_date, _current_time
  FROM public.next_stop_plans
  WHERE group_id = _group_id
  FOR UPDATE;

  _effective_time := _planned_time;

  -- Tid är kopplad till den överenskomna dagen. Ett dagbyte är därför alltid
  -- två tydliga steg: byt dag först, komplettera sedan med tid om det behövs.
  IF _planned_date IS NULL OR _current_date IS DISTINCT FROM _planned_date THEN
    _effective_time := NULL;
  END IF;

  IF _current_date IS NOT DISTINCT FROM _planned_date
     AND _current_time IS NOT DISTINCT FROM _effective_time THEN
    RETURN;
  END IF;

  UPDATE public.next_stop_plans
  SET planned_date = _planned_date,
      planned_time = _effective_time,
      revision = revision + 1,
      updated_by = _uid
  WHERE group_id = _group_id;

  PERFORM public.next_stop_v2_sync_legacy_date(
    _group_id,
    _selected_place_id,
    _planned_date,
    _effective_time,
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

CREATE OR REPLACE FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _deleted integer;
  _was_selected boolean := false;
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

    IF _deleted > 0 OR _was_selected THEN
      UPDATE public.next_stop_plans
      SET planned_time = CASE WHEN _was_selected THEN NULL ELSE planned_time END,
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
    'Bestäm ett nästa stopp innan du lägger till en tid'
    IN pg_get_functiondef('public.set_next_stop_schedule_v2(uuid,date,time without time zone,bigint)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'next-stop-v2 saknar servervakt för tid utan bestämt stopp';
  END IF;
END;
$assertions$;

COMMIT;
