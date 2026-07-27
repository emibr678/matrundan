BEGIN;

-- Paket 4B komplettering: aktiva samlingsplatser krävs för nya besök,
-- favoriter och nästa stopp. Återläggning av ett arkiverat ställe återanvänder
-- den befintliga kanoniska platsen och gruppkopplingen.

CREATE OR REPLACE FUNCTION public.enforce_active_group_place()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _group_id uuid;
  _place_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  _group_id := NULLIF(to_jsonb(NEW)->>'group_id', '')::uuid;
  _place_id := NULLIF(to_jsonb(NEW)->>'place_id', '')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_places gp
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället är arkiverat i gruppen';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_active_group_place() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_favorites_active_place ON public.favorites;
CREATE TRIGGER trg_favorites_active_place
  BEFORE INSERT OR UPDATE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_group_place();

DROP TRIGGER IF EXISTS trg_group_next_place_active_place ON public.group_next_place;
CREATE TRIGGER trg_group_next_place_active_place
  BEFORE INSERT OR UPDATE ON public.group_next_place
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_group_place();

CREATE OR REPLACE FUNCTION public.enforce_original_visit_active_place()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _place_id uuid;
BEGIN
  IF NEW.link_type <> 'original' THEN
    RETURN NEW;
  END IF;

  SELECT place_id INTO _place_id FROM public.visits WHERE id = NEW.visit_id;
  IF _place_id IS NULL THEN RAISE EXCEPTION 'Besöket finns inte'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_places gp
    WHERE gp.group_id = NEW.group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället är arkiverat i gruppen';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_original_visit_active_place() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_visit_group_links_original_active_place ON public.visit_group_links;
CREATE TRIGGER trg_visit_group_links_original_active_place
  BEFORE INSERT OR UPDATE ON public.visit_group_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_original_visit_active_place();

CREATE OR REPLACE FUNCTION public.restore_group_place_for_shared_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _place_id uuid;
BEGIN
  IF NEW.link_type <> 'shared' THEN RETURN NEW; END IF;

  SELECT place_id INTO _place_id FROM public.visits WHERE id = NEW.visit_id;
  UPDATE public.group_places
    SET collection_status = 'active',
        archived_at = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE group_id = NEW.group_id
      AND place_id = _place_id
      AND collection_status = 'archived';

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_group_place_for_shared_visit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_visit_group_links_restore_place ON public.visit_group_links;
CREATE TRIGGER trg_visit_group_links_restore_place
  AFTER INSERT ON public.visit_group_links
  FOR EACH ROW EXECUTE FUNCTION public.restore_group_place_for_shared_visit();

CREATE OR REPLACE FUNCTION public.create_place_v4b(
  _group_id uuid,
  _name text,
  _category text,
  _cuisines text[] DEFAULT '{}',
  _occasions text[] DEFAULT '{}',
  _address text DEFAULT '',
  _area text DEFAULT NULL,
  _city text DEFAULT '',
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _notes text DEFAULT NULL,
  _photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _collection_status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  SELECT p.id, gp.collection_status
  INTO _place_id, _collection_status
  FROM public.group_places gp
  JOIN public.places p ON p.id = gp.place_id
  WHERE gp.group_id = _group_id
    AND lower(trim(p.name)) = lower(trim(_name))
    AND lower(trim(COALESCE(p.address, ''))) = lower(trim(COALESCE(_address, '')))
  LIMIT 1;

  IF _place_id IS NOT NULL THEN
    IF _collection_status = 'active' THEN
      RAISE EXCEPTION 'Ett ställe med samma namn och adress finns redan i gruppen'
        USING ERRCODE = 'unique_violation';
    END IF;

    UPDATE public.group_places
      SET collection_status = 'active',
          archived_at = NULL,
          archived_by = NULL,
          occasions = COALESCE(_occasions, ARRAY[]::text[]),
          notes = NULLIF(trim(COALESCE(_notes, '')), ''),
          updated_at = now()
      WHERE group_id = _group_id AND place_id = _place_id;
    RETURN _place_id;
  END IF;

  RETURN public.create_place(
    _group_id, _name, _category, _cuisines, _occasions,
    _address, _area, _city, _lat, _lng, _notes, _photo_url
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_or_link_provider_place_v4b(
  _group_id uuid,
  _provider text,
  _provider_place_id text,
  _name text,
  _category text,
  _cuisines text[] DEFAULT '{}',
  _occasions text[] DEFAULT '{}',
  _address text DEFAULT '',
  _area text DEFAULT NULL,
  _city text DEFAULT '',
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _notes text DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _raw jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _collection_status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  SELECT ps.place_id INTO _place_id
  FROM public.place_sources ps
  WHERE ps.provider = lower(trim(_provider))
    AND ps.provider_place_id = trim(_provider_place_id)
  LIMIT 1;

  IF _place_id IS NOT NULL THEN
    SELECT collection_status INTO _collection_status
    FROM public.group_places
    WHERE group_id = _group_id AND place_id = _place_id;

    IF _collection_status = 'archived' THEN
      UPDATE public.group_places
        SET collection_status = 'active',
            archived_at = NULL,
            archived_by = NULL,
            occasions = COALESCE(_occasions, ARRAY[]::text[]),
            notes = NULLIF(trim(COALESCE(_notes, '')), ''),
            updated_at = now()
        WHERE group_id = _group_id AND place_id = _place_id;
      RETURN _place_id;
    ELSIF _collection_status = 'active' THEN
      RETURN _place_id;
    END IF;
  END IF;

  RETURN public.create_or_link_provider_place(
    _group_id, _provider, _provider_place_id, _name, _category,
    _cuisines, _occasions, _address, _area, _city, _lat, _lng,
    _notes, _photo_url, _raw
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_place_v4b(uuid, text, text, text[], text[], text, text, text, double precision, double precision, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_or_link_provider_place_v4b(uuid, text, text, text, text, text[], text[], text, text, text, double precision, double precision, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_place_v4b(uuid, text, text, text[], text[], text, text, text, double precision, double precision, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_link_provider_place_v4b(uuid, text, text, text, text, text[], text[], text, text, text, double precision, double precision, text, text, jsonb) TO authenticated;

COMMIT;
