BEGIN;

-- Issue #393 — Nästa stopp som mjuk kö.
--
-- Vanliga besök ska aldrig konsumera gruppens planeringskö. Endast
-- besöksregistrering som uttryckligen startas från det aktuella Nästa stoppet
-- får ta bort köhuvudet och flytta fram nästa äldsta förslag.
CREATE OR REPLACE FUNCTION public.close_next_stop_v2_on_original_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _selected_place_id uuid;
  _selected_proposal_id uuid;
  _replacement_place_id uuid;
BEGIN
  IF NEW.link_type <> 'original' THEN RETURN NEW; END IF;
  IF current_setting('matrundan.complete_next_stop', true) IS DISTINCT FROM '1' THEN
    RETURN NEW;
  END IF;

  SELECT place_id INTO _place_id
  FROM public.visits
  WHERE id = NEW.visit_id;

  PERFORM public.next_stop_v2_lock(NEW.group_id);

  SELECT place_id INTO _selected_place_id
  FROM public.group_next_place
  WHERE group_id = NEW.group_id
  FOR UPDATE;

  IF _selected_place_id IS NULL OR _selected_place_id IS DISTINCT FROM _place_id THEN
    RAISE EXCEPTION 'Besöket matchar inte gruppens aktuella nästa stopp';
  END IF;

  SELECT id INTO _selected_proposal_id
  FROM public.next_stop_place_proposals
  WHERE group_id = NEW.group_id
    AND place_id = _selected_place_id
  FOR UPDATE;

  IF _selected_proposal_id IS NOT NULL THEN
    DELETE FROM public.next_stop_place_proposals
    WHERE id = _selected_proposal_id;
  END IF;

  SELECT p.place_id INTO _replacement_place_id
  FROM public.next_stop_place_proposals p
  JOIN public.group_places gp
    ON gp.group_id = p.group_id
   AND gp.place_id = p.place_id
   AND gp.collection_status = 'active'
  WHERE p.group_id = NEW.group_id
  ORDER BY p.created_at, p.id
  LIMIT 1;

  -- Den genomförda middagens dag och dagsvar hör inte till nästa köplats.
  PERFORM public.next_stop_v2_sync_legacy_date(
    NEW.group_id,
    NULL,
    NULL,
    NULL,
    _uid
  );

  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);
  IF _replacement_place_id IS NULL THEN
    DELETE FROM public.group_next_place
    WHERE group_id = NEW.group_id;
  ELSE
    INSERT INTO public.group_next_place (group_id, place_id, selected_by, selected_at)
    VALUES (NEW.group_id, _replacement_place_id, _uid, now())
    ON CONFLICT (group_id) DO UPDATE
    SET place_id = EXCLUDED.place_id,
        selected_by = EXCLUDED.selected_by,
        selected_at = EXCLUDED.selected_at;
  END IF;
  PERFORM set_config('matrundan.next_stop_v2_sync', '', true);

  IF _replacement_place_id IS NULL THEN
    DELETE FROM public.next_stop_plans
    WHERE group_id = NEW.group_id;
  ELSE
    UPDATE public.next_stop_plans
    SET planned_date = NULL,
        planned_time = NULL,
        revision = revision + 1,
        updated_by = _uid
    WHERE group_id = NEW.group_id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_next_stop_v2_on_original_visit()
  FROM PUBLIC, anon, authenticated;

-- Behåll den etablerade v5-mutationen som bas för alla vanliga besök. V6 sätter
-- bara en transaktionslokal signal runt samma atomiska besöksskrivning när
-- klienten uttryckligen registrerar från Nästa stopp.
CREATE OR REPLACE FUNCTION public.create_visit_with_review_v6(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
  _is_takeaway boolean DEFAULT false,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _atmosphere smallint DEFAULT NULL,
  _comment text DEFAULT NULL,
  _guest_names text[] DEFAULT '{}'::text[],
  _review_occasions text[] DEFAULT NULL,
  _complete_next_stop boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _visit_id uuid;
BEGIN
  IF COALESCE(_complete_next_stop, false) THEN
    PERFORM set_config('matrundan.complete_next_stop', '1', true);
  END IF;

  _visit_id := public.create_visit_with_review_v5(
    _group_id,
    _place_id,
    _visited_on,
    _meal_type,
    _participant_ids,
    _is_takeaway,
    _taste,
    _value,
    _service,
    _atmosphere,
    _comment,
    _guest_names,
    _review_occasions
  );

  PERFORM set_config('matrundan.complete_next_stop', '', true);
  RETURN _visit_id;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('matrundan.complete_next_stop', '', true);
    RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_visit_with_review_v6(
  uuid, uuid, date, text, uuid[], boolean, smallint, smallint, smallint, smallint,
  text, text[], text[], boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit_with_review_v6(
  uuid, uuid, date, text, uuid[], boolean, smallint, smallint, smallint, smallint,
  text, text[], text[], boolean
) TO authenticated;

DO $assertions$
BEGIN
  IF position(
    'matrundan.complete_next_stop'
    IN pg_get_functiondef('public.close_next_stop_v2_on_original_visit()'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'Nästa stopp-kön saknar explicit completion-vakt';
  END IF;

  IF position(
    'ORDER BY p.created_at, p.id'
    IN pg_get_functiondef('public.close_next_stop_v2_on_original_visit()'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'Nästa stopp-kön avancerar inte deterministiskt';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.create_visit_with_review_v6(uuid,uuid,date,text,uuid[],boolean,smallint,smallint,smallint,smallint,text,text[],text[],boolean)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.create_visit_with_review_v6(uuid,uuid,date,text,uuid[],boolean,smallint,smallint,smallint,smallint,text,text[],text[],boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'create_visit_with_review_v6 har fel execute-grants';
  END IF;
END;
$assertions$;

COMMIT;
