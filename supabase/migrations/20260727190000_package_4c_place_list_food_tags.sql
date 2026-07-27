BEGIN;

-- Paket 4C: naturligt ta-bort/återlägg-flöde och normaliserade etiketter
-- för kök och inriktning. Befintlig historik och gruppmetadata bevaras.

CREATE OR REPLACE FUNCTION public.normalize_food_tags(_values text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _value text;
  _token text;
  _normalized text;
  _result text[] := ARRAY[]::text[];
BEGIN
  FOREACH _value IN ARRAY COALESCE(_values, ARRAY[]::text[])
  LOOP
    _value := trim(COALESCE(_value, ''));
    CONTINUE WHEN _value = '';

    _token := regexp_replace(lower(_value), '[[:space:]-]+', '_', 'g');
    _normalized := CASE _token
      WHEN 'swedish' THEN 'Svenskt/nordiskt'
      WHEN 'scandinavian' THEN 'Svenskt/nordiskt'
      WHEN 'nordic' THEN 'Svenskt/nordiskt'
      WHEN 'svenskt' THEN 'Svenskt/nordiskt'
      WHEN 'nordiskt' THEN 'Svenskt/nordiskt'
      WHEN 'italian' THEN 'Italienskt'
      WHEN 'italienskt' THEN 'Italienskt'
      WHEN 'japanese' THEN 'Japanskt'
      WHEN 'japanskt' THEN 'Japanskt'
      WHEN 'korean' THEN 'Koreanskt'
      WHEN 'koreanskt' THEN 'Koreanskt'
      WHEN 'chinese' THEN 'Kinesiskt'
      WHEN 'kinesiskt' THEN 'Kinesiskt'
      WHEN 'thai' THEN 'Thailändskt'
      WHEN 'thailändskt' THEN 'Thailändskt'
      WHEN 'vietnamese' THEN 'Vietnamesiskt'
      WHEN 'vietnamesiskt' THEN 'Vietnamesiskt'
      WHEN 'indian' THEN 'Indiskt'
      WHEN 'indiskt' THEN 'Indiskt'
      WHEN 'middle_eastern' THEN 'Mellanöstern'
      WHEN 'lebanese' THEN 'Mellanöstern'
      WHEN 'arab' THEN 'Mellanöstern'
      WHEN 'arabic' THEN 'Mellanöstern'
      WHEN 'turkish' THEN 'Mellanöstern'
      WHEN 'mellanöstern' THEN 'Mellanöstern'
      WHEN 'mexican' THEN 'Mexikanskt/latinamerikanskt'
      WHEN 'latin_american' THEN 'Mexikanskt/latinamerikanskt'
      WHEN 'mexikanskt' THEN 'Mexikanskt/latinamerikanskt'
      WHEN 'latinamerikanskt' THEN 'Mexikanskt/latinamerikanskt'
      WHEN 'mediterranean' THEN 'Medelhavsmat'
      WHEN 'medelhavsmat' THEN 'Medelhavsmat'
      WHEN 'greek' THEN 'Grekiskt'
      WHEN 'grekiskt' THEN 'Grekiskt'
      WHEN 'french' THEN 'Franskt'
      WHEN 'franskt' THEN 'Franskt'
      WHEN 'spanish' THEN 'Spanskt'
      WHEN 'spanskt' THEN 'Spanskt'
      WHEN 'american' THEN 'Amerikanskt'
      WHEN 'amerikanskt' THEN 'Amerikanskt'
      WHEN 'persian' THEN 'Persiskt'
      WHEN 'iranian' THEN 'Persiskt'
      WHEN 'persiskt' THEN 'Persiskt'
      WHEN 'international' THEN 'Internationellt'
      WHEN 'internationellt' THEN 'Internationellt'
      WHEN 'vegetarian' THEN 'Vegetariskt/veganskt'
      WHEN 'vegan' THEN 'Vegetariskt/veganskt'
      WHEN 'vegetariskt' THEN 'Vegetariskt/veganskt'
      WHEN 'veganskt' THEN 'Vegetariskt/veganskt'
      WHEN 'sushi' THEN 'Sushi'
      WHEN 'ramen' THEN 'Ramen'
      WHEN 'pizza' THEN 'Pizza'
      WHEN 'pizzeria' THEN 'Pizza'
      WHEN 'burger' THEN 'Burgare'
      WHEN 'burgers' THEN 'Burgare'
      WHEN 'burgare' THEN 'Burgare'
      WHEN 'grill' THEN 'Grillat'
      WHEN 'grilled' THEN 'Grillat'
      WHEN 'barbecue' THEN 'Grillat'
      WHEN 'bbq' THEN 'Grillat'
      WHEN 'grillat' THEN 'Grillat'
      WHEN 'tapas' THEN 'Tapas'
      WHEN 'seafood' THEN 'Fisk och skaldjur'
      WHEN 'fish' THEN 'Fisk och skaldjur'
      WHEN 'fisk' THEN 'Fisk och skaldjur'
      WHEN 'skaldjur' THEN 'Fisk och skaldjur'
      WHEN 'bowl' THEN 'Bowl'
      WHEN 'poke' THEN 'Bowl'
      WHEN 'poke_bowl' THEN 'Bowl'
      WHEN 'pasta' THEN 'Pasta'
      WHEN 'falafel' THEN 'Falafel'
      WHEN 'street_food' THEN 'Street food'
      WHEN 'husmanskost' THEN 'Husmanskost'
      WHEN 'home_cooking' THEN 'Husmanskost'
      WHEN 'small_plates' THEN 'Smårätter'
      WHEN 'smårätter' THEN 'Smårätter'
      WHEN 'pub_food' THEN 'Pubmat'
      WHEN 'pubmat' THEN 'Pubmat'
      WHEN 'fika' THEN 'Fika'
      WHEN 'coffee' THEN 'Kaffe'
      WHEN 'kaffe' THEN 'Kaffe'
      WHEN 'pastry' THEN 'Bakverk'
      WHEN 'pastries' THEN 'Bakverk'
      WHEN 'bakverk' THEN 'Bakverk'
      WHEN 'sourdough' THEN 'Surdeg'
      WHEN 'surdeg' THEN 'Surdeg'
      WHEN 'danish' THEN 'Wienerbröd'
      WHEN 'danish_pastry' THEN 'Wienerbröd'
      WHEN 'wienerbröd' THEN 'Wienerbröd'
      ELSE _value
    END;

    IF NOT (_normalized = ANY(_result)) THEN
      _result := array_append(_result, _normalized);
    END IF;
  END LOOP;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_food_tags(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_food_tags(text[]) TO authenticated, service_role;

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

  DELETE FROM public.group_next_place
    WHERE group_id = _group_id AND place_id = _place_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_group_place(_group_id uuid, _place_id uuid)
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
    RAISE EXCEPTION 'Endast ägare eller admin kan lägga tillbaka matställen i gruppen';
  END IF;

  UPDATE public.group_places
    SET collection_status = 'active',
        archived_at = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE group_id = _group_id AND place_id = _place_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte i gruppen'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_group_place_metadata(
  _group_id uuid,
  _place_id uuid,
  _category_override text DEFAULT NULL,
  _cuisines_override text[] DEFAULT NULL,
  _occasions text[] DEFAULT '{}',
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _occasion text;
  _normalized_cuisines text[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ändra matställets gruppuppgifter';
  END IF;

  IF _category_override IS NOT NULL
     AND _category_override NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;

  _normalized_cuisines := CASE
    WHEN _cuisines_override IS NULL THEN NULL
    ELSE public.normalize_food_tags(_cuisines_override)
  END;

  IF COALESCE(cardinality(_normalized_cuisines), 0) > 20 THEN
    RAISE EXCEPTION 'Högst 20 val för kök och inriktning kan anges';
  END IF;

  FOREACH _occasion IN ARRAY COALESCE(_occasions, ARRAY[]::text[])
  LOOP
    IF _occasion NOT IN ('snabbt','avslappnat','middag') THEN
      RAISE EXCEPTION 'Ogiltig etikett för Passar för';
    END IF;
  END LOOP;

  UPDATE public.group_places
    SET category_override = _category_override,
        cuisines_override = _normalized_cuisines,
        occasions = COALESCE(_occasions, ARRAY[]::text[]),
        notes = NULLIF(trim(COALESCE(_notes, '')), ''),
        updated_at = now()
    WHERE group_id = _group_id AND place_id = _place_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte i gruppen'; END IF;
END;
$function$;

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
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  _group_id := NULLIF(to_jsonb(NEW)->>'group_id', '')::uuid;
  _place_id := NULLIF(to_jsonb(NEW)->>'place_id', '')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_places gp
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte längre i gruppens lista';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_original_visit_active_place()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _place_id uuid;
BEGIN
  IF NEW.link_type <> 'original' THEN RETURN NEW; END IF;

  SELECT place_id INTO _place_id FROM public.visits WHERE id = NEW.visit_id;
  IF _place_id IS NULL THEN RAISE EXCEPTION 'Besöket finns inte'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_places gp
    WHERE gp.group_id = NEW.group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte längre i gruppens lista';
  END IF;

  RETURN NEW;
END;
$function$;

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
          updated_at = now()
      WHERE group_id = _group_id AND place_id = _place_id;
    RETURN _place_id;
  END IF;

  RETURN public.create_place(
    _group_id, _name, _category, public.normalize_food_tags(_cuisines), _occasions,
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
            updated_at = now()
        WHERE group_id = _group_id AND place_id = _place_id;
      RETURN _place_id;
    ELSIF _collection_status = 'active' THEN
      RETURN _place_id;
    END IF;
  END IF;

  RETURN public.create_or_link_provider_place(
    _group_id, _provider, _provider_place_id, _name, _category,
    public.normalize_food_tags(_cuisines), _occasions, _address, _area, _city, _lat, _lng,
    _notes, _photo_url, _raw
  );
END;
$function$;

COMMIT;
