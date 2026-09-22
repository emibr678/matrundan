BEGIN;

-- Issue #179 — uttrycklig cross-group-synlighet för bildägarens egen besöksbild.
-- Mediaobjektet och ägarskapet från #338 förblir kanoniska. Ingen fil kopieras.

ALTER TABLE public.visit_media
  ADD CONSTRAINT visit_media_id_visit_unique
  UNIQUE (id, visit_id);

CREATE TABLE public.visit_media_group_visibility (
  media_id uuid NOT NULL,
  visit_id uuid NOT NULL,
  group_id uuid NOT NULL,
  delivery_token uuid NOT NULL DEFAULT gen_random_uuid(),
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, group_id),
  CONSTRAINT visit_media_group_visibility_delivery_token_unique UNIQUE (delivery_token),
  CONSTRAINT visit_media_group_visibility_media_visit_fkey
    FOREIGN KEY (media_id, visit_id)
    REFERENCES public.visit_media(id, visit_id)
    ON DELETE CASCADE,
  CONSTRAINT visit_media_group_visibility_visit_group_fkey
    FOREIGN KEY (visit_id, group_id)
    REFERENCES public.visit_group_links(visit_id, group_id)
    ON DELETE CASCADE
);

CREATE INDEX visit_media_group_visibility_group_visit_idx
  ON public.visit_media_group_visibility(group_id, visit_id);

ALTER TABLE public.visit_media_group_visibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visit_media_group_visibility FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.visit_media_group_visibility TO service_role;

CREATE OR REPLACE FUNCTION public.grant_own_visit_photo_visibility_v1(
  _visit_id uuid,
  _target_group_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _media_id uuid;
  _source_group_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_target_group_id) THEN
    RAISE EXCEPTION 'Målgruppen är inte aktiv';
  END IF;
  IF NOT public.has_membership(_target_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i målgruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_participants participant
    WHERE participant.visit_id = _visit_id
      AND participant.user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Endast faktiska deltagare kan dela sin bild';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.visit_group_links link
    WHERE link.visit_id = _visit_id
      AND link.group_id = _target_group_id
  ) THEN
    RAISE EXCEPTION 'Besöket finns inte i målgruppen';
  END IF;

  SELECT media.id, media.group_id
  INTO _media_id, _source_group_id
  FROM public.visit_media media
  WHERE media.visit_id = _visit_id
    AND media.uploaded_by = _uid
  ORDER BY media.created_at, media.id
  LIMIT 1;

  IF _media_id IS NULL THEN
    RAISE EXCEPTION 'Du har ingen bild på det här besöket';
  END IF;

  IF _source_group_id = _target_group_id THEN
    RETURN _target_group_id;
  END IF;

  INSERT INTO public.visit_media_group_visibility (
    media_id, visit_id, group_id, granted_by
  ) VALUES (
    _media_id, _visit_id, _target_group_id, _uid
  )
  ON CONFLICT (media_id, group_id) DO NOTHING;

  RETURN _target_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.share_visit_to_group_v4(
  _visit_id uuid,
  _target_group_id uuid,
  _share_own_comment boolean DEFAULT false,
  _allow_strong_duplicate boolean DEFAULT false,
  _share_own_photo boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result uuid;
BEGIN
  _result := public.share_visit_to_group_v3(
    _visit_id,
    _target_group_id,
    _share_own_comment,
    _allow_strong_duplicate
  );

  IF _share_own_photo THEN
    PERFORM public.grant_own_visit_photo_visibility_v1(_visit_id, _target_group_id);
  END IF;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_visit_share_targets_v5(_visit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _base jsonb;
  _result jsonb;
  _own_media_id uuid;
  _own_media_group_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  _base := public.list_visit_share_targets_v4b(_visit_id);

  SELECT media.id, media.group_id
  INTO _own_media_id, _own_media_group_id
  FROM public.visit_media media
  WHERE media.visit_id = _visit_id
    AND media.uploaded_by = _uid
  ORDER BY media.created_at, media.id
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      item || jsonb_build_object(
        'ownHasPhoto', _own_media_id IS NOT NULL,
        'ownPhotoShared',
        CASE
          WHEN _own_media_id IS NULL THEN false
          WHEN _own_media_group_id = (item->>'groupId')::uuid THEN true
          ELSE EXISTS (
            SELECT 1
            FROM public.visit_media_group_visibility visibility
            WHERE visibility.media_id = _own_media_id
              AND visibility.group_id = (item->>'groupId')::uuid
          )
        END
      )
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM jsonb_array_elements(COALESCE(_base, '[]'::jsonb)) item;

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$function$;

-- Service-only: översätter opaque token till rå Storage-sökväg efter verifierad viewer.
CREATE OR REPLACE FUNCTION public.resolve_visit_photo_delivery_v1(
  _delivery_token uuid,
  _viewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _storage_path text;
  _mime_type text;
BEGIN
  IF _delivery_token IS NULL OR _viewer_id IS NULL THEN RETURN NULL; END IF;

  SELECT media.storage_path, media.mime_type
  INTO _storage_path, _mime_type
  FROM public.visit_media_group_visibility visibility
  JOIN public.visit_media media
    ON media.id = visibility.media_id
   AND media.visit_id = visibility.visit_id
  JOIN public.visit_group_links link
    ON link.visit_id = visibility.visit_id
   AND link.group_id = visibility.group_id
  WHERE visibility.delivery_token = _delivery_token
    AND public.has_membership(visibility.group_id, _viewer_id)
  LIMIT 1;

  IF _storage_path IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object('storagePath', _storage_path, 'mimeType', _mime_type);
END;
$function$;

-- v5n återställer #338:s photos[] efter #365:s senare v5m-wrapper och lägger
-- uttryckligt delade bilder ovanpå. Bara cross-group-media använder deliveryToken.
CREATE OR REPLACE FUNCTION public.get_group_app_state_v5n(_group_id uuid)
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
  _result := public.get_group_app_state_v5m(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        jsonb_set(visit_item.item, '{photos}', photo_payload.photos, true),
        '{photo}',
        COALESCE(photo_payload.photos->0, 'null'::jsonb),
        true
      )
      ORDER BY visit_item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _visits
  FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
    WITH ORDINALITY AS visit_item(item, ordinality)
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      jsonb_agg(media_item.photo ORDER BY media_item.created_at, media_item.media_id),
      '[]'::jsonb
    ) AS photos
    FROM (
      SELECT
        media.created_at,
        media.id AS media_id,
        jsonb_build_object(
          'storagePath', media.storage_path,
          'uploadedBy', media.uploaded_by,
          'mimeType', media.mime_type,
          'byteSize', media.byte_size,
          'width', media.width,
          'height', media.height,
          'createdAt', media.created_at,
          'updatedAt', media.updated_at
        ) AS photo
      FROM public.visit_media media
      WHERE media.visit_id = (visit_item.item->>'id')::uuid
        AND media.group_id = _group_id

      UNION ALL

      SELECT
        media.created_at,
        media.id AS media_id,
        jsonb_build_object(
          'deliveryToken', visibility.delivery_token,
          'uploadedBy', media.uploaded_by,
          'mimeType', media.mime_type,
          'byteSize', media.byte_size,
          'width', media.width,
          'height', media.height,
          'createdAt', media.created_at,
          'updatedAt', media.updated_at
        ) AS photo
      FROM public.visit_media_group_visibility visibility
      JOIN public.visit_media media
        ON media.id = visibility.media_id
       AND media.visit_id = visibility.visit_id
      WHERE visibility.visit_id = (visit_item.item->>'id')::uuid
        AND visibility.group_id = _group_id
        AND media.group_id <> _group_id
    ) media_item
  ) photo_payload;

  RETURN jsonb_set(_result, '{visits}', COALESCE(_visits, '[]'::jsonb), true);
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_own_visit_photo_visibility_v1(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_visit_to_group_v4(uuid, uuid, boolean, boolean, boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_visit_share_targets_v5(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_visit_photo_delivery_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_group_app_state_v5n(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.grant_own_visit_photo_visibility_v1(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.share_visit_to_group_v4(uuid, uuid, boolean, boolean, boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_visit_share_targets_v5(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_visit_photo_delivery_v1(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5n(uuid)
  TO authenticated, service_role;

COMMIT;
