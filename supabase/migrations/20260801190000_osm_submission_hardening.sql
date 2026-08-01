BEGIN;

-- Varje faktiskt publiceringsförsök loggas append-only. Dygnskvoter ska inte
-- kunna kringgås genom att ett misslyckat försök senare får statusen failed.
CREATE TABLE IF NOT EXISTS public.place_data_report_osm_submission_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.place_data_reports(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attempt_number integer NOT NULL,
  public_reference text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_data_report_osm_attempt_number_check CHECK (attempt_number > 0),
  CONSTRAINT place_data_report_osm_attempt_reference_check CHECK (
    public_reference ~ '^MR-[A-Z0-9]{10}$'
  ),
  CONSTRAINT place_data_report_osm_attempt_report_number_uidx UNIQUE (
    report_id,
    attempt_number
  )
);

ALTER TABLE public.place_data_report_osm_submission_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.place_data_report_osm_submission_attempts
  FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS place_data_report_osm_attempts_submitter_idx
  ON public.place_data_report_osm_submission_attempts(submitted_by, attempted_at DESC)
  WHERE submitted_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS place_data_report_osm_attempts_group_idx
  ON public.place_data_report_osm_submission_attempts(group_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS place_data_report_osm_attempts_report_idx
  ON public.place_data_report_osm_submission_attempts(report_id, attempted_at DESC);

-- Bevara redan registrerade försök från tiden före den append-only loggen.
INSERT INTO public.place_data_report_osm_submission_attempts (
  report_id,
  group_id,
  submitted_by,
  attempt_number,
  public_reference,
  attempted_at
)
SELECT
  r.id,
  r.group_id,
  r.osm_submitted_by,
  attempt_number,
  COALESCE(
    r.osm_public_reference,
    'MR-' || upper(substr(md5(r.id::text || ':' || attempt_number::text), 1, 10))
  ),
  COALESCE(r.osm_submission_started_at, r.updated_at, r.created_at, now())
FROM public.place_data_reports r
CROSS JOIN LATERAL generate_series(1, r.osm_submission_attempts) AS attempt_number
WHERE r.osm_submission_attempts > 0
ON CONFLICT (report_id, attempt_number) DO NOTHING;

CREATE OR REPLACE FUNCTION public.resolve_missing_in_osm_reports_for_active_source_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(trim(COALESCE(NEW.provider, ''))) <> 'openstreetmap'
     OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Lås berörda rapporter så källkoppling och OSM-publicering inte kan passera
  -- varandra i två samtidiga transaktioner.
  PERFORM 1
  FROM public.place_data_reports r
  WHERE r.place_id = NEW.place_id
    AND r.category = 'missing_in_osm'
    AND r.osm_note_id IS NULL
    AND r.status IN ('open', 'ready_for_osm')
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.place_data_reports r
    WHERE r.place_id = NEW.place_id
      AND r.category = 'missing_in_osm'
      AND r.osm_note_id IS NULL
      AND r.status IN ('open', 'ready_for_osm')
      AND r.osm_submission_state = 'submitting'
      AND r.osm_submission_started_at > now() - interval '5 minutes'
  ) THEN
    RAISE EXCEPTION
      'En OSM-publicering pågår för matstället. Vänta tills den är klar innan källan länkas';
  END IF;

  UPDATE public.place_data_reports
  SET status = 'resolved',
      resolution_note = 'OpenStreetMap-källan är nu länkad till matstället. Ingen OSM-anteckning behöver publiceras.',
      reviewed_at = COALESCE(reviewed_at, now()),
      osm_submission_state = 'not_submitted',
      osm_submission_started_at = NULL,
      osm_submission_error_code = NULL,
      updated_at = now()
  WHERE place_id = NEW.place_id
    AND category = 'missing_in_osm'
    AND osm_note_id IS NULL
    AND status IN ('open', 'ready_for_osm')
    AND (
      osm_submission_state IN ('not_submitted', 'failed')
      OR (
        osm_submission_state = 'submitting'
        AND osm_submission_started_at <= now() - interval '5 minutes'
      )
    );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS place_sources_resolve_missing_in_osm_reports
  ON public.place_sources;
CREATE TRIGGER place_sources_resolve_missing_in_osm_reports
BEFORE INSERT OR UPDATE OF provider, status
ON public.place_sources
FOR EACH ROW
EXECUTE FUNCTION public.resolve_missing_in_osm_reports_for_active_source_v1();

-- Rätta eventuella redan inaktuella, ännu opublicerade underlag från tiden före
-- triggern. Publicerade OSM-anteckningar lämnas orörda som historik.
UPDATE public.place_data_reports r
SET status = 'resolved',
    resolution_note = 'OpenStreetMap-källan är nu länkad till matstället. Ingen OSM-anteckning behöver publiceras.',
    reviewed_at = COALESCE(r.reviewed_at, now()),
    osm_submission_state = 'not_submitted',
    osm_submission_started_at = NULL,
    osm_submission_error_code = NULL,
    updated_at = now()
WHERE r.category = 'missing_in_osm'
  AND r.osm_note_id IS NULL
  AND r.status IN ('open', 'ready_for_osm')
  AND NOT (
    r.osm_submission_state = 'submitting'
    AND r.osm_submission_started_at > now() - interval '5 minutes'
  )
  AND EXISTS (
    SELECT 1
    FROM public.place_sources ps
    WHERE ps.place_id = r.place_id
      AND ps.provider = 'openstreetmap'
      AND ps.status = 'active'
  );

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
  _attempt_number integer;
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

  IF _report.category = 'missing_in_osm'
     AND EXISTS (
       SELECT 1
       FROM public.place_sources ps
       WHERE ps.place_id = _report.place_id
         AND ps.provider = 'openstreetmap'
         AND ps.status = 'active'
     ) THEN
    RAISE EXCEPTION
      'Matstället har redan en aktiv OpenStreetMap-koppling. Rapporten ska inte publiceras';
  END IF;

  IF (
    SELECT count(*)
    FROM public.place_data_report_osm_submission_attempts a
    WHERE a.submitted_by = _uid
      AND a.attempted_at >= now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'Högst 10 OSM-anteckningar kan publiceras per person och dygn';
  END IF;

  IF (
    SELECT count(*)
    FROM public.place_data_report_osm_submission_attempts a
    WHERE a.group_id = _group_id
      AND a.attempted_at >= now() - interval '24 hours'
  ) >= 25 THEN
    RAISE EXCEPTION 'Gruppen har nått dygnsgränsen för OSM-anteckningar';
  END IF;

  _reference := COALESCE(
    _report.osm_public_reference,
    'MR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
  _attempt_number := _report.osm_submission_attempts + 1;

  INSERT INTO public.place_data_report_osm_submission_attempts (
    report_id,
    group_id,
    submitted_by,
    attempt_number,
    public_reference,
    attempted_at
  ) VALUES (
    _report_id,
    _group_id,
    _uid,
    _attempt_number,
    _reference,
    now()
  );

  UPDATE public.place_data_reports
  SET osm_submission_state = 'submitting',
      osm_submission_started_at = now(),
      osm_submission_attempts = _attempt_number,
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

REVOKE ALL ON FUNCTION public.prepare_place_data_report_osm_submission_v1(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_place_data_report_osm_submission_v1(uuid, uuid, text)
  TO authenticated;

-- Självbetjänad kontoradering ska även anonymisera den append-only loggen.
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

  IF _source IS NULL THEN
    RAISE EXCEPTION 'prepare_own_account_deletion saknas';
  END IF;

  IF position('place_data_report_osm_submission_attempts' IN _source) = 0 THEN
    _patched := replace(
      _source,
      'WHERE osm_submitted_by = _uid;',
      'WHERE osm_submitted_by = _uid;' || E'\n\n' ||
      '  UPDATE public.place_data_report_osm_submission_attempts' || E'\n' ||
      '  SET submitted_by = NULL' || E'\n' ||
      '  WHERE submitted_by = _uid;'
    );

    IF _patched = _source THEN
      RAISE EXCEPTION 'Kontoraderingen kunde inte utökas för OSM-försöksloggen';
    END IF;

    EXECUTE _patched;
  END IF;
END
$do$;

COMMIT;
