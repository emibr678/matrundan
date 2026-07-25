
-- ============ Utility: updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url',
             NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ groups ============
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text,
  home_location_label text,
  home_lat double precision,
  home_lng double precision,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ memberships ============
CREATE TABLE public.memberships (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE UNIQUE INDEX memberships_one_owner_per_group
  ON public.memberships(group_id) WHERE role = 'owner';
CREATE INDEX memberships_user_idx ON public.memberships(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- ============ Helper functions (SECURITY DEFINER, avoid recursive RLS) ============
CREATE OR REPLACE FUNCTION public.has_membership(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.memberships
                WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_group_role(_group_id uuid, _user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.memberships
                WHERE group_id = _group_id AND user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.shares_group(_user_a uuid, _user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON a.group_id = b.group_id
    WHERE a.user_id = _user_a AND b.user_id = _user_b
  );
$$;

-- profiles policies
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_group(auth.uid(), id));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- groups policies
CREATE POLICY "groups members read" ON public.groups FOR SELECT TO authenticated
  USING (public.has_membership(id, auth.uid()));
CREATE POLICY "groups owner/admin update" ON public.groups FOR UPDATE TO authenticated
  USING (public.has_group_role(id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_group_role(id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "groups owner delete" ON public.groups FOR DELETE TO authenticated
  USING (public.has_group_role(id, auth.uid(), ARRAY['owner']));
-- No direct INSERT policy; groups are created only via create_group_with_owner RPC.

-- memberships policies
CREATE POLICY "memberships read same group" ON public.memberships FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "memberships self leave" ON public.memberships FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() AND role <> 'owner'
    OR public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin'])
       AND role <> 'owner'
  );
CREATE POLICY "memberships admin update" ON public.memberships FOR UPDATE TO authenticated
  USING (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']) AND role <> 'owner');
-- INSERTs of memberships happen via RPC (create_group_with_owner) or invitation acceptance (future).

-- ============ invitations ============
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  invited_email text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  invited_by uuid NOT NULL REFERENCES public.profiles(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations admins read" ON public.invitations FOR SELECT TO authenticated
  USING (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "invitations admins insert" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin'])
              AND invited_by = auth.uid());
CREATE POLICY "invitations admins update" ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "invitations admins delete" ON public.invitations FOR DELETE TO authenticated
  USING (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));

-- ============ places ============
CREATE TABLE public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('restaurang','café','bageri','snabbmat','pub','matvagn')),
  cuisines text[] NOT NULL DEFAULT '{}',
  occasions text[] NOT NULL DEFAULT '{}',
  address text NOT NULL DEFAULT '',
  area text,
  city text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  notes text,
  photo_url text,
  added_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX places_group_idx ON public.places(group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.places TO authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_places_updated_at BEFORE UPDATE ON public.places
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "places members read" ON public.places FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "places members insert" ON public.places FOR INSERT TO authenticated
  WITH CHECK (public.has_membership(group_id, auth.uid()) AND added_by = auth.uid());
CREATE POLICY "places creator or admin update" ON public.places FOR UPDATE TO authenticated
  USING (added_by = auth.uid() OR public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_membership(group_id, auth.uid()));
CREATE POLICY "places creator or admin delete" ON public.places FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));

-- ============ place_sources ============
CREATE TABLE public.place_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_place_id text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, provider),
  UNIQUE (group_id, provider, provider_place_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_sources TO authenticated;
GRANT ALL ON public.place_sources TO service_role;
ALTER TABLE public.place_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_sources members read" ON public.place_sources FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "place_sources members write" ON public.place_sources FOR INSERT TO authenticated
  WITH CHECK (public.has_membership(group_id, auth.uid()));
CREATE POLICY "place_sources admin update" ON public.place_sources FOR UPDATE TO authenticated
  USING (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "place_sources admin delete" ON public.place_sources FOR DELETE TO authenticated
  USING (public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));

-- ============ visits ============
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  visited_on date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('frukost','lunch','fika','middag','kväll')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visits_group_idx ON public.visits(group_id);
CREATE INDEX visits_place_idx ON public.visits(place_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_visits_updated_at BEFORE UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "visits members read" ON public.visits FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "visits members insert" ON public.visits FOR INSERT TO authenticated
  WITH CHECK (public.has_membership(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "visits creator or admin update" ON public.visits FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_membership(group_id, auth.uid()));
CREATE POLICY "visits creator or admin delete" ON public.visits FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));

-- ============ visit_participants ============
CREATE TABLE public.visit_participants (
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (visit_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_participants TO authenticated;
GRANT ALL ON public.visit_participants TO service_role;
ALTER TABLE public.visit_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_participants read" ON public.visit_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visits v
                 WHERE v.id = visit_id AND public.has_membership(v.group_id, auth.uid())));
CREATE POLICY "visit_participants creator write" ON public.visit_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.visits v
                 WHERE v.id = visit_id
                   AND (v.created_by = auth.uid()
                        OR public.has_group_role(v.group_id, auth.uid(), ARRAY['owner','admin']))));
CREATE POLICY "visit_participants creator delete" ON public.visit_participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visits v
                 WHERE v.id = visit_id
                   AND (v.created_by = auth.uid()
                        OR public.has_group_role(v.group_id, auth.uid(), ARRAY['owner','admin']))));

-- ============ reviews ============
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall smallint NOT NULL CHECK (overall BETWEEN 1 AND 5),
  taste smallint CHECK (taste BETWEEN 1 AND 5),
  value smallint CHECK (value BETWEEN 1 AND 5),
  service smallint CHECK (service BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, user_id)
);
CREATE INDEX reviews_place_idx ON public.reviews(place_id);
CREATE INDEX reviews_group_idx ON public.reviews(group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "reviews members read" ON public.reviews FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "reviews self insert" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_membership(group_id, auth.uid()));
CREATE POLICY "reviews self update" ON public.reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews self delete" ON public.reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid()
         OR public.has_group_role(group_id, auth.uid(), ARRAY['owner','admin']));

-- ============ favorites ============
CREATE TABLE public.favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);
CREATE INDEX favorites_group_idx ON public.favorites(group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites members read" ON public.favorites FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "favorites self write" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_membership(group_id, auth.uid()));
CREATE POLICY "favorites self delete" ON public.favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ group_next_place ============
CREATE TABLE public.group_next_place (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  selected_by uuid NOT NULL REFERENCES public.profiles(id),
  selected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_next_place TO authenticated;
GRANT ALL ON public.group_next_place TO service_role;
ALTER TABLE public.group_next_place ENABLE ROW LEVEL SECURITY;

CREATE POLICY "next_place members read" ON public.group_next_place FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "next_place members write" ON public.group_next_place FOR INSERT TO authenticated
  WITH CHECK (public.has_membership(group_id, auth.uid()) AND selected_by = auth.uid());
CREATE POLICY "next_place members update" ON public.group_next_place FOR UPDATE TO authenticated
  USING (public.has_membership(group_id, auth.uid()))
  WITH CHECK (public.has_membership(group_id, auth.uid()) AND selected_by = auth.uid());
CREATE POLICY "next_place members delete" ON public.group_next_place FOR DELETE TO authenticated
  USING (public.has_membership(group_id, auth.uid()));

-- ============ activity ============
CREATE TABLE public.activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  kind text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id),
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_group_idx ON public.activity(group_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity TO authenticated;
GRANT ALL ON public.activity TO service_role;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity members read" ON public.activity FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));
CREATE POLICY "activity members insert" ON public.activity FOR INSERT TO authenticated
  WITH CHECK (public.has_membership(group_id, auth.uid())
              AND (actor_id IS NULL OR actor_id = auth.uid()));

-- ============ RPC: create_group_with_owner ============
CREATE OR REPLACE FUNCTION public.create_group_with_owner(
  _name text,
  _emoji text DEFAULT NULL,
  _home_label text DEFAULT NULL,
  _home_lat double precision DEFAULT NULL,
  _home_lng double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _gid uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id) VALUES (_uid)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.groups (name, emoji, home_location_label, home_lat, home_lng, created_by)
  VALUES (trim(_name), _emoji, _home_label, _home_lat, _home_lng, _uid)
  RETURNING id INTO _gid;

  INSERT INTO public.memberships (group_id, user_id, role)
  VALUES (_gid, _uid, 'owner');

  RETURN _gid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_with_owner(text, text, text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_with_owner(text, text, text, double precision, double precision) TO authenticated;
