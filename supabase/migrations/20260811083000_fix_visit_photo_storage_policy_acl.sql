BEGIN;

-- Issue #162: Storage-policyerna körs som den autentiserade användaren och måste
-- kunna fråga om den aktuella användaren får hantera fotot. Den interna
-- treparametershjälparen förblir däremot spärrad för direkt authenticated-anrop,
-- så klienten kan inte använda ett valfritt user_id för att sondera deltagande
-- eller grupproller.
CREATE OR REPLACE FUNCTION public.can_manage_own_visit_photo(
  _group_id uuid,
  _visit_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.can_manage_visit_photo(_group_id, _visit_id, auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.can_manage_own_visit_photo(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_own_visit_photo(uuid, uuid)
  TO authenticated, service_role;

-- Behåll den interna hjälparen otillgänglig för klientrollen. SECURITY DEFINER-
-- funktioner och den nya self-wrappern kan fortsatt använda den server-side.
REVOKE EXECUTE ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid)
  TO service_role;

DROP POLICY IF EXISTS "visit photos allowed upload" ON storage.objects;
CREATE POLICY "visit photos allowed upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND public.can_manage_own_visit_photo(
      public.visit_photo_path_group(name),
      public.visit_photo_path_visit(name)
    )
  );

DROP POLICY IF EXISTS "visit photos allowed delete" ON storage.objects;
CREATE POLICY "visit photos allowed delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND (
      public.can_manage_own_visit_photo(
        public.visit_photo_path_group(name),
        public.visit_photo_path_visit(name)
      )
      OR public.can_delete_original_visit(
        public.visit_photo_path_group(name),
        public.visit_photo_path_visit(name),
        auth.uid()
      )
    )
  );

COMMIT;
