BEGIN;

-- Issue #106 — frivillig blockersignal för gruppens gemensamma dag.
--
-- "Kan inte då" är inte RSVP. Bara explicita markeringar lagras och de gäller
-- exakt den dag som är aktuell när markeringen görs. När dagen ändras eller
-- tas bort rensas markeringarna atomärt.

CREATE TABLE public.next_stop_day_unavailability (
  group_id uuid NOT NULL
    REFERENCES public.next_stop_plans(group_id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  planned_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, member_id)
);

CREATE INDEX next_stop_day_unavailability_member_idx
  ON public.next_stop_day_unavailability(member_id);

CREATE TRIGGER trg_next_stop_day_unavailability_updated_at
  BEFORE UPDATE ON public.next_stop_day_unavailability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.next_stop_day_unavailability ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.next_stop_day_unavailability
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.next_stop_day_unavailability TO service_role;

CREATE OR REPLACE FUNCTION public.get_next_stop_day_unavailability_v2(
  _group_id uuid
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _planned_date date;
  _result uuid[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  SELECT planned_date INTO _planned_date
  FROM public.next_stop_plans
  WHERE group_id = _group_id;

  IF _planned_date IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT COALESCE(array_agg(u.member_id ORDER BY u.updated_at, u.member_id), ARRAY[]::uuid[])
  INTO _result
  FROM public.next_stop_day_unavailability u
  JOIN public.memberships m
    ON m.group_id = u.group_id
   AND m.user_id = u.member_id
   AND m.status = 'active'
  WHERE u.group_id = _group_id
    AND u.planned_date = _planned_date;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_next_stop_day_unavailability_v2(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_stop_day_unavailability_v2(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_next_stop_day_unavailable_v2(
  _group_id uuid,
  _planned_date date,
  _unavailable boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _current_date date;
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

  SELECT planned_date INTO _current_date
  FROM public.next_stop_plans
  WHERE group_id = _group_id
  FOR UPDATE;

  IF _current_date IS DISTINCT FROM _planned_date THEN
    RAISE EXCEPTION 'Dagen ändrades nyss. Ladda om och försök igen.';
  END IF;

  IF _current_date IS NULL THEN
    IF NOT _unavailable THEN
      DELETE FROM public.next_stop_day_unavailability
      WHERE group_id = _group_id AND member_id = _uid;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Lägg till en dag först';
  END IF;

  IF _unavailable THEN
    INSERT INTO public.next_stop_day_unavailability (
      group_id,
      member_id,
      planned_date
    ) VALUES (
      _group_id,
      _uid,
      _current_date
    )
    ON CONFLICT (group_id, member_id) DO UPDATE
    SET planned_date = EXCLUDED.planned_date,
        updated_at = now();
  ELSE
    DELETE FROM public.next_stop_day_unavailability
    WHERE group_id = _group_id AND member_id = _uid;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_next_stop_day_unavailable_v2(uuid, date, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_stop_day_unavailable_v2(uuid, date, boolean)
  TO authenticated;

-- Byt dag atomärt och rensa blockersignaler bara när själva kalenderdagen
-- ändras. Ett ändrat klockslag gäller samma dag och behåller därför signalerna.
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

  IF _current_date IS DISTINCT FROM _planned_date THEN
    DELETE FROM public.next_stop_day_unavailability
    WHERE group_id = _group_id;
  END IF;

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

-- En äldre klient kan fortfarande ändra legacy-datumet. Samma regel gäller:
-- ändrad kalenderdag rensar blockersignaler, ändrat klockslag gör det inte.
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

      IF _current_date IS DISTINCT FROM NEW.proposed_date THEN
        DELETE FROM public.next_stop_day_unavailability
        WHERE group_id = _group_id;
      END IF;
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

    IF FOUND THEN
      DELETE FROM public.next_stop_day_unavailability
      WHERE group_id = _group_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DO $assertions$
BEGIN
  IF NOT COALESCE((
    SELECT c.relrowsecurity
    FROM pg_class c
    WHERE c.oid = to_regclass('public.next_stop_day_unavailability')
  ), false) THEN
    RAISE EXCEPTION 'next-stop day unavailability RLS is missing';
  END IF;

  IF has_table_privilege(
    'authenticated', 'public.next_stop_day_unavailability', 'SELECT'
  ) OR has_table_privilege(
    'anon', 'public.next_stop_day_unavailability', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'next-stop day unavailability is directly readable';
  END IF;

  IF NOT has_function_privilege(
    'authenticated', 'public.get_next_stop_day_unavailability_v2(uuid)', 'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated', 'public.set_next_stop_day_unavailable_v2(uuid,date,boolean)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'next-stop day unavailability RPC grants are missing';
  END IF;
END;
$assertions$;

COMMIT;
