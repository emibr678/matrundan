BEGIN;

-- Issue #338 — flera deltagares foton på samma kanoniska besök.
--
-- Befintligt media bevaras. Den tidigare singelfotonyckeln ersätts med högst en
-- aktiv bild per (besök, originalgrupp, uppladdare). Nya foton får endast läggas
-- till av faktiska deltagare. Owner/admin behåller moderation men får inte ta
-- över en annan deltagares ägarskap.

ALTER TABLE public.visit_media
  DROP CONSTRAINT IF EXISTS visit_media_visit_group_unique;

ALTER TABLE public.visit_media
  ADD CONSTRAINT visit_media_visit_group_uploader_unique
  UNIQUE (visit_id, group_id, uploaded_by);

CREATE INDEX IF NOT EXISTS visit_media_visit_group_created_idx
  ON public.visit_media (visit_id, group_id, created_at, id);

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
    AND EXISTS (
      SELECT 1
      FROM public.visit_participants vp
      WHERE vp.visit_id = _visit_id
        AND vp.user_id = _user_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_delete_visit_photo(
  _group_id uuid,
  _visit_id uuid,
  _uploaded_by uuid,
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
    AND _uploaded_by IS NOT NULL
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
        AND vm.uploaded_by = _uploaded_by
    )
    AND (
      _uploaded_by = _user_id
      OR public.has_group_role(_group_id, _user_id, ARRAY['owner','admin'])
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
    AND public.can_delete_visit_photo(_group_id, _visit_id, auth.uid(), auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.can_delete_own_visit_photo_path(_storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.visit_media vm
      WHERE vm.storage_path = _storage_path
        AND public.can_delete_visit_photo(
          vm.group_id,
          vm.visit_id,
          vm.uploaded_by,
          auth.uid()
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.can_delete_visit_photo(uuid, uuid, uuid);
REVOKE ALL ON FUNCTION public.can_delete_visit_photo(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_own_visit_photo(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_delete_own_visit_photo(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_delete_own_visit_photo_path(text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_visit_photo(uuid, uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_own_visit_photo(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_own_visit_photo(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_own_visit_photo_path(text)
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.visit_media vm
      WHERE vm.storage_path = name
    )
    AND public.has_membership(public.visit_photo_path_group(name), auth.uid())
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
          OR public.has_group_role(
            public.visit_photo_path_group(name),
            auth.uid(),
            ARRAY['owner','admin']
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

  -- Samma deltagare får högst en aktiv bild. Låset hindrar två samtidiga
  -- uppladdningar från samma användare att skapa ett race.
  PERFORM pg_advisory_xact_lock(
    hashtext(_group_id::text),
    hashtext(_visit_id::text || ':' || _uid::text)
  );

  IF NOT public.can_manage_visit_photo(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan lägga till eller byta sin bild';
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

  SELECT vm.storage_path
  INTO _previous_path
  FROM public.visit_media vm
  WHERE vm.visit_id = _visit_id
    AND vm.group_id = _group_id
    AND vm.uploaded_by = _uid
  FOR UPDATE;

  INSERT INTO public.visit_media (
    visit_id, group_id, storage_path, uploaded_by, mime_type, byte_size, width, height
  ) VALUES (
    _visit_id, _group_id, _storage_path, _uid, _mime_type, _byte_size, _width, _height
  )
  ON CONFLICT (visit_id, group_id, uploaded_by) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    updated_at = now();

  RETURN _previous_path;
END;
$function$;

-- Bakåtkompatibel self-delete för äldre klienter. Den kan aldrig välja en
-- annan deltagares bild när flerfoto väl finns.
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

  PERFORM pg_advisory_xact_lock(
    hashtext(_group_id::text),
    hashtext(_visit_id::text || ':' || _uid::text)
  );

  IF NOT public.can_delete_visit_photo(_group_id, _visit_id, _uid, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ta bort din bild för det här besöket';
  END IF;

  DELETE FROM public.visit_media
  WHERE visit_id = _visit_id
    AND group_id = _group_id
    AND uploaded_by = _uid
  RETURNING storage_path INTO _previous_path;

  RETURN _previous_path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_visit_photo_v2(
  _group_id uuid,
  _visit_id uuid,
  _uploaded_by uuid
)
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

  PERFORM pg_advisory_xact_lock(
    hashtext(_group_id::text),
    hashtext(_visit_id::text || ':' || _uploaded_by::text)
  );

  IF NOT public.can_delete_visit_photo(_group_id, _visit_id, _uploaded_by, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ta bort den här bilden';
  END IF;

  DELETE FROM public.visit_media
  WHERE visit_id = _visit_id
    AND group_id = _group_id
    AND uploaded_by = _uploaded_by
  RETURNING storage_path INTO _previous_path;

  RETURN _previous_path;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_visit_photo(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_visit_photo_v2(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_visit_photo(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_visit_photo_v2(uuid, uuid, uuid)
  TO authenticated;

-- Hela originalbesöket får fortsatt raderas av registreraren/owner/admin, men
-- det ger inte längre rätt att punktmoderera någon annans bild. RPC:n samlar
-- först lagringssökvägarna, raderar sedan det kanoniska besöket och låter
-- klienten städa de nu orefererade Storage-objekten.
DROP FUNCTION IF EXISTS public.delete_original_visit(uuid, uuid);

CREATE FUNCTION public.delete_original_visit(
  _group_id uuid,
  _visit_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _storage_paths text[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_delete_original_visit(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Endast registreraren, ägare eller admin kan radera besöket';
  END IF;

  PERFORM 1 FROM public.visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Besöket finns inte längre'; END IF;

  SELECT COALESCE(array_agg(vm.storage_path ORDER BY vm.created_at, vm.id), ARRAY[]::text[])
  INTO _storage_paths
  FROM public.visit_media vm
  WHERE vm.visit_id = _visit_id
    AND vm.group_id = _group_id;

  DELETE FROM public.activity WHERE visit_id = _visit_id;
  DELETE FROM public.visits WHERE id = _visit_id;

  RETURN _storage_paths;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_original_visit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_original_visit(uuid, uuid) TO authenticated;

-- Äldre read-modeler behåller ett enda representativt foto så att en klient som
-- ännu inte känner till photos[] fortsätter fungera efter migrationen.
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
            'createdAt', vm.created_at,
            'updatedAt', vm.updated_at
          )
          FROM public.visit_media vm
          WHERE vm.visit_id = (visit_item->>'id')::uuid
            AND vm.group_id = _group_id
          ORDER BY vm.created_at, vm.id
          LIMIT 1
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

-- v5m behåller tidigare review-enrichment men lägger additivt till alla media
-- för den redan auktoriserade aktiva gruppen. source-group eller annan
-- cross-group-information exponeras inte.
CREATE OR REPLACE FUNCTION public.get_group_app_state_v5m(_group_id uuid)
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
  _result := public.get_group_app_state_v5l(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        jsonb_set(
          visit_item.item,
          '{reviews}',
          COALESCE((
            SELECT jsonb_agg(
              jsonb_set(
                jsonb_set(
                  review_item.item,
                  '{atmosphere}',
                  COALESCE(to_jsonb(review_row.atmosphere), 'null'::jsonb),
                  true
                ),
                '{reviewModel}',
                COALESCE(to_jsonb(review_row.review_model), 'null'::jsonb),
                true
              )
              ORDER BY review_item.ordinality
            )
            FROM jsonb_array_elements(COALESCE(visit_item.item->'reviews', '[]'::jsonb))
              WITH ORDINALITY AS review_item(item, ordinality)
            LEFT JOIN public.reviews review_row
              ON review_row.id = (review_item.item->>'id')::uuid
          ), '[]'::jsonb),
          true
        ),
        '{photos}',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'storagePath', vm.storage_path,
              'uploadedBy', vm.uploaded_by,
              'mimeType', vm.mime_type,
              'byteSize', vm.byte_size,
              'width', vm.width,
              'height', vm.height,
              'createdAt', vm.created_at,
              'updatedAt', vm.updated_at
            )
            ORDER BY vm.created_at, vm.id
          )
          FROM public.visit_media vm
          WHERE vm.visit_id = (visit_item.item->>'id')::uuid
            AND vm.group_id = _group_id
        ), '[]'::jsonb),
        true
      )
      ORDER BY visit_item.ordinality
    ),
    '[]'::jsonb
  ) INTO _visits
  FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
    WITH ORDINALITY AS visit_item(item, ordinality);

  RETURN jsonb_set(_result, '{visits}', _visits, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5c(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5m(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5c(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5m(uuid)
  TO authenticated;

COMMIT;
