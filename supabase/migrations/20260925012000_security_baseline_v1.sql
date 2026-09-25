BEGIN;

-- Issue #399, iteration 2:
-- 1) stäng prod-drift som inte finns i stagingreferensen;
-- 2) gör framtida public-objekt default-deny för klientroller;
-- 3) rensa privat push-/notisdata när profilen soft-deletas.

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
