
-- Klienten skapar inte längre aktivitetsrader direkt. RPC:erna nedan är enda vägen in.
REVOKE INSERT ON public.activity FROM authenticated;

-- ============================================================
-- create_place
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_place(
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
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _norm_name text;
  _norm_addr text;
  _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Namn krävs';
  END IF;
  IF _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;

  _norm_name := lower(trim(_name));
  _norm_addr := lower(trim(coalesce(_address,'')));

  SELECT id INTO _pid FROM public.places
  WHERE group_id = _group_id
    AND lower(trim(name)) = _norm_name
    AND lower(trim(coalesce(address,''))) = _norm_addr
  LIMIT 1;
  IF _pid IS NOT NULL THEN
    RAISE EXCEPTION 'Ett ställe med samma namn och adress finns redan i gruppen'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.places (
    group_id, name, category, cuisines, occasions,
    address, area, city, lat, lng, notes, photo_url, added_by
  ) VALUES (
    _group_id, trim(_name), _category,
    coalesce(_cuisines, ARRAY[]::text[]),
    coalesce(_occasions, ARRAY[]::text[]),
    coalesce(trim(_address), ''), _area,
    coalesce(trim(_city), ''), _lat, _lng, _notes, _photo_url, _uid
  ) RETURNING id INTO _pid;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;

  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (
    _group_id, 'added', _uid, _pid,
    jsonb_build_object('text', coalesce(_actor_name, 'Någon') || ' la till ' || trim(_name))
  );

  RETURN _pid;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_place(uuid, text, text, text[], text[], text, text, text, double precision, double precision, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_place(uuid, text, text, text[], text[], text, text, text, double precision, double precision, text, text) TO authenticated;

-- ============================================================
-- create_visit_with_review
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_visit_with_review(
  _group_id uuid,
  _place_id uuid,
  _visited_on date,
  _meal_type text,
  _participant_ids uuid[],
  _overall smallint,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _comment text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _vid uuid;
  _place_group uuid;
  _place_name text;
  _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  SELECT group_id, name INTO _place_group, _place_name
    FROM public.places WHERE id = _place_id;
  IF _place_group IS NULL OR _place_group <> _group_id THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;
  IF _meal_type NOT IN ('frukost','lunch','fika','middag','kväll') THEN
    RAISE EXCEPTION 'Ogiltigt tillfälle';
  END IF;
  IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
    RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5';
  END IF;
  IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN RAISE EXCEPTION 'Smakbetyg 1–5'; END IF;
  IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN RAISE EXCEPTION 'Prisvärdhet 1–5'; END IF;
  IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN RAISE EXCEPTION 'Service 1–5'; END IF;

  INSERT INTO public.visits (group_id, place_id, visited_on, meal_type, created_by)
  VALUES (_group_id, _place_id, _visited_on, _meal_type, _uid)
  RETURNING id INTO _vid;

  -- Deltagare: dedupera, säkerställ att aktören alltid är med, och släng bort icke-medlemmar.
  INSERT INTO public.visit_participants (visit_id, user_id)
  SELECT _vid, uid
  FROM (
    SELECT DISTINCT unnest(coalesce(_participant_ids, ARRAY[]::uuid[]) || ARRAY[_uid]::uuid[]) AS uid
  ) x
  WHERE public.has_membership(_group_id, x.uid);

  INSERT INTO public.reviews (
    visit_id, group_id, place_id, user_id,
    overall, taste, value, service, comment
  ) VALUES (
    _vid, _group_id, _place_id, _uid,
    _overall, _taste, _value, _service, _comment
  );

  DELETE FROM public.group_next_place
   WHERE group_id = _group_id AND place_id = _place_id;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, visit_id, payload)
  VALUES (
    _group_id, 'visited', _uid, _place_id, _vid,
    jsonb_build_object(
      'text', coalesce(_actor_name, 'Någon') || ' registrerade ett besök på ' || coalesce(_place_name, 'ett ställe')
    )
  );

  RETURN _vid;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_visit_with_review(uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit_with_review(uuid, uuid, date, text, uuid[], smallint, smallint, smallint, smallint, text) TO authenticated;

-- ============================================================
-- toggle_favorite
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_favorite(_group_id uuid, _place_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _place_group uuid;
  _place_name text;
  _actor_name text;
  _deleted int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  SELECT group_id, name INTO _place_group, _place_name
    FROM public.places WHERE id = _place_id;
  IF _place_group IS NULL OR _place_group <> _group_id THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;

  DELETE FROM public.favorites
   WHERE user_id = _uid AND place_id = _place_id;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  IF _deleted > 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.favorites (user_id, place_id, group_id)
  VALUES (_uid, _place_id, _group_id);

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (
    _group_id, 'favorited', _uid, _place_id,
    jsonb_build_object(
      'text', coalesce(_actor_name, 'Någon') || ' favoritmarkerade ' || coalesce(_place_name, 'ett ställe')
    )
  );
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.toggle_favorite(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(uuid, uuid) TO authenticated;

-- ============================================================
-- set_next_place
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_next_place(_group_id uuid, _place_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _place_group uuid;
  _place_name text;
  _current uuid;
  _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  IF _place_id IS NULL THEN
    DELETE FROM public.group_next_place WHERE group_id = _group_id;
    RETURN;
  END IF;

  SELECT group_id, name INTO _place_group, _place_name
    FROM public.places WHERE id = _place_id;
  IF _place_group IS NULL OR _place_group <> _group_id THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;

  SELECT place_id INTO _current FROM public.group_next_place WHERE group_id = _group_id;
  IF _current IS NOT DISTINCT FROM _place_id THEN
    RETURN;
  END IF;

  INSERT INTO public.group_next_place (group_id, place_id, selected_by, selected_at)
  VALUES (_group_id, _place_id, _uid, now())
  ON CONFLICT (group_id) DO UPDATE
    SET place_id = EXCLUDED.place_id,
        selected_by = EXCLUDED.selected_by,
        selected_at = EXCLUDED.selected_at;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (
    _group_id, 'next-picked', _uid, _place_id,
    jsonb_build_object(
      'text', coalesce(_actor_name, 'Någon') || ' valde ' || coalesce(_place_name, 'ett ställe') || ' som nästa stopp'
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_next_place(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_next_place(uuid, uuid) TO authenticated;
