BEGIN;

-- Paket 4B: grupparkiv, gruppspecifik platsadministration och redigering av eget omdöme.
-- Migrationen är additiv och bevarar alla befintliga grupper, kopplingar, besök och recensioner.

-- =============================================================
-- 1. Livscykel för grupper
-- =============================================================

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_lifecycle_status_check;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'archived'));

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_archive_metadata_check;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_archive_metadata_check
  CHECK (
    (lifecycle_status = 'active' AND archived_at IS NULL AND archived_by IS NULL)
    OR
    (lifecycle_status = 'archived' AND archived_at IS NOT NULL AND archived_by IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS groups_lifecycle_status_idx
  ON public.groups(lifecycle_status);

-- Gruppändringar och permanent borttagning ska endast ske via validerade RPC:er.
REVOKE UPDATE, DELETE ON public.groups FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

-- =============================================================
-- 2. Livscykel och overrides för gruppens platskoppling
-- =============================================================

ALTER TABLE public.group_places
  ADD COLUMN IF NOT EXISTS collection_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_override text,
  ADD COLUMN IF NOT EXISTS cuisines_override text[];

ALTER TABLE public.group_places DROP CONSTRAINT IF EXISTS group_places_collection_status_check;
ALTER TABLE public.group_places
  ADD CONSTRAINT group_places_collection_status_check
  CHECK (collection_status IN ('active', 'archived'));

ALTER TABLE public.group_places DROP CONSTRAINT IF EXISTS group_places_archive_metadata_check;
ALTER TABLE public.group_places
  ADD CONSTRAINT group_places_archive_metadata_check
  CHECK (
    (collection_status = 'active' AND archived_at IS NULL AND archived_by IS NULL)
    OR
    (collection_status = 'archived' AND archived_at IS NOT NULL AND archived_by IS NOT NULL)
  );

ALTER TABLE public.group_places DROP CONSTRAINT IF EXISTS group_places_category_override_check;
ALTER TABLE public.group_places
  ADD CONSTRAINT group_places_category_override_check
  CHECK (
    category_override IS NULL
    OR category_override IN ('restaurang','café','bageri','snabbmat','pub','matvagn')
  );

CREATE INDEX IF NOT EXISTS group_places_group_collection_idx
  ON public.group_places(group_id, collection_status);

-- =============================================================
-- 3. Gemensamt skrivskydd för arkiverade grupper
-- =============================================================

CREATE OR REPLACE FUNCTION public.group_is_active(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = _group_id AND lifecycle_status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.group_is_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_is_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_group_writable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _group_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _group_id := NULLIF(to_jsonb(OLD)->>'group_id', '')::uuid;
  ELSE
    _group_id := NULLIF(to_jsonb(NEW)->>'group_id', '')::uuid;
  END IF;

  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Gruppkoppling saknas';
  END IF;

  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_group_writable() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_group_places_writable ON public.group_places;
CREATE TRIGGER trg_group_places_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.group_places
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

DROP TRIGGER IF EXISTS trg_visit_group_links_writable ON public.visit_group_links;
CREATE TRIGGER trg_visit_group_links_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.visit_group_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

DROP TRIGGER IF EXISTS trg_review_group_visibility_writable ON public.review_group_visibility;
CREATE TRIGGER trg_review_group_visibility_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.review_group_visibility
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

DROP TRIGGER IF EXISTS trg_favorites_writable ON public.favorites;
CREATE TRIGGER trg_favorites_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

DROP TRIGGER IF EXISTS trg_group_next_place_writable ON public.group_next_place;
CREATE TRIGGER trg_group_next_place_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.group_next_place
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

DROP TRIGGER IF EXISTS trg_activity_writable ON public.activity;
CREATE TRIGGER trg_activity_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.activity
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

DROP TRIGGER IF EXISTS trg_invitations_writable ON public.invitations;
CREATE TRIGGER trg_invitations_writable
  BEFORE INSERT OR UPDATE OR DELETE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_writable();

-- =============================================================
-- 4. Grupparkiv
-- =============================================================

CREATE OR REPLACE FUNCTION public.archive_group(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Endast gruppens ägare kan arkivera gruppen';
  END IF;

  SELECT lifecycle_status INTO _status
  FROM public.groups WHERE id = _group_id FOR UPDATE;

  IF _status IS NULL THEN RAISE EXCEPTION 'Gruppen finns inte'; END IF;
  IF _status = 'archived' THEN RETURN; END IF;

  -- Utför gruppspecifika skrivningar medan gruppen fortfarande är aktiv.
  UPDATE public.invitations
    SET revoked_at = now()
    WHERE group_id = _group_id
      AND accepted_at IS NULL
      AND revoked_at IS NULL;

  DELETE FROM public.group_next_place WHERE group_id = _group_id;

  UPDATE public.groups
    SET lifecycle_status = 'archived',
        archived_at = now(),
        archived_by = _uid,
        updated_at = now()
    WHERE id = _group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reactivate_group(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Endast gruppens ägare kan återaktivera gruppen';
  END IF;

  UPDATE public.groups
    SET lifecycle_status = 'active',
        archived_at = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE id = _group_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_group(uuid) TO authenticated;

-- =============================================================
-- 5. Administrera gruppens matställen
-- =============================================================

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
    RAISE EXCEPTION 'Endast ägare eller admin kan arkivera matställen';
  END IF;

  UPDATE public.group_places
    SET collection_status = 'archived',
        archived_at = now(),
        archived_by = _uid,
        updated_at = now()
    WHERE group_id = _group_id
      AND place_id = _place_id
      AND collection_status = 'active';

  IF NOT FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.group_places
      WHERE group_id = _group_id AND place_id = _place_id
    ) THEN
      RAISE EXCEPTION 'Matstället finns inte i gruppen';
    END IF;
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
    RAISE EXCEPTION 'Endast ägare eller admin kan återställa matställen';
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

  IF COALESCE(cardinality(_cuisines_override), 0) > 20 THEN
    RAISE EXCEPTION 'Högst 20 kökstyper kan anges';
  END IF;

  FOREACH _occasion IN ARRAY COALESCE(_occasions, ARRAY[]::text[])
  LOOP
    IF _occasion NOT IN ('snabbt','avslappnat','middag') THEN
      RAISE EXCEPTION 'Ogiltig etikett för Passar för';
    END IF;
  END LOOP;

  UPDATE public.group_places
    SET category_override = _category_override,
        cuisines_override = _cuisines_override,
        occasions = COALESCE(_occasions, ARRAY[]::text[]),
        notes = NULLIF(trim(COALESCE(_notes, '')), ''),
        updated_at = now()
    WHERE group_id = _group_id AND place_id = _place_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte i gruppen'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_group_place(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_group_place(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_group_place_metadata(uuid, uuid, text, text[], text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_group_place(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_group_place(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_place_metadata(uuid, uuid, text, text[], text[], text) TO authenticated;

-- =============================================================
-- 6. Redigera eget omdöme
-- =============================================================

CREATE OR REPLACE FUNCTION public.update_own_review(
  _group_id uuid,
  _review_id uuid,
  _overall smallint,
  _taste smallint DEFAULT NULL,
  _value smallint DEFAULT NULL,
  _service smallint DEFAULT NULL,
  _comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _visit_id uuid;
  _author_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i gruppen';
  END IF;

  SELECT visit_id, user_id INTO _visit_id, _author_id
  FROM public.reviews
  WHERE id = _review_id;

  IF _visit_id IS NULL THEN RAISE EXCEPTION 'Omdömet finns inte'; END IF;
  IF _author_id <> _uid THEN RAISE EXCEPTION 'Du kan bara redigera ditt eget omdöme'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_group_links
    WHERE visit_id = _visit_id AND group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'Besöket är inte synligt i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.visit_participants
    WHERE visit_id = _visit_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan ha ett omdöme';
  END IF;

  IF _overall IS NULL OR _overall < 1 OR _overall > 5 THEN
    RAISE EXCEPTION 'Helhetsbetyg måste vara 1–5';
  END IF;
  IF _taste IS NOT NULL AND (_taste < 1 OR _taste > 5) THEN RAISE EXCEPTION 'Smakbetyg måste vara 1–5'; END IF;
  IF _value IS NOT NULL AND (_value < 1 OR _value > 5) THEN RAISE EXCEPTION 'Prisvärdhet måste vara 1–5'; END IF;
  IF _service IS NOT NULL AND (_service < 1 OR _service > 5) THEN RAISE EXCEPTION 'Service måste vara 1–5'; END IF;

  UPDATE public.reviews
    SET overall = _overall,
        taste = _taste,
        value = _value,
        service = _service,
        comment = NULLIF(trim(COALESCE(_comment, '')), ''),
        updated_at = now()
    WHERE id = _review_id AND user_id = _uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_own_review(uuid, uuid, smallint, smallint, smallint, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_review(uuid, uuid, smallint, smallint, smallint, smallint, text) TO authenticated;

-- =============================================================
-- 7. Läsmodeller för Paket 4B
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_group_app_state_v4b(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
  _group jsonb;
  _places jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Not a member of group';
  END IF;

  _result := public.get_group_app_state(_group_id);

  SELECT jsonb_build_object(
    'lifecycleStatus', g.lifecycle_status,
    'archivedAt', g.archived_at,
    'archivedBy', g.archived_by
  )
  INTO _group
  FROM public.groups g
  WHERE g.id = _group_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'category', COALESCE(gp.category_override, p.category),
    'canonicalCategory', p.category,
    'categoryOverride', gp.category_override,
    'cuisines', COALESCE(gp.cuisines_override, p.cuisines),
    'canonicalCuisines', p.cuisines,
    'cuisinesOverride', gp.cuisines_override,
    'occasions', gp.occasions,
    'address', p.address,
    'area', p.area,
    'city', p.city,
    'lat', p.lat,
    'lng', p.lng,
    'photo', p.photo_url,
    'notes', gp.notes,
    'addedBy', gp.added_by,
    'addedAt', gp.created_at,
    'origin', gp.origin,
    'collectionStatus', gp.collection_status,
    'archivedAt', gp.archived_at,
    'archivedBy', gp.archived_by
  ) ORDER BY gp.created_at DESC), '[]'::jsonb)
  INTO _places
  FROM public.group_places gp
  JOIN public.places p ON p.id = gp.place_id
  WHERE gp.group_id = _group_id;

  _result := jsonb_set(
    _result,
    '{group}',
    COALESCE(_result->'group', '{}'::jsonb) || COALESCE(_group, '{}'::jsonb),
    true
  );
  _result := jsonb_set(_result, '{places}', COALESCE(_places, '[]'::jsonb), true);

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_visit_share_targets_v4b(_visit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base jsonb;
  _result jsonb;
BEGIN
  _base := public.list_visit_share_targets(_visit_id);

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
  INTO _result
  FROM jsonb_array_elements(COALESCE(_base, '[]'::jsonb)) AS item
  JOIN public.groups g ON g.id = (item->>'groupId')::uuid
  WHERE g.lifecycle_status = 'active';

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v4b(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_visit_share_targets_v4b(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v4b(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_visit_share_targets_v4b(uuid) TO authenticated;

-- =============================================================
-- 8. Gruppadministration ska respektera arkivstatus
-- =============================================================

CREATE OR REPLACE FUNCTION public.update_group_settings(
  _group_id uuid,
  _name text,
  _emoji text DEFAULT NULL,
  _home_label text DEFAULT NULL,
  _home_lat double precision DEFAULT NULL,
  _home_lng double precision DEFAULT NULL,
  _home_provider text DEFAULT NULL,
  _home_place_id text DEFAULT NULL,
  _clear_home boolean DEFAULT false,
  _shared_visits_count_for_progression boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _n text; _prov text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ändra gruppens inställningar';
  END IF;
  _n := trim(coalesce(_name,''));
  IF length(_n) < 2 OR length(_n) > 60 THEN
    RAISE EXCEPTION 'Gruppnamnet måste vara 2–60 tecken';
  END IF;

  UPDATE public.groups SET
    name = _n,
    emoji = NULLIF(trim(coalesce(_emoji,'')),''),
    shared_visits_count_for_progression =
      COALESCE(_shared_visits_count_for_progression, shared_visits_count_for_progression),
    updated_at = now()
  WHERE id = _group_id;

  IF _clear_home THEN
    UPDATE public.groups SET
      home_location_label = NULL,
      home_lat = NULL,
      home_lng = NULL,
      home_location_provider = NULL,
      home_location_place_id = NULL,
      updated_at = now()
    WHERE id = _group_id;
  ELSIF _home_provider IS NOT NULL
        AND _home_place_id IS NOT NULL
        AND _home_lat IS NOT NULL
        AND _home_lng IS NOT NULL
        AND _home_label IS NOT NULL THEN
    _prov := lower(trim(_home_provider));
    IF _prov <> 'geoapify' THEN RAISE EXCEPTION 'Okänd platsleverantör'; END IF;
    UPDATE public.groups SET
      home_location_label = NULLIF(trim(_home_label),''),
      home_lat = _home_lat,
      home_lng = _home_lng,
      home_location_provider = _prov,
      home_location_place_id = trim(_home_place_id),
      updated_at = now()
    WHERE id = _group_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_member_role(_group_id uuid, _user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _target record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Endast ägaren kan ändra roller';
  END IF;
  IF _role NOT IN ('member','admin') THEN RAISE EXCEPTION 'Ogiltig roll'; END IF;
  SELECT * INTO _target FROM public.memberships WHERE group_id = _group_id AND user_id = _user_id;
  IF NOT FOUND OR _target.status <> 'active' THEN RAISE EXCEPTION 'Medlemmen är inte aktiv i gruppen'; END IF;
  IF _target.role = 'owner' THEN RAISE EXCEPTION 'Ägarens roll ändras via ägaröverföring'; END IF;
  UPDATE public.memberships SET role = _role WHERE group_id = _group_id AND user_id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_group_member(_group_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _actor_role text; _target record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas'; END IF;
  IF _uid = _user_id THEN RAISE EXCEPTION 'Använd Lämna gruppen'; END IF;
  SELECT role INTO _actor_role FROM public.memberships
    WHERE group_id = _group_id AND user_id = _uid AND status = 'active';
  IF _actor_role IS NULL OR _actor_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Otillräcklig behörighet'; END IF;
  SELECT * INTO _target FROM public.memberships WHERE group_id = _group_id AND user_id = _user_id;
  IF NOT FOUND OR _target.status <> 'active' THEN RAISE EXCEPTION 'Medlemmen är inte aktiv i gruppen'; END IF;
  IF _target.role = 'owner' THEN RAISE EXCEPTION 'Ägaren kan inte tas bort'; END IF;
  IF _actor_role = 'admin' AND _target.role <> 'member' THEN RAISE EXCEPTION 'Admin kan bara ta bort vanliga medlemmar'; END IF;
  UPDATE public.memberships SET status = 'left', left_at = now()
    WHERE group_id = _group_id AND user_id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_group_ownership(_group_id uuid, _new_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _target record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN RAISE EXCEPTION 'Återaktivera gruppen innan ägarskapet överförs'; END IF;
  IF _uid = _new_owner_id THEN RAISE EXCEPTION 'Du är redan ägare'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Endast nuvarande ägare kan överföra ägarskapet';
  END IF;
  SELECT * INTO _target FROM public.memberships WHERE group_id = _group_id AND user_id = _new_owner_id;
  IF NOT FOUND OR _target.status <> 'active' OR _target.role NOT IN ('member','admin') THEN
    RAISE EXCEPTION 'Mottagaren måste vara aktiv medlem eller admin';
  END IF;
  PERFORM set_config('matrundan.allow_owner_change', 'on', true);
  UPDATE public.memberships SET role = 'admin' WHERE group_id = _group_id AND user_id = _uid;
  UPDATE public.memberships SET role = 'owner' WHERE group_id = _group_id AND user_id = _new_owner_id;
  PERFORM set_config('matrundan.allow_owner_change', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_group_settings(uuid, text, text, text, double precision, double precision, text, text, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_group_ownership(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_settings(uuid, text, text, text, double precision, double precision, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid) TO authenticated;

COMMIT;
