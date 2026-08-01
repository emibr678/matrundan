BEGIN;

-- Gruppprivata rapporter om felaktig platsdata. Rapporterna är ett internt
-- granskningsunderlag och publiceras inte externt i detta paket.
CREATE TABLE IF NOT EXISTS public.place_data_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE RESTRICT,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reported_name text NOT NULL,
  reported_address text NOT NULL DEFAULT '',
  reported_city text NOT NULL DEFAULT '',
  reported_website text,
  reported_lat double precision,
  reported_lng double precision,
  reported_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text,
  CONSTRAINT place_data_reports_category_check CHECK (
    category IN (
      'closed_or_replaced',
      'wrong_name',
      'wrong_address',
      'wrong_website',
      'duplicate',
      'other'
    )
  ),
  CONSTRAINT place_data_reports_status_check CHECK (
    status IN ('open', 'ready_for_osm', 'resolved', 'dismissed')
  ),
  CONSTRAINT place_data_reports_description_check CHECK (
    length(description) BETWEEN 10 AND 1000
  ),
  CONSTRAINT place_data_reports_resolution_note_check CHECK (
    resolution_note IS NULL OR length(resolution_note) <= 1000
  ),
  CONSTRAINT place_data_reports_sources_check CHECK (
    jsonb_typeof(reported_sources) = 'array'
  ),
  CONSTRAINT place_data_reports_coordinates_check CHECK (
    (reported_lat IS NULL) = (reported_lng IS NULL)
    AND (
      reported_lat IS NULL
      OR (
        reported_lat BETWEEN -90 AND 90
        AND reported_lng BETWEEN -180 AND 180
      )
    )
  )
);

ALTER TABLE public.place_data_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.place_data_reports FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS place_data_reports_group_status_idx
  ON public.place_data_reports(group_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS place_data_reports_place_idx
  ON public.place_data_reports(place_id, created_at DESC);

-- Ett dubbelklick eller upprepad inskickning ska inte skapa flera samtidiga
-- rapporter av samma typ från samma medlem. Andra gruppmedlemmar får däremot
-- lämna ett eget underlag om de har gjort en separat observation.
CREATE UNIQUE INDEX IF NOT EXISTS place_data_reports_active_reporter_issue_uidx
  ON public.place_data_reports(group_id, place_id, category, created_by)
  WHERE status IN ('open', 'ready_for_osm') AND created_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_place_data_report_v1(
  _group_id uuid,
  _place_id uuid,
  _category text,
  _description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _report_id uuid;
  _created boolean := false;
  _description_normalized text := regexp_replace(trim(COALESCE(_description, '')), '[[:space:]]+', ' ', 'g');
  _reported_name text;
  _reported_address text;
  _reported_city text;
  _reported_website text;
  _reported_lat double precision;
  _reported_lng double precision;
  _reported_sources jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _category NOT IN (
    'closed_or_replaced',
    'wrong_name',
    'wrong_address',
    'wrong_website',
    'duplicate',
    'other'
  ) THEN
    RAISE EXCEPTION 'Ogiltig typ av platsdatarapport';
  END IF;
  IF length(_description_normalized) < 10 OR length(_description_normalized) > 1000 THEN
    RAISE EXCEPTION 'Beskrivningen måste vara 10–1000 tecken';
  END IF;

  SELECT
    p.name,
    COALESCE(p.address, ''),
    COALESCE(p.city, ''),
    COALESCE(gp.website_override, p.website),
    p.lat,
    p.lng
  INTO
    _reported_name,
    _reported_address,
    _reported_city,
    _reported_website,
    _reported_lat,
    _reported_lng
  FROM public.group_places gp
  JOIN public.places p ON p.id = gp.place_id
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id;

  IF _reported_name IS NULL THEN
    RAISE EXCEPTION 'Matstället tillhör inte gruppen';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'provider', ps.provider,
        'providerPlaceId', ps.provider_place_id,
        'status', ps.status
      )
      ORDER BY
        CASE ps.status WHEN 'active' THEN 0 ELSE 1 END,
        ps.provider,
        ps.valid_from DESC
    ),
    '[]'::jsonb
  )
  INTO _reported_sources
  FROM public.place_sources ps
  WHERE ps.place_id = _place_id;

  INSERT INTO public.place_data_reports (
    group_id,
    place_id,
    category,
    description,
    status,
    reported_name,
    reported_address,
    reported_city,
    reported_website,
    reported_lat,
    reported_lng,
    reported_sources,
    created_by
  ) VALUES (
    _group_id,
    _place_id,
    _category,
    _description_normalized,
    'open',
    _reported_name,
    _reported_address,
    _reported_city,
    _reported_website,
    _reported_lat,
    _reported_lng,
    _reported_sources,
    _uid
  )
  ON CONFLICT (group_id, place_id, category, created_by)
    WHERE status IN ('open', 'ready_for_osm') AND created_by IS NOT NULL
  DO NOTHING
  RETURNING id INTO _report_id;

  IF _report_id IS NOT NULL THEN
    _created := true;
  ELSE
    SELECT r.id
    INTO _report_id
    FROM public.place_data_reports r
    WHERE r.group_id = _group_id
      AND r.place_id = _place_id
      AND r.category = _category
      AND r.created_by = _uid
      AND r.status IN ('open', 'ready_for_osm')
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object('id', _report_id, 'created', _created);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_group_place_data_reports_v1(_group_id uuid)
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
        'sources', r.reported_sources
      )
      ORDER BY
        CASE r.status
          WHEN 'open' THEN 0
          WHEN 'ready_for_osm' THEN 1
          ELSE 2
        END,
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

CREATE OR REPLACE FUNCTION public.review_place_data_report_v1(
  _group_id uuid,
  _report_id uuid,
  _status text,
  _resolution_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _note text := NULLIF(
    regexp_replace(trim(COALESCE(_resolution_note, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan granska platsdata';
  END IF;
  IF _status NOT IN ('open', 'ready_for_osm', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Ogiltig rapportstatus';
  END IF;
  IF _note IS NOT NULL AND length(_note) > 1000 THEN
    RAISE EXCEPTION 'Anteckningen får vara högst 1000 tecken';
  END IF;

  UPDATE public.place_data_reports
  SET status = _status,
      resolution_note = _note,
      reviewed_by = _uid,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = _report_id
    AND group_id = _group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rapporten finns inte i gruppen';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_place_data_report_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_place_data_report_v1(uuid, uuid, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.list_group_place_data_reports_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_place_data_reports_v1(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.review_place_data_report_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_place_data_report_v1(uuid, uuid, text, text)
  TO authenticated;

COMMIT;
