BEGIN;

-- Issue #399, iteration 2:
-- 1) stäng verifierad prod-drift;
-- 2) gör framtida public-objekt default-deny för klientroller;
-- 3) ersätt RLS-hjälpare med wrappers bundna till auth.uid();
-- 4) rensa privat push-/notisdata när profilen soft-deletas.

-- Supabase/Postgres ger funktioner EXECUTE till PUBLIC som inbyggd default.
-- Matrundan kräver explicita grants per RPC, så framtida funktioner ska börja
-- stängda. Prod hade dessutom explicita defaultgrants för tabeller/sekvenser.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES
  FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS
  FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES
  FROM PUBLIC, anon, authenticated, service_role;

-- Prod hade fått breda grants via historiska default privileges. Ta bara bort
-- de privilegier som saknas i staging; behåll den avsedda direkta klientytan.
REVOKE ALL PRIVILEGES ON TABLE
  public.group_places,
  public.notification_outbox,
  public.notification_preferences,
  public.push_subscriptions,
  public.review_group_visibility,
  public.visit_group_links,
  public.visit_media
FROM anon;

REVOKE ALL PRIVILEGES ON TABLE
  public.group_places,
  public.notification_outbox,
  public.review_group_visibility,
  public.visit_group_links
FROM authenticated;

REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE
  public.notification_preferences,
  public.push_subscriptions
FROM authenticated;

REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE
  public.activity,
  public.favorites,
  public.group_next_place,
  public.groups,
  public.visit_media
FROM authenticated;

-- Råhjälparna tar valfria användar-ID:n och ska inte vara direkta klient-API:er.
-- RLS får i stället wrappers som alltid binder aktören till auth.uid().
CREATE OR REPLACE FUNCTION public.current_user_has_membership(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.has_membership(_group_id, auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.current_user_has_group_role(
  _group_id uuid,
  _roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.has_group_role(_group_id, auth.uid(), _roles);
$function$;

CREATE OR REPLACE FUNCTION public.current_user_shares_group(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.shares_group(auth.uid(), _other_user_id);
$function$;

REVOKE ALL ON FUNCTION public.current_user_has_membership(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_has_group_role(uuid, text[])
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_shares_group(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_user_has_membership(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_group_role(uuid, text[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_shares_group(uuid)
  TO authenticated;

ALTER POLICY "activity members insert"
  ON public.activity
  WITH CHECK (
    public.current_user_has_membership(group_id)
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

ALTER POLICY "activity members read"
  ON public.activity
  USING (public.current_user_has_membership(group_id));

ALTER POLICY "favorites members read"
  ON public.favorites
  USING (public.current_user_has_membership(group_id));

ALTER POLICY "favorites self write"
  ON public.favorites
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_has_membership(group_id)
  );

ALTER POLICY "next_place members delete"
  ON public.group_next_place
  USING (public.current_user_has_membership(group_id));

ALTER POLICY "next_place members read"
  ON public.group_next_place
  USING (public.current_user_has_membership(group_id));

ALTER POLICY "next_place members update"
  ON public.group_next_place
  USING (public.current_user_has_membership(group_id))
  WITH CHECK (
    public.current_user_has_membership(group_id)
    AND selected_by = auth.uid()
  );

ALTER POLICY "next_place members write"
  ON public.group_next_place
  WITH CHECK (
    public.current_user_has_membership(group_id)
    AND selected_by = auth.uid()
  );

ALTER POLICY "groups members read"
  ON public.groups
  USING (public.current_user_has_membership(id));

ALTER POLICY "groups owner delete"
  ON public.groups
  USING (
    public.current_user_has_group_role(id, ARRAY['owner']::text[])
  );

ALTER POLICY "groups owner/admin update"
  ON public.groups
  USING (
    public.current_user_has_group_role(id, ARRAY['owner','admin']::text[])
  )
  WITH CHECK (
    public.current_user_has_group_role(id, ARRAY['owner','admin']::text[])
  );

ALTER POLICY "memberships read same group"
  ON public.memberships
  USING (public.current_user_has_membership(group_id));

ALTER POLICY "profiles self read"
  ON public.profiles
  USING (
    id = auth.uid()
    OR public.current_user_shares_group(id)
  );

ALTER POLICY "visit_media group members read"
  ON public.visit_media
  USING (public.current_user_has_membership(group_id));

ALTER POLICY "visit photos allowed delete"
  ON storage.objects
  USING (
    bucket_id = 'visit-photos'
    AND NOT EXISTS (
      SELECT 1
      FROM public.visit_media vm
      WHERE vm.storage_path = name
    )
    AND public.current_user_has_membership(
      public.visit_photo_path_group(name)
    )
    AND public.group_is_active(public.visit_photo_path_group(name))
    AND (
      (
        EXISTS (
          SELECT 1
          FROM public.visit_group_links vgl
          WHERE vgl.group_id = public.visit_photo_path_group(name)
            AND vgl.visit_id = public.visit_photo_path_visit(name)
            AND vgl.link_type = 'original'
        )
        AND (
          owner = auth.uid()
          OR public.current_user_has_group_role(
            public.visit_photo_path_group(name),
            ARRAY['owner','admin']::text[]
          )
        )
      )
      OR NOT EXISTS (
        SELECT 1
        FROM public.visits v
        WHERE v.id = public.visit_photo_path_visit(name)
      )
    )
  );

ALTER POLICY "visit photos members read"
  ON storage.objects
  USING (
    bucket_id = 'visit-photos'
    AND EXISTS (
      SELECT 1
      FROM public.visit_media vm
      WHERE vm.storage_path = name
        AND public.current_user_has_membership(vm.group_id)
    )
  );

REVOKE EXECUTE ON FUNCTION public.has_membership(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_group_role(uuid, uuid, text[])
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_group(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- Pushabonnemang, notispreferenser och outbox saknar profil-FK och måste
-- rensas explicit när kontoborttagningen soft-deletar profilen.
CREATE OR REPLACE FUNCTION public.clear_private_notifications_on_profile_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.push_subscriptions
    WHERE user_id = OLD.id;

    DELETE FROM public.notification_preferences
    WHERE user_id = OLD.id;

    DELETE FROM public.notification_outbox
    WHERE user_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_private_notifications_on_profile_soft_delete()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_clear_private_notifications_on_soft_delete
  ON public.profiles;
CREATE TRIGGER profiles_clear_private_notifications_on_soft_delete
AFTER UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.clear_private_notifications_on_profile_soft_delete();

COMMIT;
