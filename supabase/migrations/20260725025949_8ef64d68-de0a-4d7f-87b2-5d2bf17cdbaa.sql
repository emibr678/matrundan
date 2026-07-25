-- =============================================================
-- Paket 1 – härdning: ägarskydd, cross-group-konsistens,
-- immutabla identitetsfält och strikt anon-åtkomst.
-- Additiv migration; ändrar inte tabellstruktur eller vy-scope.
-- =============================================================

-- ---------- A. Owner-skydd på memberships ----------

-- Snävare RLS: existerande ägar-rad kan varken uppdateras eller väljas som mål.
DROP POLICY IF EXISTS "memberships admin update" ON public.memberships;
CREATE POLICY "memberships admin update"
ON public.memberships
FOR UPDATE
TO authenticated
USING (
  has_group_role(group_id, auth.uid(), ARRAY['owner'::text, 'admin'::text])
  AND role <> 'owner'
)
WITH CHECK (
  has_group_role(group_id, auth.uid(), ARRAY['owner'::text, 'admin'::text])
  AND role <> 'owner'
);

-- Extra försvarslager: en trigger blockerar direkt UPDATE/DELETE på ägar-rader.
-- Framtida ägarskapsöverföring får gå via egen SECURITY DEFINER-RPC som
-- sätter en session-nyckel innan den kör bytet.
CREATE OR REPLACE FUNCTION public.protect_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.role = 'owner') THEN
    RAISE EXCEPTION 'owner membership is immutable; use a dedicated ownership-transfer function';
  END IF;
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') THEN
    RAISE EXCEPTION 'owner membership cannot be deleted directly';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_protect_owner ON public.memberships;
CREATE TRIGGER trg_memberships_protect_owner
BEFORE UPDATE OR DELETE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_membership();


-- ---------- B. Gruppkonsistens via composite unique + composite FK ----------

-- Composite unique-nycklar krävs som mål för composite FKs.
ALTER TABLE public.places
  ADD CONSTRAINT places_id_group_key UNIQUE (id, group_id);

ALTER TABLE public.visits
  ADD CONSTRAINT visits_id_group_key UNIQUE (id, group_id);

ALTER TABLE public.visits
  ADD CONSTRAINT visits_id_group_place_key UNIQUE (id, group_id, place_id);

-- visits.group_id måste matcha places.group_id för visits.place_id.
ALTER TABLE public.visits
  ADD CONSTRAINT visits_place_group_fkey
  FOREIGN KEY (place_id, group_id)
  REFERENCES public.places (id, group_id)
  ON DELETE CASCADE;

-- place_sources.group_id måste matcha places.group_id.
ALTER TABLE public.place_sources
  ADD CONSTRAINT place_sources_place_group_fkey
  FOREIGN KEY (place_id, group_id)
  REFERENCES public.places (id, group_id)
  ON DELETE CASCADE;

-- favorites.group_id måste matcha places.group_id.
ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_place_group_fkey
  FOREIGN KEY (place_id, group_id)
  REFERENCES public.places (id, group_id)
  ON DELETE CASCADE;

-- group_next_place.group_id måste matcha places.group_id.
ALTER TABLE public.group_next_place
  ADD CONSTRAINT group_next_place_place_group_fkey
  FOREIGN KEY (place_id, group_id)
  REFERENCES public.places (id, group_id)
  ON DELETE CASCADE;

-- reviews.group_id och reviews.place_id måste matcha visitens.
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_visit_group_place_fkey
  FOREIGN KEY (visit_id, group_id, place_id)
  REFERENCES public.visits (id, group_id, place_id)
  ON DELETE CASCADE;

-- visit_participants: user_id måste vara medlem i besökets grupp.
CREATE OR REPLACE FUNCTION public.validate_visit_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
BEGIN
  SELECT group_id INTO v_group FROM public.visits WHERE id = NEW.visit_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'unknown visit %', NEW.visit_id;
  END IF;
  IF NOT public.has_membership(v_group, NEW.user_id) THEN
    RAISE EXCEPTION 'participant % is not a member of visit''s group %', NEW.user_id, v_group;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visit_participants_validate ON public.visit_participants;
CREATE TRIGGER trg_visit_participants_validate
BEFORE INSERT OR UPDATE ON public.visit_participants
FOR EACH ROW EXECUTE FUNCTION public.validate_visit_participant();

-- activity.place_id / visit_id måste tillhöra activity.group_id när de är satta.
-- Använder trigger istället för composite FK eftersom activity behåller
-- ON DELETE SET NULL på place_id/visit_id (composite FK skulle sätta även
-- group_id till NULL, vilket bryter NOT NULL).
CREATE OR REPLACE FUNCTION public.validate_activity_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g uuid;
BEGIN
  IF NEW.place_id IS NOT NULL THEN
    SELECT group_id INTO g FROM public.places WHERE id = NEW.place_id;
    IF g IS DISTINCT FROM NEW.group_id THEN
      RAISE EXCEPTION 'activity.place_id % does not belong to activity.group_id %',
        NEW.place_id, NEW.group_id;
    END IF;
  END IF;
  IF NEW.visit_id IS NOT NULL THEN
    SELECT group_id INTO g FROM public.visits WHERE id = NEW.visit_id;
    IF g IS DISTINCT FROM NEW.group_id THEN
      RAISE EXCEPTION 'activity.visit_id % does not belong to activity.group_id %',
        NEW.visit_id, NEW.group_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_validate ON public.activity;
CREATE TRIGGER trg_activity_validate
BEFORE INSERT OR UPDATE ON public.activity
FOR EACH ROW EXECUTE FUNCTION public.validate_activity_refs();


-- ---------- C. Immutabla identitetsfält ----------

CREATE OR REPLACE FUNCTION public.places_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'places.group_id is immutable';
  END IF;
  IF NEW.added_by IS DISTINCT FROM OLD.added_by THEN
    RAISE EXCEPTION 'places.added_by is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_places_immutable ON public.places;
CREATE TRIGGER trg_places_immutable
BEFORE UPDATE ON public.places
FOR EACH ROW EXECUTE FUNCTION public.places_immutable_cols();

CREATE OR REPLACE FUNCTION public.visits_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'visits.group_id is immutable';
  END IF;
  IF NEW.place_id IS DISTINCT FROM OLD.place_id THEN
    RAISE EXCEPTION 'visits.place_id is immutable';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'visits.created_by is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_visits_immutable ON public.visits;
CREATE TRIGGER trg_visits_immutable
BEFORE UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.visits_immutable_cols();

CREATE OR REPLACE FUNCTION public.reviews_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'reviews.group_id is immutable';
  END IF;
  IF NEW.place_id IS DISTINCT FROM OLD.place_id THEN
    RAISE EXCEPTION 'reviews.place_id is immutable';
  END IF;
  IF NEW.visit_id IS DISTINCT FROM OLD.visit_id THEN
    RAISE EXCEPTION 'reviews.visit_id is immutable';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'reviews.user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reviews_immutable ON public.reviews;
CREATE TRIGGER trg_reviews_immutable
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reviews_immutable_cols();

CREATE OR REPLACE FUNCTION public.place_sources_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'place_sources.group_id is immutable';
  END IF;
  IF NEW.place_id IS DISTINCT FROM OLD.place_id THEN
    RAISE EXCEPTION 'place_sources.place_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_place_sources_immutable ON public.place_sources;
CREATE TRIGGER trg_place_sources_immutable
BEFORE UPDATE ON public.place_sources
FOR EACH ROW EXECUTE FUNCTION public.place_sources_immutable_cols();

CREATE OR REPLACE FUNCTION public.activity_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'activity.group_id is immutable';
  END IF;
  IF NEW.actor_id IS DISTINCT FROM OLD.actor_id THEN
    RAISE EXCEPTION 'activity.actor_id is immutable';
  END IF;
  IF NEW.place_id IS DISTINCT FROM OLD.place_id THEN
    RAISE EXCEPTION 'activity.place_id is immutable';
  END IF;
  IF NEW.visit_id IS DISTINCT FROM OLD.visit_id THEN
    RAISE EXCEPTION 'activity.visit_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_activity_immutable ON public.activity;
CREATE TRIGGER trg_activity_immutable
BEFORE UPDATE ON public.activity
FOR EACH ROW EXECUTE FUNCTION public.activity_immutable_cols();


-- ---------- D. Återkalla onödig anon-åtkomst ----------

REVOKE ALL ON TABLE
  public.activity,
  public.favorites,
  public.group_next_place,
  public.groups,
  public.invitations,
  public.memberships,
  public.place_sources,
  public.places,
  public.profiles,
  public.reviews,
  public.visit_participants,
  public.visits
FROM anon;

-- Bekräfta att authenticated och service_role har rätt privilegier
-- (idempotent; skulle en tidigare migration ha återkallat något oavsiktligt
-- läggs det tillbaka här).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.activity,
  public.favorites,
  public.group_next_place,
  public.groups,
  public.invitations,
  public.memberships,
  public.place_sources,
  public.places,
  public.profiles,
  public.reviews,
  public.visit_participants,
  public.visits
TO authenticated;

GRANT ALL ON
  public.activity,
  public.favorites,
  public.group_next_place,
  public.groups,
  public.invitations,
  public.memberships,
  public.place_sources,
  public.places,
  public.profiles,
  public.reviews,
  public.visit_participants,
  public.visits
TO service_role;