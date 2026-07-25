
BEGIN;

CREATE TABLE public.group_places (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  occasions text[] NOT NULL DEFAULT '{}'::text[],
  notes text,
  added_by uuid NOT NULL,
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','shared_visit','provider')),
  source_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, place_id)
);
GRANT SELECT ON public.group_places TO authenticated;
GRANT ALL ON public.group_places TO service_role;
ALTER TABLE public.group_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_places members read" ON public.group_places
  FOR SELECT TO authenticated USING (public.has_membership(group_id, auth.uid()));
CREATE INDEX idx_group_places_place ON public.group_places(place_id);
CREATE TRIGGER trg_group_places_updated_at BEFORE UPDATE ON public.group_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.visit_group_links (
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN ('original','shared')),
  linked_by uuid NOT NULL,
  source_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, group_id)
);
GRANT SELECT ON public.visit_group_links TO authenticated;
GRANT ALL ON public.visit_group_links TO service_role;
ALTER TABLE public.visit_group_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visit_group_links members read" ON public.visit_group_links
  FOR SELECT TO authenticated USING (public.has_membership(group_id, auth.uid()));
CREATE UNIQUE INDEX visit_group_links_one_original
  ON public.visit_group_links(visit_id) WHERE link_type = 'original';
CREATE INDEX idx_vgl_group ON public.visit_group_links(group_id);

CREATE TABLE public.review_group_visibility (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  rating_visible boolean NOT NULL DEFAULT true,
  comment_visible boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, group_id)
);
GRANT SELECT ON public.review_group_visibility TO authenticated;
GRANT ALL ON public.review_group_visibility TO service_role;
ALTER TABLE public.review_group_visibility ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_rgv_updated_at BEFORE UPDATE ON public.review_group_visibility
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.groups
  ADD COLUMN shared_visits_count_for_progression boolean NOT NULL DEFAULT true;

-- Backfill
INSERT INTO public.group_places (group_id, place_id, occasions, notes, added_by, origin, created_at)
SELECT p.group_id, p.id, p.occasions, p.notes, p.added_by, 'manual', p.created_at FROM public.places p;

INSERT INTO public.visit_group_links (visit_id, group_id, link_type, linked_by, linked_at)
SELECT v.id, v.group_id, 'original', v.created_by, v.created_at FROM public.visits v;

INSERT INTO public.review_group_visibility (review_id, group_id, rating_visible, comment_visible)
SELECT r.id, r.group_id, true, true FROM public.reviews r;

DO $$
DECLARE a int; b int;
BEGIN
  SELECT count(*) INTO a FROM public.places; SELECT count(*) INTO b FROM public.group_places;
  IF a <> b THEN RAISE EXCEPTION 'places backfill %/%',a,b; END IF;
  SELECT count(*) INTO a FROM public.visits; SELECT count(*) INTO b FROM public.visit_group_links;
  IF a <> b THEN RAISE EXCEPTION 'visits backfill %/%',a,b; END IF;
  SELECT count(*) INTO a FROM public.reviews; SELECT count(*) INTO b FROM public.review_group_visibility;
  IF a <> b THEN RAISE EXCEPTION 'reviews backfill %/%',a,b; END IF;
END $$;

-- Places: drop legacy policies/triggers/columns
DROP POLICY IF EXISTS "places creator or admin delete" ON public.places;
DROP POLICY IF EXISTS "places creator or admin update" ON public.places;
DROP POLICY IF EXISTS "places members insert" ON public.places;
DROP POLICY IF EXISTS "places members read" ON public.places;
DROP TRIGGER IF EXISTS trg_places_immutable ON public.places;
DROP FUNCTION IF EXISTS public.places_immutable_cols() CASCADE;
ALTER TABLE public.places DROP COLUMN IF EXISTS group_id CASCADE;
ALTER TABLE public.places DROP COLUMN IF EXISTS occasions;
ALTER TABLE public.places DROP COLUMN IF EXISTS notes;
REVOKE ALL ON public.places FROM anon, authenticated;
GRANT ALL ON public.places TO service_role;
GRANT SELECT ON public.places TO authenticated;
CREATE POLICY "places readable via group_places" ON public.places
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.group_places gp
    WHERE gp.place_id = places.id AND public.has_membership(gp.group_id, auth.uid())
  ));

-- Visits
DROP POLICY IF EXISTS "visits creator or admin delete" ON public.visits;
DROP POLICY IF EXISTS "visits creator or admin update" ON public.visits;
DROP POLICY IF EXISTS "visits members insert" ON public.visits;
DROP POLICY IF EXISTS "visits members read" ON public.visits;
DROP TRIGGER IF EXISTS trg_visits_immutable ON public.visits;
DROP FUNCTION IF EXISTS public.visits_immutable_cols() CASCADE;
ALTER TABLE public.visits DROP COLUMN IF EXISTS group_id CASCADE;
REVOKE ALL ON public.visits FROM anon, authenticated;
GRANT ALL ON public.visits TO service_role;

-- Reviews
DROP POLICY IF EXISTS "reviews members read" ON public.reviews;
DROP POLICY IF EXISTS "reviews self delete" ON public.reviews;
DROP POLICY IF EXISTS "reviews self insert" ON public.reviews;
DROP POLICY IF EXISTS "reviews self update" ON public.reviews;
DROP TRIGGER IF EXISTS trg_reviews_immutable ON public.reviews;
DROP FUNCTION IF EXISTS public.reviews_immutable_cols() CASCADE;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS group_id CASCADE;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS place_id CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_visit_user_uniq ON public.reviews(visit_id, user_id);
REVOKE ALL ON public.reviews FROM anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

-- visit_participants
DROP POLICY IF EXISTS "visit_participants creator delete" ON public.visit_participants;
DROP POLICY IF EXISTS "visit_participants creator write" ON public.visit_participants;
DROP POLICY IF EXISTS "visit_participants read" ON public.visit_participants;
REVOKE ALL ON public.visit_participants FROM anon, authenticated;
GRANT ALL ON public.visit_participants TO service_role;

-- place_sources
DROP POLICY IF EXISTS "place_sources admin delete" ON public.place_sources;
DROP POLICY IF EXISTS "place_sources admin update" ON public.place_sources;
DROP POLICY IF EXISTS "place_sources members read" ON public.place_sources;
DROP POLICY IF EXISTS "place_sources members write" ON public.place_sources;
DROP TRIGGER IF EXISTS trg_place_sources_immutable ON public.place_sources;
DROP FUNCTION IF EXISTS public.place_sources_immutable_cols() CASCADE;
ALTER TABLE public.place_sources DROP COLUMN IF EXISTS group_id CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS place_sources_provider_uniq
  ON public.place_sources(provider, provider_place_id);
REVOKE ALL ON public.place_sources FROM anon, authenticated;
GRANT ALL ON public.place_sources TO service_role;

-- Activity refs validation against new model
DROP TRIGGER IF EXISTS trg_activity_validate_refs ON public.activity;
CREATE OR REPLACE FUNCTION public.validate_activity_refs()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.place_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.group_places
                  WHERE place_id = NEW.place_id AND group_id = NEW.group_id) THEN
      RAISE EXCEPTION 'activity.place_id % not linked to group %', NEW.place_id, NEW.group_id;
    END IF;
  END IF;
  IF NEW.visit_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.visit_group_links
                  WHERE visit_id = NEW.visit_id AND group_id = NEW.group_id) THEN
      RAISE EXCEPTION 'activity.visit_id % not linked to group %', NEW.visit_id, NEW.group_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_activity_validate_refs BEFORE INSERT OR UPDATE ON public.activity
  FOR EACH ROW EXECUTE FUNCTION public.validate_activity_refs();

-- Rewrite write RPCs
CREATE OR REPLACE FUNCTION public.create_place(
  _group_id uuid, _name text, _category text,
  _cuisines text[] DEFAULT '{}', _occasions text[] DEFAULT '{}',
  _address text DEFAULT '', _area text DEFAULT NULL,
  _city text DEFAULT '', _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL,
  _notes text DEFAULT NULL, _photo_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _pid uuid; _norm_name text; _norm_addr text; _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Namn krävs'; END IF;
  IF _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;
  _norm_name := lower(trim(_name));
  _norm_addr := lower(trim(coalesce(_address,'')));
  SELECT p.id INTO _pid FROM public.group_places gp
    JOIN public.places p ON p.id = gp.place_id
   WHERE gp.group_id = _group_id
     AND lower(trim(p.name)) = _norm_name
     AND lower(trim(coalesce(p.address,''))) = _norm_addr
   LIMIT 1;
  IF _pid IS NOT NULL THEN
    RAISE EXCEPTION 'Ett ställe med samma namn och adress finns redan i gruppen'
      USING ERRCODE = 'unique_violation';
  END IF;
  INSERT INTO public.places (name, category, cuisines, address, area, city, lat, lng, photo_url, added_by)
  VALUES (trim(_name), _category, coalesce(_cuisines,'{}'::text[]),
          coalesce(trim(_address),''), _area, coalesce(trim(_city),''),
          _lat, _lng, _photo_url, _uid)
  RETURNING id INTO _pid;
  INSERT INTO public.group_places (group_id, place_id, occasions, notes, added_by, origin)
  VALUES (_group_id, _pid, coalesce(_occasions,'{}'::text[]), _notes, _uid, 'manual');
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (_group_id, 'added', _uid, _pid,
    jsonb_build_object('text', coalesce(_actor_name,'Någon') || ' la till ' || trim(_name)));
  RETURN _pid;
END $$;

CREATE OR REPLACE FUNCTION public.create_visit_with_review(
  _group_id uuid, _place_id uuid, _visited_on date, _meal_type text,
  _participant_ids uuid[], _overall smallint,
  _taste smallint DEFAULT NULL, _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL, _comment text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _vid uuid; _rid uuid; _place_name text; _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.group_places WHERE group_id = _group_id AND place_id = _place_id) THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;
  IF _meal_type NOT IN ('frukost','lunch','fika','middag','kväll') THEN RAISE EXCEPTION 'Ogiltigt tillfälle'; END IF;
  IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5'; END IF;
  IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN RAISE EXCEPTION 'Smakbetyg 1–5'; END IF;
  IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN RAISE EXCEPTION 'Prisvärdhet 1–5'; END IF;
  IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN RAISE EXCEPTION 'Service 1–5'; END IF;

  SELECT name INTO _place_name FROM public.places WHERE id = _place_id;

  INSERT INTO public.visits (place_id, visited_on, meal_type, created_by)
  VALUES (_place_id, _visited_on, _meal_type, _uid) RETURNING id INTO _vid;

  INSERT INTO public.visit_group_links (visit_id, group_id, link_type, linked_by)
  VALUES (_vid, _group_id, 'original', _uid);

  INSERT INTO public.visit_participants (visit_id, user_id)
  SELECT _vid, uid FROM (
    SELECT DISTINCT unnest(coalesce(_participant_ids, ARRAY[]::uuid[]) || ARRAY[_uid]) AS uid
  ) x WHERE public.has_membership(_group_id, x.uid);

  INSERT INTO public.reviews (visit_id, user_id, overall, taste, value, service, comment)
  VALUES (_vid, _uid, _overall, _taste, _value, _service, _comment) RETURNING id INTO _rid;

  INSERT INTO public.review_group_visibility (review_id, group_id, rating_visible, comment_visible)
  VALUES (_rid, _group_id, true, true);

  DELETE FROM public.group_next_place WHERE group_id = _group_id AND place_id = _place_id;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, visit_id, payload)
  VALUES (_group_id, 'visited', _uid, _place_id, _vid,
    jsonb_build_object('text',
      coalesce(_actor_name,'Någon') || ' registrerade ett besök på ' || coalesce(_place_name,'ett ställe')));
  RETURN _vid;
END $$;

CREATE OR REPLACE FUNCTION public.toggle_favorite(_group_id uuid, _place_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _place_name text; _actor_name text; _deleted int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.group_places WHERE group_id = _group_id AND place_id = _place_id) THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;
  DELETE FROM public.favorites WHERE user_id = _uid AND place_id = _place_id AND group_id = _group_id;
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  IF _deleted > 0 THEN RETURN false; END IF;
  INSERT INTO public.favorites (user_id, place_id, group_id) VALUES (_uid, _place_id, _group_id);
  SELECT name INTO _place_name FROM public.places WHERE id = _place_id;
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (_group_id, 'favorited', _uid, _place_id,
    jsonb_build_object('text',
      coalesce(_actor_name,'Någon') || ' favoritmarkerade ' || coalesce(_place_name,'ett ställe')));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.set_next_place(_group_id uuid, _place_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _place_name text; _current uuid; _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;
  IF _place_id IS NULL THEN
    DELETE FROM public.group_next_place WHERE group_id = _group_id; RETURN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.group_places WHERE group_id = _group_id AND place_id = _place_id) THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;
  SELECT place_id INTO _current FROM public.group_next_place WHERE group_id = _group_id;
  IF _current IS NOT DISTINCT FROM _place_id THEN RETURN; END IF;
  INSERT INTO public.group_next_place (group_id, place_id, selected_by, selected_at)
  VALUES (_group_id, _place_id, _uid, now())
  ON CONFLICT (group_id) DO UPDATE
    SET place_id = EXCLUDED.place_id, selected_by = EXCLUDED.selected_by, selected_at = EXCLUDED.selected_at;
  SELECT name INTO _place_name FROM public.places WHERE id = _place_id;
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (_group_id, 'next-picked', _uid, _place_id,
    jsonb_build_object('text',
      coalesce(_actor_name,'Någon') || ' valde ' || coalesce(_place_name,'ett ställe') || ' som nästa stopp'));
END $$;

CREATE OR REPLACE FUNCTION public.update_group_settings(
  _group_id uuid, _name text, _emoji text DEFAULT NULL,
  _home_label text DEFAULT NULL,
  _shared_visits_count_for_progression boolean DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _n text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ändra gruppens inställningar';
  END IF;
  _n := trim(coalesce(_name,''));
  IF length(_n) < 2 OR length(_n) > 60 THEN RAISE EXCEPTION 'Gruppnamnet måste vara 2–60 tecken'; END IF;
  UPDATE public.groups SET
    name = _n,
    emoji = NULLIF(trim(coalesce(_emoji,'')),''),
    home_location_label = NULLIF(trim(coalesce(_home_label,'')),''),
    shared_visits_count_for_progression = COALESCE(_shared_visits_count_for_progression, shared_visits_count_for_progression),
    updated_at = now()
  WHERE id = _group_id;
END $$;

-- Secure read RPC
CREATE OR REPLACE FUNCTION public.get_group_app_state(_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Not a member of group';
  END IF;

  WITH
  grp AS (
    SELECT g.*,
      (SELECT user_id FROM public.memberships
        WHERE group_id = g.id AND role='owner' AND status='active' LIMIT 1) AS owner_id
    FROM public.groups g WHERE g.id = _group_id
  ),
  members AS (
    SELECT m.user_id, m.role, p.display_name, p.avatar_url, p.avatar_emoji
    FROM public.memberships m LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.group_id = _group_id AND m.status='active'
  ),
  places_agg AS (
    SELECT gp.place_id, p.name, p.category, p.cuisines, p.address, p.area, p.city,
           p.lat, p.lng, p.photo_url,
           gp.occasions, gp.notes, gp.added_by, gp.origin, gp.created_at AS linked_at
    FROM public.group_places gp JOIN public.places p ON p.id = gp.place_id
    WHERE gp.group_id = _group_id
  ),
  visits_in_group AS (
    SELECT v.id AS visit_id, v.place_id, v.visited_on, v.meal_type, v.created_by,
           vgl.link_type, vgl.linked_by, vgl.linked_at
    FROM public.visit_group_links vgl JOIN public.visits v ON v.id = vgl.visit_id
    WHERE vgl.group_id = _group_id
  ),
  vp_visible AS (
    SELECT vp.visit_id, vp.user_id FROM public.visit_participants vp
    WHERE EXISTS (SELECT 1 FROM public.memberships mm
                  WHERE mm.group_id = _group_id AND mm.user_id = vp.user_id)
  ),
  vp_external AS (
    SELECT vp.visit_id, count(*)::int AS ext_count FROM public.visit_participants vp
    WHERE NOT EXISTS (SELECT 1 FROM public.memberships mm
                      WHERE mm.group_id = _group_id AND mm.user_id = vp.user_id)
    GROUP BY vp.visit_id
  ),
  reviews_visible AS (
    SELECT r.id AS review_id, r.visit_id, r.user_id, r.overall, r.taste, r.value, r.service,
           CASE WHEN rgv.comment_visible THEN r.comment ELSE NULL END AS comment,
           rgv.rating_visible, rgv.comment_visible
    FROM public.reviews r
    JOIN public.review_group_visibility rgv ON rgv.review_id = r.id AND rgv.group_id = _group_id
    WHERE rgv.rating_visible = true
      AND EXISTS (SELECT 1 FROM public.memberships mm
                  WHERE mm.group_id = _group_id AND mm.user_id = r.user_id)
  ),
  visits_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', vg.visit_id, 'placeId', vg.place_id, 'date', vg.visited_on,
      'meal', vg.meal_type, 'createdBy', vg.created_by,
      'linkType', vg.link_type, 'linkedBy', vg.linked_by, 'linkedAt', vg.linked_at,
      'externalParticipantCount', COALESCE(vpx.ext_count, 0),
      'participantIds', COALESCE(
        (SELECT jsonb_agg(vpv.user_id) FROM vp_visible vpv WHERE vpv.visit_id = vg.visit_id),
        '[]'::jsonb),
      'reviews', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id', rv.review_id, 'userId', rv.user_id, 'overall', rv.overall,
          'taste', rv.taste, 'value', rv.value, 'service', rv.service,
          'comment', rv.comment,
          'ratingVisible', rv.rating_visible, 'commentVisible', rv.comment_visible
        )) FROM reviews_visible rv WHERE rv.visit_id = vg.visit_id),
        '[]'::jsonb)
    )) AS arr
    FROM visits_in_group vg LEFT JOIN vp_external vpx ON vpx.visit_id = vg.visit_id
  ),
  favs_json AS (
    SELECT jsonb_agg(jsonb_build_object('memberId', user_id, 'placeId', place_id)) AS arr
    FROM public.favorites WHERE group_id = _group_id
  ),
  act_src AS (
    SELECT * FROM public.activity WHERE group_id = _group_id
    ORDER BY created_at DESC LIMIT 50
  ),
  act_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'memberId', COALESCE(actor_id, _uid),
      'placeId', place_id, 'visitId', visit_id, 'at', created_at,
      'text', COALESCE(payload->>'text','Aktivitet')
    )) AS arr FROM act_src
  ),
  members_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', user_id, 'name', COALESCE(NULLIF(trim(display_name),''),'Medlem'),
      'avatar', avatar_emoji, 'avatarImage', avatar_url, 'role', role
    )) AS arr FROM members
  ),
  places_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', place_id, 'name', name, 'category', category, 'cuisines', cuisines,
      'occasions', occasions, 'address', address, 'area', area, 'city', city,
      'lat', lat, 'lng', lng, 'photo', photo_url, 'notes', notes,
      'addedBy', added_by, 'addedAt', linked_at, 'origin', origin
    )) AS arr FROM places_agg
  )
  SELECT jsonb_build_object(
    'currentUserId', _uid,
    'group', jsonb_build_object(
      'id', grp.id, 'name', grp.name, 'emoji', COALESCE(grp.emoji,'🍽️'),
      'city', COALESCE(grp.home_location_label,''),
      'createdAt', grp.created_at, 'ownerId', COALESCE(grp.owner_id, grp.created_by),
      'sharedVisitsCountForProgression', grp.shared_visits_count_for_progression
    ),
    'members', COALESCE(members_json.arr, '[]'::jsonb),
    'places', COALESCE(places_json.arr, '[]'::jsonb),
    'visits', COALESCE(visits_json.arr, '[]'::jsonb),
    'favorites', COALESCE(favs_json.arr, '[]'::jsonb),
    'activity', COALESCE(act_json.arr, '[]'::jsonb),
    'nextPlaceId', (SELECT place_id FROM public.group_next_place WHERE group_id = _group_id)
  ) INTO _result
  FROM grp, members_json, places_json, visits_json, favs_json, act_json;
  RETURN _result;
END $$;

REVOKE ALL ON FUNCTION public.get_group_app_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state(uuid) TO authenticated;

COMMIT;
