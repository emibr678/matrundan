BEGIN;

-- v1.15.0: en sökträff ska kunna rapporteras innan den läggs till i gruppen.
-- Rapporten är fortsatt gruppprivat och identifieras exakt med provider +
-- provider_place_id. Ingen kanonisk platsrad skapas enbart för rapportering.

ALTER TABLE public.place_data_reports
  ALTER COLUMN place_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS target_provider text,
  ADD COLUMN IF NOT EXISTS target_provider_place_id text;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_data_reports'::regclass
      AND conname = 'place_data_reports_target_check'
  ) THEN
    ALTER TABLE public.place_data_reports
      ADD CONSTRAINT place_data_reports_target_check CHECK (
        (
          place_id IS NOT NULL
          AND target_provider IS NULL
          AND target_provider_place_id IS NULL
        )
        OR
        (
          place_id IS NULL
          AND length(trim(COALESCE(target_provider, ''))) BETWEEN 1 AND 40
          AND length(trim(COALESCE(target_provider_place_id, ''))) BETWEEN 1 AND 500
        )
      );
  END IF;
END
$block$;

CREATE UNIQUE INDEX IF NOT EXISTS place_data_reports_active_provider_issue_uidx
  ON public.place_data_reports(
    group_id,
    target_provider,
    target_provider_place_id,
    category,
    created_by
  )
  WHERE place_id IS NULL
    AND status IN ('open', 'ready_for_osm')
    AND created_by IS NOT NULL;

ALTER TABLE public.group_hidden_place_suggestions
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS website text;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.group_hidden_place_suggestions'::regclass
      AND conname = 'group_hidden_place_suggestions_coordinates_check'
  ) THEN
    ALTER TABLE public.group_hidden_place_suggestions
      ADD CONSTRAINT group_hidden_place_suggestions_coordinates_check CHECK (
        (lat IS NULL) = (lng IS NULL)
        AND (
          lat IS NULL
          OR (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.group_hidden_place_suggestions'::regclass
      AND conname = 'group_hidden_place_suggestions_website_check'
  ) THEN
    ALTER TABLE public.group_hidden_place_suggestions
      ADD CONSTRAINT group_hidden_place_suggestions_website_check CHECK (
        website IS NULL
        OR (
          length(website) <= 2048
          AND website ~* '^https?://[^[:space:]]+$'
        )
      );
  END IF;
END
$block$;

CREATE OR REPLACE FUNCTION public.create_place_data_report_from_suggestion_v1(
  _group_id uuid,
  _provider text,
  _provider_place_id text,
  _name text,
  _address text,
  _city text,
  _website text,
  _lat double precision,
  _lng double precision,
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
  _provider_normalized text := lower(trim(COALESCE(_provider, '')));
  _provider_place_id_normalized text := trim(COALESCE(_provider_place_id, ''));
  _name_normalized text := trim(COALESCE(_name, ''));
  _address_normalized text := trim(COALESCE(_address, ''));
  _city_normalized text := trim(COALESCE(_city, ''));
  _website_normalized text := NULLIF(trim(COALESCE(_website, '')), '');
  _description_normalized text := regexp_replace(trim(COALESCE(_description, '')), '[[:space:]]+', ' ', 'g');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF length(_provider_normalized) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Ogiltig platsleverantör';
  END IF;
  IF length(_provider_place_id_normalized) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Sökträffen saknar ett giltigt provider-ID';
  END IF;
  IF length(_name_normalized) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Sökträffen saknar ett giltigt namn';
  END IF;
  IF length(_address_normalized) > 300 OR length(_city_normalized) > 180 THEN
    RAISE EXCEPTION 'Platsinformationen är för lång';
  END IF;
  IF (_lat IS NULL) <> (_lng IS NULL)
     OR (_lat IS NOT NULL AND (_lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180)) THEN
    RAISE EXCEPTION 'Sökträffen har en ogiltig kartposition';
  END IF;
  IF _website_normalized IS NOT NULL
     AND (
       length(_website_normalized) > 2048
       OR _website_normalized !~* '^https?://[^[:space:]]+$'
     ) THEN
    RAISE EXCEPTION 'Sökträffen har en ogiltig webbplats';
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

  INSERT INTO public.place_data_reports (
    group_id,
    place_id,
    target_provider,
    target_provider_place_id,
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
    NULL,
    _provider_normalized,
    _provider_place_id_normalized,
    _category,
    _description_normalized,
    'open',
    _name_normalized,
    _address_normalized,
    _city_normalized,
    _website_normalized,
    _lat,
    _lng,
    jsonb_build_array(
      jsonb_build_object(
        'provider', _provider_normalized,
        'providerPlaceId', _provider_place_id_normalized,
        'status', 'active'
      )
    ),
    _uid
  )
  ON CONFLICT (
    group_id,
    target_provider,
    target_provider_place_id,
    category,
    created_by
  )
    WHERE place_id IS NULL
      AND status IN ('open', 'ready_for_osm')
      AND created_by IS NOT NULL
  DO NOTHING
  RETURNING id INTO _report_id;

  IF _report_id IS NOT NULL THEN
    _created := true;
  ELSE
    SELECT r.id
    INTO _report_id
    FROM public.place_data_reports r
    WHERE r.group_id = _group_id
      AND r.place_id IS NULL
      AND r.target_provider = _provider_normalized
      AND r.target_provider_place_id = _provider_place_id_normalized
      AND r.category = _category
      AND r.created_by = _uid
      AND r.status IN ('open', 'ready_for_osm')
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object('id', _report_id, 'created', _created);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_group_place_data_reports_v3(_group_id uuid)
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
        'targetKind', CASE WHEN r.place_id IS NULL THEN 'suggestion' ELSE 'place' END,
        'placeId', r.place_id,
        'provider', r.target_provider,
        'providerPlaceId', r.target_provider_place_id,
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

CREATE OR REPLACE FUNCTION public.list_group_hidden_place_suggestions_v2(_group_id uuid)
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
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar åtkomst till gruppen';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'provider', h.provider,
        'providerPlaceId', h.provider_place_id,
        'name', h.name,
        'category', h.category,
        'address', h.address,
        'area', h.area,
        'city', h.city,
        'lat', h.lat,
        'lng', h.lng,
        'website', h.website,
        'hiddenAt', h.hidden_at
      )
      ORDER BY h.hidden_at DESC, h.name
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM public.group_hidden_place_suggestions h
  WHERE h.group_id = _group_id;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hide_group_place_suggestion_v2(
  _group_id uuid,
  _provider text,
  _provider_place_id text,
  _name text,
  _category text,
  _address text,
  _area text,
  _city text,
  _lat double precision,
  _lng double precision,
  _website text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _provider_normalized text := lower(trim(COALESCE(_provider, '')));
  _provider_place_id_normalized text := trim(COALESCE(_provider_place_id, ''));
  _name_normalized text := trim(COALESCE(_name, ''));
  _website_normalized text := NULLIF(trim(COALESCE(_website, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan dölja sökträffar';
  END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF length(_provider_normalized) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Ogiltig platsleverantör';
  END IF;
  IF length(_provider_place_id_normalized) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Platsen saknar ett giltigt provider-ID';
  END IF;
  IF length(_name_normalized) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Platsen saknar ett giltigt namn';
  END IF;
  IF length(COALESCE(_category, '')) > 80
     OR length(COALESCE(_address, '')) > 300
     OR length(COALESCE(_area, '')) > 180
     OR length(COALESCE(_city, '')) > 180 THEN
    RAISE EXCEPTION 'Platsinformationen är för lång';
  END IF;
  IF (_lat IS NULL) <> (_lng IS NULL)
     OR (_lat IS NOT NULL AND (_lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180)) THEN
    RAISE EXCEPTION 'Sökträffen har en ogiltig kartposition';
  END IF;
  IF _website_normalized IS NOT NULL
     AND (
       length(_website_normalized) > 2048
       OR _website_normalized !~* '^https?://[^[:space:]]+$'
     ) THEN
    RAISE EXCEPTION 'Sökträffen har en ogiltig webbplats';
  END IF;

  INSERT INTO public.group_hidden_place_suggestions (
    group_id,
    provider,
    provider_place_id,
    name,
    category,
    address,
    area,
    city,
    lat,
    lng,
    website,
    hidden_by,
    hidden_at
  ) VALUES (
    _group_id,
    _provider_normalized,
    _provider_place_id_normalized,
    _name_normalized,
    NULLIF(trim(COALESCE(_category, '')), ''),
    trim(COALESCE(_address, '')),
    NULLIF(trim(COALESCE(_area, '')), ''),
    trim(COALESCE(_city, '')),
    _lat,
    _lng,
    _website_normalized,
    _uid,
    now()
  )
  ON CONFLICT (group_id, provider, provider_place_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    address = EXCLUDED.address,
    area = EXCLUDED.area,
    city = EXCLUDED.city,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    website = EXCLUDED.website,
    hidden_by = EXCLUDED.hidden_by,
    hidden_at = EXCLUDED.hidden_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_place_data_report_from_suggestion_v1(
  uuid, text, text, text, text, text, text, double precision, double precision, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_place_data_report_from_suggestion_v1(
  uuid, text, text, text, text, text, text, double precision, double precision, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.list_group_place_data_reports_v3(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_place_data_reports_v3(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.list_group_hidden_place_suggestions_v2(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_hidden_place_suggestions_v2(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.hide_group_place_suggestion_v2(
  uuid, text, text, text, text, text, text, text, double precision, double precision, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_group_place_suggestion_v2(
  uuid, text, text, text, text, text, text, text, double precision, double precision, text
) TO authenticated;

COMMIT;
