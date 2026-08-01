BEGIN;

-- v1.10.0: flera providerställen kan läggas till i samma omgång. Varje träff
-- hanteras i en egen subtransaktion så ett fel inte rullar tillbaka lyckade
-- träffar. Kanoniska platser dedupliceras fortsatt med provideridentiteten.
CREATE OR REPLACE FUNCTION public.create_or_link_provider_places_batch_v1(
  _group_id uuid,
  _items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _item jsonb;
  _external_id text;
  _provider text;
  _provider_place_id text;
  _name text;
  _category text;
  _cuisines text[];
  _address text;
  _area text;
  _city text;
  _lat double precision;
  _lng double precision;
  _raw jsonb;
  _place_id uuid;
  _collection_status text;
  _status text;
  _message text;
  _results jsonb := '[]'::jsonb;
  _added integer := 0;
  _restored integer := 0;
  _existing integer := 0;
  _failed integer := 0;
  _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF jsonb_typeof(COALESCE(_items, 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Matställena måste skickas som en lista';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Välj minst ett matställe';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'Högst 50 matställen kan läggas till samtidigt';
  END IF;

  FOR _item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    _external_id := trim(COALESCE(_item->>'externalId', _item->>'providerPlaceId', ''));
    _name := trim(COALESCE(_item->>'name', ''));
    _place_id := NULL;
    _status := NULL;
    _message := NULL;

    BEGIN
      IF jsonb_typeof(_item) <> 'object' THEN
        RAISE EXCEPTION 'Ogiltig sökträff';
      END IF;

      _provider := lower(trim(COALESCE(_item->>'provider', '')));
      _provider_place_id := trim(COALESCE(_item->>'providerPlaceId', ''));
      _category := trim(COALESCE(_item->>'category', ''));
      _address := trim(COALESCE(_item->>'address', ''));
      _area := NULLIF(trim(COALESCE(_item->>'area', '')), '');
      _city := trim(COALESCE(_item->>'city', ''));
      _lat := CASE WHEN _item ? 'lat' THEN (_item->>'lat')::double precision ELSE NULL END;
      _lng := CASE WHEN _item ? 'lng' THEN (_item->>'lng')::double precision ELSE NULL END;
      _raw := COALESCE(_item->'raw', '{}'::jsonb);
      _cuisines := public.normalize_food_tags(
        ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(_item->'cuisines', '[]'::jsonb))
        )
      );

      IF _provider <> 'geoapify' THEN RAISE EXCEPTION 'Okänd platsleverantör'; END IF;
      IF _provider_place_id = '' THEN RAISE EXCEPTION 'Provider-id saknas'; END IF;
      IF _external_id = '' THEN _external_id := _provider_place_id; END IF;
      IF _name = '' THEN RAISE EXCEPTION 'Namn saknas'; END IF;
      IF _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
        RAISE EXCEPTION 'Ogiltig kategori';
      END IF;
      IF cardinality(_cuisines) > 20 THEN
        RAISE EXCEPTION 'Högst 20 val för kök och inriktning kan anges';
      END IF;
      IF (_lat IS NULL) <> (_lng IS NULL) THEN
        RAISE EXCEPTION 'Både latitud och longitud krävs';
      END IF;
      IF _lat IS NOT NULL AND (_lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180) THEN
        RAISE EXCEPTION 'Ogiltig kartposition';
      END IF;

      PERFORM pg_advisory_xact_lock(
        hashtextextended(_provider || ':' || _provider_place_id, 0)
      );

      SELECT ps.place_id INTO _place_id
      FROM public.place_sources ps
      WHERE ps.provider = _provider
        AND ps.provider_place_id = _provider_place_id
      LIMIT 1;

      IF _place_id IS NULL THEN
        INSERT INTO public.places (
          name, category, cuisines, address, area, city, lat, lng, photo_url, added_by
        ) VALUES (
          _name, _category, COALESCE(_cuisines, ARRAY[]::text[]), _address,
          _area, _city, _lat, _lng, NULL, _uid
        )
        RETURNING id INTO _place_id;

        INSERT INTO public.place_sources (
          place_id, provider, provider_place_id, raw
        ) VALUES (
          _place_id, _provider, _provider_place_id, _raw
        );

        INSERT INTO public.group_places (
          group_id, place_id, occasions, notes, added_by, origin
        ) VALUES (
          _group_id, _place_id, ARRAY[]::text[], NULL, _uid, 'provider'
        );

        _status := 'added';
        _added := _added + 1;
      ELSE
        SELECT gp.collection_status INTO _collection_status
        FROM public.group_places gp
        WHERE gp.group_id = _group_id AND gp.place_id = _place_id;

        IF _collection_status = 'active' THEN
          _status := 'existing';
          _existing := _existing + 1;
        ELSIF _collection_status = 'archived' THEN
          UPDATE public.group_places
          SET collection_status = 'active',
              archived_at = NULL,
              archived_by = NULL,
              updated_at = now()
          WHERE group_id = _group_id AND place_id = _place_id;

          _status := 'restored';
          _restored := _restored + 1;
        ELSE
          INSERT INTO public.group_places (
            group_id, place_id, occasions, notes, added_by, origin
          ) VALUES (
            _group_id, _place_id, ARRAY[]::text[], NULL, _uid, 'provider'
          );

          _status := 'added';
          _added := _added + 1;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      _status := 'failed';
      _message := SQLERRM;
      _failed := _failed + 1;
    END;

    _results := _results || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'externalId', COALESCE(NULLIF(_external_id, ''), 'unknown'),
          'name', COALESCE(_name, ''),
          'status', _status,
          'placeId', _place_id,
          'message', _message
        )
      )
    );
  END LOOP;

  IF _added + _restored > 0 THEN
    SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
    INSERT INTO public.activity (group_id, kind, actor_id, payload)
    VALUES (
      _group_id,
      'added',
      _uid,
      jsonb_build_object(
        'text', COALESCE(_actor_name, 'Någon') || ' la till ' ||
          (_added + _restored)::text ||
          CASE WHEN _added + _restored = 1 THEN ' ställe' ELSE ' ställen' END,
        'bulk', true,
        'count', _added + _restored,
        'restoredCount', _restored
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'items', _results,
    'added', _added,
    'restored', _restored,
    'existing', _existing,
    'failed', _failed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_or_link_provider_places_batch_v1(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_link_provider_places_batch_v1(uuid, jsonb)
  TO authenticated, service_role;

-- Gruppuppgifter är icke-destruktiva och får underhållas av alla aktiva
-- medlemmar. Borttagning och återställning fortsätter genom separata admin-RPC:er.
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
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
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
  IF COALESCE(cardinality(_occasions), 0) > 2 THEN
    RAISE EXCEPTION 'Högst två val för Passar för kan anges';
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

REVOKE ALL ON FUNCTION public.update_group_place_metadata(
  uuid, uuid, text, text[], text[], text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_place_metadata(
  uuid, uuid, text, text[], text[], text
) TO authenticated, service_role;

COMMIT;
