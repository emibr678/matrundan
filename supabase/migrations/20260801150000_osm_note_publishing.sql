BEGIN;

ALTER TABLE public.place_data_reports
  ADD COLUMN IF NOT EXISTS osm_submission_state text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS osm_submission_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS osm_submission_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS osm_submission_error_code text,
  ADD COLUMN IF NOT EXISTS osm_public_reference text,
  ADD COLUMN IF NOT EXISTS osm_public_text text,
  ADD COLUMN IF NOT EXISTS osm_note_id bigint,
  ADD COLUMN IF NOT EXISTS osm_note_url text,
  ADD COLUMN IF NOT EXISTS osm_note_status text,
  ADD COLUMN IF NOT EXISTS osm_note_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS osm_note_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS osm_note_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS osm_submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_osm_submission_state_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_osm_submission_state_check
      CHECK (osm_submission_state IN ('not_submitted', 'submitting', 'published', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_osm_note_status_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_osm_note_status_check
      CHECK (osm_note_status IS NULL OR osm_note_status IN ('open', 'closed', 'hidden', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_osm_public_text_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_osm_public_text_check
      CHECK (osm_public_text IS NULL OR length(osm_public_text) BETWEEN 20 AND 1200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_osm_reference_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_osm_reference_check
      CHECK (osm_public_reference IS NULL OR osm_public_reference ~ '^MR-[A-Z0-9]{10}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_osm_note_id_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_osm_note_id_check
      CHECK (osm_note_id IS NULL OR osm_note_id > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_osm_note_url_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_osm_note_url_check
      CHECK (
        osm_note_url IS NULL
        OR osm_note_url ~ '^https://www\.openstreetmap\.org/note/[1-9][0-9]*$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_osm_published_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_osm_published_check
      CHECK (
        osm_submission_state <> 'published'
        OR (
          osm_note_id IS NOT NULL
          AND osm_note_url IS NOT NULL
          AND osm_note_status IS NOT NULL
          AND osm_note_created_at IS NOT NULL
          AND osm_public_reference IS NOT NULL
          AND osm_public_text IS NOT NULL
        )
      );
  END IF;
END
$block$;

CREATE UNIQUE INDEX IF NOT EXISTS place_data_reports_osm_note_id_uidx
  ON public.place_data_reports(osm_note_id)
  WHERE osm_note_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS place_data_reports_osm_public_reference_uidx
  ON public.place_data_reports(osm_public_reference)
  WHERE osm_public_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS place_data_reports_osm_status_idx
  ON public.place_data_reports(osm_note_status, osm_note_last_checked_at DESC)
  WHERE osm_note_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_place_data_report_osm_submission_v1(
  _group_id uuid,
  _report_id uuid,
  _public_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _report public.place_data_reports%ROWTYPE;
  _text text := trim(COALESCE(_public_text, ''));
  _reference text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan publicera till OpenStreetMap';
  END IF;
  IF length(_text) < 20 OR length(_text) > 1000 THEN
    RAISE EXCEPTION 'Den offentliga texten måste vara 20–1000 tecken';
  END IF;

  SELECT *
  INTO _report
  FROM public.place_data_reports
  WHERE id = _report_id
    AND group_id = _group_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rapporten finns inte i gruppen'; END IF;
  IF _report.status <> 'ready_for_osm' THEN
    RAISE EXCEPTION 'Rapporten måste först förberedas för OpenStreetMap';
  END IF;
  IF _report.reported_lat IS NULL OR _report.reported_lng IS NULL THEN
    RAISE EXCEPTION 'Matstället saknar en verifierad kartposition';
  END IF;
  IF _report.osm_note_id IS NOT NULL OR _report.osm_submission_state = 'published' THEN
    RAISE EXCEPTION 'Rapporten är redan publicerad till OpenStreetMap';
  END IF;
  IF _report.osm_submission_state = 'submitting'
     AND _report.osm_submission_started_at > now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Publicering pågår redan';
  END IF;

  IF (
    SELECT count(*)
    FROM public.place_data_reports r
    WHERE r.osm_submitted_by = _uid
      AND r.osm_submission_started_at >= now() - interval '24 hours'
      AND r.osm_submission_state IN ('submitting', 'published')
  ) >= 10 THEN
    RAISE EXCEPTION 'Högst 10 OSM-anteckningar kan publiceras per person och dygn';
  END IF;

  IF (
    SELECT count(*)
    FROM public.place_data_reports r
    WHERE r.group_id = _group_id
      AND r.osm_submission_started_at >= now() - interval '24 hours'
      AND r.osm_submission_state IN ('submitting', 'published')
  ) >= 25 THEN
    RAISE EXCEPTION 'Gruppen har nått dygnsgränsen för OSM-anteckningar';
  END IF;

  _reference := COALESCE(
    _report.osm_public_reference,
    'MR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

  UPDATE public.place_data_reports
  SET osm_submission_state = 'submitting',
      osm_submission_started_at = now(),
      osm_submission_attempts = osm_submission_attempts + 1,
      osm_submission_error_code = NULL,
      osm_public_reference = _reference,
      osm_public_text = _text,
      osm_submitted_by = _uid,
      updated_at = now()
  WHERE id = _report_id;

  RETURN jsonb_build_object(
    'reportId', _report_id,
    'lat', _report.reported_lat,
    'lng', _report.reported_lng,
    'publicText', _text,
    'publicReference', _reference
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_place_data_report_osm_submission_v1(
  _report_id uuid,
  _public_reference text,
  _note_id bigint,
  _note_status text,
  _note_created_at timestamptz,
  _note_closed_at timestamptz,
  _public_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _note_id IS NULL OR _note_id <= 0 THEN RAISE EXCEPTION 'Ogiltigt OSM-note-ID'; END IF;
  IF _note_status NOT IN ('open', 'closed', 'hidden', 'unknown') THEN
    RAISE EXCEPTION 'Ogiltig OSM-status';
  END IF;

  UPDATE public.place_data_reports
  SET osm_submission_state = 'published',
      osm_submission_error_code = NULL,
      osm_public_text = _public_text,
      osm_note_id = _note_id,
      osm_note_url = 'https://www.openstreetmap.org/note/' || _note_id::text,
      osm_note_status = _note_status,
      osm_note_created_at = COALESCE(_note_created_at, now()),
      osm_note_last_checked_at = now(),
      osm_note_closed_at = _note_closed_at,
      updated_at = now()
  WHERE id = _report_id
    AND osm_public_reference = _public_reference
    AND osm_submission_state = 'submitting';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OSM-publiceringen kunde inte kopplas till rapporten';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_place_data_report_osm_submission_v1(
  _report_id uuid,
  _public_reference text,
  _error_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.place_data_reports
  SET osm_submission_state = 'failed',
      osm_submission_error_code = left(COALESCE(_error_code, 'unavailable'), 80),
      updated_at = now()
  WHERE id = _report_id
    AND osm_public_reference = _public_reference
    AND osm_note_id IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_place_data_report_osm_refresh_v1(
  _group_id uuid,
  _report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan kontrollera OSM-status';
  END IF;

  SELECT jsonb_build_object(
    'reportId', r.id,
    'noteId', r.osm_note_id::text,
    'publicReference', r.osm_public_reference
  )
  INTO _result
  FROM public.place_data_reports r
  WHERE r.id = _report_id
    AND r.group_id = _group_id
    AND r.osm_note_id IS NOT NULL
    AND r.osm_submission_state = 'published';

  IF _result IS NULL THEN RAISE EXCEPTION 'Rapporten saknar en publicerad OSM-anteckning'; END IF;
  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_place_data_report_osm_status_v1(
  _report_id uuid,
  _public_reference text,
  _note_id bigint,
  _note_status text,
  _note_closed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _note_status NOT IN ('open', 'closed', 'hidden', 'unknown') THEN
    RAISE EXCEPTION 'Ogiltig OSM-status';
  END IF;

  UPDATE public.place_data_reports
  SET osm_note_status = _note_status,
      osm_note_last_checked_at = now(),
      osm_note_closed_at = _note_closed_at,
      updated_at = now()
  WHERE id = _report_id
    AND osm_public_reference = _public_reference
    AND osm_note_id = _note_id
    AND osm_submission_state = 'published';

  IF NOT FOUND THEN RAISE EXCEPTION 'OSM-statusen kunde inte kopplas till rapporten'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_group_place_data_reports_v2(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan granska platsdata';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'groupId', r.group_id,
        'placeId', r.place_id,
        'placeName', r.reported_name,
        'placeAddress', r.reported_address,
        'placeCity', r.reported_city,
        'placeWebsite', r.reported_website,
        'category', r.category,
        'description', r.description,
        'status', r.status,
        'reporterId', COALESCE(r.created_by::text, ''),
        'reporterName', COALESCE(NULLIF(trim(reporter.display_name), ''), 'Tidigare medlem'),
        'createdAt', r.created_at,
        'updatedAt', r.updated_at,
        'reviewedBy', r.reviewed_by,
        'reviewerName', NULLIF(trim(reviewer.display_name), ''),
        'reviewedAt', r.reviewed_at,
        'resolutionNote', r.resolution_note,
        'sources', r.reported_sources,
        'osmSubmissionState', r.osm_submission_state,
        'osmSubmissionErrorCode', r.osm_submission_error_code,
        'osmPublicText', r.osm_public_text,
        'osmNoteId', r.osm_note_id::text,
        'osmNoteUrl', r.osm_note_url,
        'osmNoteStatus', r.osm_note_status,
        'osmNoteCreatedAt', r.osm_note_created_at,
        'osmNoteLastCheckedAt', r.osm_note_last_checked_at,
        'osmNoteClosedAt', r.osm_note_closed_at
      )
      ORDER BY
        CASE r.status WHEN 'open' THEN 0 WHEN 'ready_for_osm' THEN 1 ELSE 2 END,
        r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM public.place_data_reports r
  LEFT JOIN public.profiles reporter ON reporter.id = r.created_by
  LEFT JOIN public.profiles reviewer ON reviewer.id = r.reviewed_by
  WHERE r.group_id = _group_id;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_place_data_report_osm_submission_v1(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_place_data_report_osm_submission_v1(uuid, uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_place_data_report_osm_refresh_v1(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_place_data_report_osm_refresh_v1(uuid, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.list_group_place_data_reports_v2(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_place_data_reports_v2(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.complete_place_data_report_osm_submission_v1(uuid, text, bigint, text, timestamptz, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_place_data_report_osm_submission_v1(uuid, text, bigint, text, timestamptz, timestamptz, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.fail_place_data_report_osm_submission_v1(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_place_data_report_osm_submission_v1(uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.update_place_data_report_osm_status_v1(uuid, text, bigint, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_place_data_report_osm_status_v1(uuid, text, bigint, text, timestamptz)
  TO service_role;

DO $do$
DECLARE
  _source text;
  _patched text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO _source
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'prepare_own_account_deletion';

  IF _source IS NULL THEN RAISE EXCEPTION 'prepare_own_account_deletion saknas'; END IF;

  IF position('osm_submitted_by = NULL' IN _source) = 0 THEN
    _patched := replace(
      _source,
      'WHERE reviewed_by = _uid;',
      'WHERE reviewed_by = _uid;' || E'\n\n' ||
      '  UPDATE public.place_data_reports' || E'\n' ||
      '  SET osm_submitted_by = NULL,' || E'\n' ||
      '      updated_at = now()' || E'\n' ||
      '  WHERE osm_submitted_by = _uid;'
    );

    IF _patched = _source THEN
      RAISE EXCEPTION 'Kontoraderingen kunde inte utökas för OSM-publicering';
    END IF;

    EXECUTE _patched;
  END IF;
END
$do$;

COMMIT;
