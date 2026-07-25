-- Paket 3C: robust canonical provider linking without fuzzy matching.
-- Serializes concurrent attempts for the same provider id, preserves existing
-- group-specific fields, and returns a clear error when already linked.

CREATE OR REPLACE FUNCTION public.create_or_link_provider_place(
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
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _actor_name text;
  _provider_normalized text := lower(trim(_provider));
  _provider_id_normalized text := trim(_provider_place_id);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _provider_normalized = '' OR _provider_id_normalized = '' THEN
    RAISE EXCEPTION 'Provider och provider-id krävs';
  END IF;
  IF _provider_normalized <> 'geoapify' THEN
    RAISE EXCEPTION 'Okänd platsleverantör';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Namn krävs';
  END IF;
  IF _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;

  -- Prevent two concurrent requests from creating two canonical rows.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_provider_normalized || ':' || _provider_id_normalized, 0)
  );

  SELECT ps.place_id INTO _pid
  FROM public.place_sources ps
  WHERE ps.provider = _provider_normalized
    AND ps.provider_place_id = _provider_id_normalized
  LIMIT 1;

  IF _pid IS NULL THEN
    INSERT INTO public.places (
      name, category, cuisines, address, area, city, lat, lng, photo_url, added_by
    ) VALUES (
      trim(_name), _category, coalesce(_cuisines, '{}'),
      coalesce(trim(_address), ''), nullif(trim(coalesce(_area, '')), ''),
      coalesce(trim(_city), ''), _lat, _lng, _photo_url, _uid
    ) RETURNING id INTO _pid;

    INSERT INTO public.place_sources (
      place_id, provider, provider_place_id, raw
    ) VALUES (
      _pid, _provider_normalized, _provider_id_normalized, coalesce(_raw, '{}'::jsonb)
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_places
    WHERE group_id = _group_id AND place_id = _pid
  ) THEN
    RAISE EXCEPTION 'Matstället finns redan i den här gruppen';
  END IF;

  INSERT INTO public.group_places (
    group_id, place_id, occasions, notes, added_by, origin
  ) VALUES (
    _group_id, _pid, coalesce(_occasions, '{}'),
    nullif(trim(coalesce(_notes, '')), ''), _uid, 'provider'
  );

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (
    _group_id, 'added', _uid, _pid,
    jsonb_build_object(
      'text', coalesce(_actor_name, 'Någon') || ' la till ' || trim(_name),
      'provider', _provider_normalized
    )
  );

  RETURN _pid;
END $$;

REVOKE ALL ON FUNCTION public.create_or_link_provider_place(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_link_provider_place(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) TO authenticated;
