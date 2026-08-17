BEGIN;

-- När ett fokuserat förslag arkiveras kan v2 flytta Nästa stopp till äldsta
-- kvarvarande alternativ. Spegla samma platsbyte till legacy-datumet så äldre
-- klienter inte tillfälligt visar gruppens dag mot det arkiverade stället.
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
    'next_stop_v2_sync_legacy_date'
    IN pg_get_functiondef('public.cleanup_next_stop_proposal_on_place_archive_v2()'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'arkiveringsbryggan synkar inte ersättande nästa stopp mot legacy-datum';
  END IF;
END;
$assertions$;

COMMIT;
