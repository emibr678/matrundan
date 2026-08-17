BEGIN;

-- Issue #106: en redan publicerad klient kan fortfarande anropa set_next_place
-- efter att v2-migrationen har driftsatts. Bevara då det valda stället även som
-- ett v2-förslag så att en ny klient kan öppna valet igen utan att tappa idén.
-- Om listan redan innehåller fem andra förslag avvisas legacy-valet i stället
-- för att tyst radera diskussion eller skapa ett sjätte aktivt förslag.

CREATE OR REPLACE FUNCTION public.bridge_group_next_place_to_v2_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _proposal_count integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.place_id IS NOT DISTINCT FROM OLD.place_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.next_stop_place_proposals p
    WHERE p.group_id = NEW.group_id
      AND p.place_id = NEW.place_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _proposal_count
  FROM public.next_stop_place_proposals p
  JOIN public.group_places gp
    ON gp.group_id = p.group_id
   AND gp.place_id = p.place_id
   AND gp.collection_status = 'active'
  WHERE p.group_id = NEW.group_id;

  IF _proposal_count >= 5 THEN
    RAISE EXCEPTION 'Ni har redan fem ställen på förslag. Ta bort ett innan nästa stopp ändras.';
  END IF;

  INSERT INTO public.next_stop_place_proposals (
    group_id,
    place_id,
    proposed_by,
    created_at
  ) VALUES (
    NEW.group_id,
    NEW.place_id,
    NEW.selected_by,
    NEW.selected_at
  )
  ON CONFLICT (group_id, place_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.bridge_group_next_place_to_v2_proposal()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_group_next_place_bridge_v2 ON public.group_next_place;
CREATE TRIGGER trg_group_next_place_bridge_v2
  BEFORE INSERT OR UPDATE OF place_id ON public.group_next_place
  FOR EACH ROW EXECUTE FUNCTION public.bridge_group_next_place_to_v2_proposal();

COMMIT;
