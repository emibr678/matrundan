
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
  _existing_group_link boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _provider IS NULL OR length(trim(_provider)) = 0 THEN
    RAISE EXCEPTION 'Provider krävs';
  END IF;
  IF _provider_place_id IS NULL OR length(trim(_provider_place_id)) = 0 THEN
    RAISE EXCEPTION 'Provider place-id krävs';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Namn krävs';
  END IF;
  IF _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;

  -- 1. Har vi redan sett detta externa ställe?
  SELECT ps.place_id INTO _pid
    FROM public.place_sources ps
   WHERE ps.provider = _provider
     AND ps.provider_place_id = _provider_place_id
   LIMIT 1;

  IF _pid IS NULL THEN
    -- 2. Skapa nytt kanoniskt ställe + place_sources-rad
    INSERT INTO public.places (name, category, cuisines, address, area, city, lat, lng, photo_url, added_by)
    VALUES (
      trim(_name), _category,
      coalesce(_cuisines,'{}'::text[]),
      coalesce(trim(_address),''),
      _area,
      coalesce(trim(_city),''),
      _lat, _lng, _photo_url, _uid
    )
    RETURNING id INTO _pid;

    INSERT INTO public.place_sources (place_id, provider, provider_place_id, raw)
    VALUES (_pid, _provider, _provider_place_id, coalesce(_raw, '{}'::jsonb));
  END IF;

  -- 3. Länka in i gruppen om det inte redan finns
  SELECT true INTO _existing_group_link
    FROM public.group_places
   WHERE group_id = _group_id AND place_id = _pid;

  IF _existing_group_link IS NULL THEN
    INSERT INTO public.group_places (group_id, place_id, occasions, notes, added_by, origin)
    VALUES (_group_id, _pid, coalesce(_occasions,'{}'::text[]), _notes, _uid, 'provider');

    SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
    INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
    VALUES (
      _group_id, 'added', _uid, _pid,
      jsonb_build_object('text', coalesce(_actor_name,'Någon') || ' la till ' || trim(_name))
    );
  END IF;

  RETURN _pid;
END $$;

REVOKE ALL ON FUNCTION public.create_or_link_provider_place(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_or_link_provider_place(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) TO authenticated;
