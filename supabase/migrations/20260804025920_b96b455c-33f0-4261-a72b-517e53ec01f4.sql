CREATE OR REPLACE FUNCTION public.shares_group(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON a.group_id = b.group_id
    WHERE a.user_id = _user_a AND a.status = 'active'
      AND b.user_id = _user_b AND b.status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.enqueue_activity_notifications() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_participant_notification() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5d(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5e(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5f(uuid) FROM PUBLIC, anon, authenticated;