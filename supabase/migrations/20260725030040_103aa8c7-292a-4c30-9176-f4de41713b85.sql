-- handle_new_user används enbart av triggern på auth.users; ingen ska
-- kunna kalla den direkt.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Hjälparna används i RLS-policies (authenticated) och av auth-flödet
-- (create_group_with_owner). Anon ska aldrig kunna kalla dem.
REVOKE EXECUTE ON FUNCTION public.has_membership(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_group_role(uuid, uuid, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_group_with_owner(text, text, text, double precision, double precision) FROM PUBLIC, anon;