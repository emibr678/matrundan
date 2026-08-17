BEGIN;

-- Ett verkligt originalbesök avslutar både v2-planen och den legacy-rad som
-- hybridens Jag kan/Jag kan inte-svar återanvänder. Den gamla group_next_place-
-- triggern är avsiktligt pausad under v2-synk, så städningen görs explicit här.
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

  PERFORM public.next_stop_v2_sync_legacy_date(
    NEW.group_id,
    NULL,
    NULL,
    NULL,
    auth.uid()
  );

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

DO $assertions$
BEGIN
  IF position(
    'next_stop_v2_sync_legacy_date'
    IN pg_get_functiondef('public.close_next_stop_v2_on_original_visit()'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'verkligt besök stänger inte hybridens dagsvar';
  END IF;
END;
$assertions$;

COMMIT;
