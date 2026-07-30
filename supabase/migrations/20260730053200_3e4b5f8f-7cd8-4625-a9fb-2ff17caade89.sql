-- Revoke EXECUTE from authenticated on superseded / internal SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.get_group_app_state(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_group_app_state_v4b(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_group_app_state_v5c(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_place(uuid, text, text, text[], text[], text, text, text, double precision, double precision, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_or_link_provider_place(uuid, text, text, text, text, text[], text[], text, text, text, double precision, double precision, text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_visit_share_targets(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.group_is_active(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid) FROM authenticated;
