BEGIN;

CREATE OR REPLACE FUNCTION public.list_user_groups_v4b()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'emoji', g.emoji,
        'role', m.role,
        'lifecycleStatus', g.lifecycle_status
      )
      ORDER BY
        CASE WHEN g.lifecycle_status = 'active' THEN 0 ELSE 1 END,
        lower(g.name),
        g.id
    ),
    '[]'::jsonb
  )
  FROM public.memberships m
  JOIN public.groups g ON g.id = m.group_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.list_user_groups_v4b() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_user_groups_v4b() TO authenticated;

COMMIT;
