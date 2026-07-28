BEGIN;

-- Paket 5C: ett privat foto per besök och ursprungsgrupp.
-- Besöket förblir kanoniskt, men fotot följer aldrig automatiskt med till en mottagargrupp.

CREATE TABLE public.visit_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL,
  group_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  mime_type text NOT NULL CHECK (mime_type = 'image/jpeg'),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 1500000),
  width integer NOT NULL CHECK (width > 0 AND width <= 4000),
  height integer NOT NULL CHECK (height > 0 AND height <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_media_visit_group_unique UNIQUE (visit_id, group_id),
  CONSTRAINT visit_media_visit_group_fk
    FOREIGN KEY (visit_id, group_id)
    REFERENCES public.visit_group_links(visit_id, group_id)
    ON DELETE CASCADE
);

CREATE INDEX visit_media_group_idx ON public.visit_media(group_id);
CREATE TRIGGER trg_visit_media_updated_at
  BEFORE UPDATE ON public.visit_media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.visit_media ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.visit_media FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.visit_media TO authenticated;
GRANT ALL ON public.visit_media TO service_role;

CREATE POLICY "visit_media group members read"
  ON public.visit_media FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visit-photos', 'visit-photos', false, 1500000, ARRAY['image/jpeg']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.visit_photo_path_group(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NULLIF(split_part(_name, '/', 1), '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.visit_photo_path_visit(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NULLIF(split_part(_name, '/', 2), '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$function$;

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
    AND EXISTS (
      SELECT 1
      FROM public.visit_group_links vgl
      WHERE vgl.group_id = _group_id
        AND vgl.visit_id = _visit_id
        AND vgl.link_type = 'original'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.visit_participants vp
        WHERE vp.visit_id = _visit_id AND vp.user_id = _user_id
      )
      OR public.has_group_role(_group_id, _user_id, ARRAY['owner','admin'])
    );
$function$;

REVOKE ALL ON FUNCTION public.visit_photo_path_group(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.visit_photo_path_visit(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visit_photo_path_group(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.visit_photo_path_visit(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "visit photos members read" ON storage.objects;
CREATE POLICY "visit photos members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND EXISTS (
      SELECT 1 FROM public.visit_media vm
      WHERE vm.storage_path = name
        AND public.has_membership(vm.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "visit photos allowed upload" ON storage.objects;
CREATE POLICY "visit photos allowed upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND public.can_manage_visit_photo(
      public.visit_photo_path_group(name),
      public.visit_photo_path_visit(name),
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "visit photos allowed delete" ON storage.objects;
CREATE POLICY "visit photos allowed delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND public.can_manage_visit_photo(
      public.visit_photo_path_group(name),
      public.visit_photo_path_visit(name),
      auth.uid()
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_visit_photo(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ändra fotot för det här besöket';
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
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'visit-photos' AND name = _storage_path
  ) THEN
    RAISE EXCEPTION 'Den uppladdade bilden saknas';
  END IF;

  SELECT storage_path INTO _previous_path
  FROM public.visit_media
  WHERE visit_id = _visit_id AND group_id = _group_id
  FOR UPDATE;

  INSERT INTO public.visit_media (
    visit_id, group_id, storage_path, uploaded_by, mime_type, byte_size, width, height
  ) VALUES (
    _visit_id, _group_id, _storage_path, _uid, _mime_type, _byte_size, _width, _height
  )
  ON CONFLICT (visit_id, group_id) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    uploaded_by = EXCLUDED.uploaded_by,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    updated_at = now();

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
  IF NOT public.can_manage_visit_photo(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ta bort fotot för det här besöket';
  END IF;

  DELETE FROM public.visit_media
  WHERE visit_id = _visit_id AND group_id = _group_id
  RETURNING storage_path INTO _previous_path;

  RETURN _previous_path;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_visit_photo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_visit_photo(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5c(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _visits jsonb;
BEGIN
  _result := public.get_group_app_state_v4b(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      visit_item || jsonb_build_object(
        'photo', (
          SELECT jsonb_build_object(
            'storagePath', vm.storage_path,
            'uploadedBy', vm.uploaded_by,
            'mimeType', vm.mime_type,
            'byteSize', vm.byte_size,
            'width', vm.width,
            'height', vm.height,
            'updatedAt', vm.updated_at
          )
          FROM public.visit_media vm
          WHERE vm.visit_id = (visit_item->>'id')::uuid
            AND vm.group_id = _group_id
        )
      )
      ORDER BY ordinal
    ),
    '[]'::jsonb
  )
  INTO _visits
  FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
    WITH ORDINALITY AS visit_rows(visit_item, ordinal);

  RETURN jsonb_set(_result, '{visits}', COALESCE(_visits, '[]'::jsonb), true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5c(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5c(uuid) TO authenticated;

COMMIT;
