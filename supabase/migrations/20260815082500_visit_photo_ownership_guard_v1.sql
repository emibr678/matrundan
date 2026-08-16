BEGIN;

-- Interimskydd inför #179: dagens singelfoto får inte skrivas över av en annan
-- deltagare. Den befintliga uppladdaren behåller sitt fotoägarskap tills
-- flerfotomodellen införs.
CREATE OR REPLACE FUNCTION public.can_manage_visit_photo(
  _group_id uuid,
  _visit_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _group_id IS NOT NULL
    AND _visit_id IS NOT NULL
    AND _user_id IS NOT NULL
    AND public.group_is_active(_group_id)
    AND public.has_membership(_group_id, _user_id)
    AND EXISTS (
      SELECT 1
      FROM public.visit_group_links vgl
      WHERE vgl.group_id = _group_id
        AND vgl.visit_id = _visit_id
        AND vgl.link_type = 'original'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.visit_participants vp
        WHERE vp.visit_id = _visit_id
          AND vp.user_id = _user_id
      )
      OR public.has_group_role(_group_id, _user_id, ARRAY['owner','admin'])
    )
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.visit_media vm
        WHERE vm.visit_id = _visit_id
          AND vm.group_id = _group_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.visit_media vm
        WHERE vm.visit_id = _visit_id
          AND vm.group_id = _group_id
          AND vm.uploaded_by = _user_id
      )
    );
$function$;

-- Separera borttagning från ersättning: uppladdaren får ta bort sin egen bild,
-- owner/admin får moderera, och den som får radera hela originalbesöket måste
-- fortsatt kunna städa dess lagrade foto före besöksraderingen.
CREATE OR REPLACE FUNCTION public.can_delete_visit_photo(
  _group_id uuid,
  _visit_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _group_id IS NOT NULL
    AND _visit_id IS NOT NULL
    AND _user_id IS NOT NULL
    AND public.group_is_active(_group_id)
    AND public.has_membership(_group_id, _user_id)
    AND EXISTS (
      SELECT 1
      FROM public.visit_group_links vgl
      WHERE vgl.group_id = _group_id
        AND vgl.visit_id = _visit_id
        AND vgl.link_type = 'original'
    )
    AND EXISTS (
      SELECT 1
      FROM public.visit_media vm
      WHERE vm.visit_id = _visit_id
        AND vm.group_id = _group_id
        AND (
          vm.uploaded_by = _user_id
          OR public.has_group_role(_group_id, _user_id, ARRAY['owner','admin'])
          OR public.can_delete_original_visit(_group_id, _visit_id, _user_id)
        )
    );
$function$;

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

CREATE OR REPLACE FUNCTION public.can_delete_own_visit_photo(
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
    AND public.can_delete_visit_photo(_group_id, _visit_id, auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_delete_visit_photo(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_own_visit_photo(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_delete_own_visit_photo(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_visit_photo(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_own_visit_photo(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_own_visit_photo(uuid, uuid)
  TO authenticated, service_role;

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
      public.can_delete_own_visit_photo(
        public.visit_photo_path_group(name),
        public.visit_photo_path_visit(name)
      )
      OR public.can_delete_original_visit(
        public.visit_photo_path_group(name),
        public.visit_photo_path_visit(name),
        auth.uid()
      )
      OR (
        owner = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.visit_media vm
          WHERE vm.storage_path = name
        )
        AND public.has_membership(public.visit_photo_path_group(name), auth.uid())
        AND EXISTS (
          SELECT 1
          FROM public.visit_group_links vgl
          WHERE vgl.group_id = public.visit_photo_path_group(name)
            AND vgl.visit_id = public.visit_photo_path_visit(name)
            AND vgl.link_type = 'original'
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.upsert_visit_photo(
  _group_id uuid,
  _visit_id uuid,
  _storage_path text,
  _mime_type text,
  _byte_size integer,
  _width integer,
  _height integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _previous_path text;
  _previous_uploader uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Två samtidiga "första foto" får aldrig leda till last-write-wins.
  PERFORM pg_advisory_xact_lock(hashtext(_group_id::text), hashtext(_visit_id::text));

  SELECT storage_path, uploaded_by
  INTO _previous_path, _previous_uploader
  FROM public.visit_media
  WHERE visit_id = _visit_id
    AND group_id = _group_id
  FOR UPDATE;

  IF _previous_uploader IS NOT NULL AND _previous_uploader <> _uid THEN
    RAISE EXCEPTION 'En annan deltagare har redan lagt till ett foto. Fler bilder per besök kommer i ett senare steg.';
  END IF;

  IF NOT public.can_manage_visit_photo(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att lägga till eller ersätta fotot för det här besöket';
  END IF;
  IF public.visit_photo_path_group(_storage_path) IS DISTINCT FROM _group_id
     OR public.visit_photo_path_visit(_storage_path) IS DISTINCT FROM _visit_id
     OR lower(right(_storage_path, 4)) <> '.jpg' THEN
    RAISE EXCEPTION 'Ogiltig lagringssökväg för besöksfoto';
  END IF;
  IF _mime_type <> 'image/jpeg' THEN RAISE EXCEPTION 'Endast komprimerade JPEG-bilder stöds'; END IF;
  IF _byte_size <= 0 OR _byte_size > 1500000 THEN RAISE EXCEPTION 'Fotot är för stort'; END IF;
  IF _width <= 0 OR _height <= 0 OR _width > 4000 OR _height > 4000 THEN
    RAISE EXCEPTION 'Ogiltiga bilddimensioner';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'visit-photos'
      AND name = _storage_path
      AND owner = _uid
  ) THEN
    RAISE EXCEPTION 'Den uppladdade bilden saknas eller tillhör inte dig';
  END IF;

  INSERT INTO public.visit_media (
    visit_id, group_id, storage_path, uploaded_by, mime_type, byte_size, width, height
  ) VALUES (
    _visit_id, _group_id, _storage_path, _uid, _mime_type, _byte_size, _width, _height
  )
  ON CONFLICT (visit_id, group_id) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    updated_at = now()
  WHERE public.visit_media.uploaded_by = EXCLUDED.uploaded_by;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fotot ägs av en annan deltagare och kan inte ersättas';
  END IF;

  RETURN _previous_path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_visit_photo(_group_id uuid, _visit_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _previous_path text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_group_id::text), hashtext(_visit_id::text));

  IF NOT public.can_delete_visit_photo(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ta bort fotot för det här besöket';
  END IF;

  DELETE FROM public.visit_media
  WHERE visit_id = _visit_id
    AND group_id = _group_id
  RETURNING storage_path INTO _previous_path;

  RETURN _previous_path;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_visit_photo(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_visit_photo(uuid, uuid)
  TO authenticated;

COMMIT;
