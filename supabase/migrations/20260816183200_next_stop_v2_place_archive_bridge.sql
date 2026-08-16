BEGIN;

-- Issue #106: den äldre archive_group_place-RPC:n raderar group_next_place.
-- Legacy-triggern ska fortsatt stänga sitt singeldatum, men den raderingen får
-- inte speglas tillbaka till v2-planen: i v2 är dag giltig även utan valt ställe.
-- Vi behåller exakt samma RPC-signatur och behörigheter och markerar bara den
-- interna kompatibilitetsskrivningen medan group_next_place raderas.

CREATE OR REPLACE FUNCTION public.archive_group_place(_group_id uuid, _place_id uuid)
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
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ta bort matställen från gruppen';
  END IF;

  UPDATE public.group_places
    SET collection_status = 'archived',
        archived_at = now(),
        archived_by = _uid,
        updated_at = now()
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active';

  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.group_places
    WHERE group_id = _group_id AND place_id = _place_id
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppen';
  END IF;

  PERFORM set_config('matrundan.next_stop_v2_sync', '1', true);
  DELETE FROM public.group_next_place
    WHERE group_id = _group_id AND place_id = _place_id;
  PERFORM set_config('matrundan.next_stop_v2_sync', '', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_group_place(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_group_place(uuid, uuid) TO authenticated;

COMMIT;
