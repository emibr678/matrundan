BEGIN;

-- Paket B, Issues #156 + #155:
-- - låt fallbacken återanvända ett redan känt kanoniskt ställe utan att
--   exponera någon annan grupps privata data;
-- - skapa nya manuella platser först efter en server-side kandidatkontroll;
-- - skapa ett neutralt internt förbättringsunderlag för verifierade manuella
--   platser utan extern källa. Underlaget betyder inte "saknas i OSM".

ALTER TABLE public.place_data_reports
  DROP CONSTRAINT IF EXISTS place_data_reports_category_check;

ALTER TABLE public.place_data_reports
  ADD CONSTRAINT place_data_reports_category_check CHECK (
    category IN (
      'needs_source_match',
      'missing_in_osm',
      'closed_or_replaced',
      'wrong_name',
      'wrong_address',
      'wrong_website',
      'wrong_opening_hours',
      'duplicate',
      'other'
    )
  );

CREATE OR REPLACE FUNCTION public.normalize_place_match_text_v1(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        lower(replace(COALESCE(_value, ''), '&', ' och ')),
        '[^[:alnum:]åäö]+',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.normalize_place_match_text_v1(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_reusable_manual_place_candidates_v1(
  _group_id uuid,
  _name text,
  _address text,
  _city text,
  _lat double precision,
  _lng double precision,
  _category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _name_normalized text := public.normalize_place_match_text_v1(_name);
  _address_normalized text := public.normalize_place_match_text_v1(_address);
  _city_normalized text := public.normalize_place_match_text_v1(_city);
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF length(_name_normalized) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;
  IF _lat IS NULL OR _lng IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  IF _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Ogiltig kartposition';
  END IF;
  IF _category IS NOT NULL
     AND _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;

  WITH nearby AS (
    SELECT
      p.id,
      p.name,
      p.category,
      COALESCE(p.address, '') AS address,
      COALESCE(p.area, '') AS area,
      COALESCE(p.city, '') AS city,
      p.lat,
      p.lng,
      target_gp.collection_status AS target_collection_status,
      public.normalize_place_match_text_v1(p.name) AS candidate_name,
      public.normalize_place_match_text_v1(p.address) AS candidate_address,
      public.normalize_place_match_text_v1(p.city) AS candidate_city,
      2 * 6371 * asin(
        sqrt(
          least(
            1::double precision,
            greatest(
              0::double precision,
              power(sin(radians(_lat - p.lat) / 2), 2)
              + cos(radians(p.lat))
                * cos(radians(_lat))
                * power(sin(radians(_lng - p.lng) / 2), 2)
            )
          )
        )
      ) AS distance_km
    FROM public.places p
    LEFT JOIN public.group_places target_gp
      ON target_gp.group_id = _group_id
     AND target_gp.place_id = p.id
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.place_sources ps
        WHERE ps.place_id = p.id
          AND ps.status = 'active'
      )
  ), matched AS (
    SELECT
      n.*,
      (n.candidate_name = _name_normalized) AS same_name,
      (
        _address_normalized <> ''
        AND n.candidate_address <> ''
        AND n.candidate_address = _address_normalized
        AND (
          _city_normalized = ''
          OR n.candidate_city = ''
          OR n.candidate_city = _city_normalized
        )
      ) AS same_address,
      (
        length(n.candidate_name) >= 4
        AND length(_name_normalized) >= 4
        AND (
          n.candidate_name = _name_normalized
          OR n.candidate_name LIKE _name_normalized || ' %'
          OR _name_normalized LIKE n.candidate_name || ' %'
        )
      ) AS related_name
    FROM nearby n
    WHERE n.distance_km <= 0.15
  ), ranked AS (
    SELECT
      m.*,
      CASE
        WHEN m.same_name AND (m.same_address OR m.distance_km <= 0.05) THEN 'exact'
        ELSE 'similar'
      END AS match_kind
    FROM matched m
    WHERE
      (
        m.same_name
        AND (m.same_address OR m.distance_km <= 0.10)
      )
      OR (
        m.related_name
        AND m.distance_km <= 0.10
        AND (m.same_address OR m.distance_km <= 0.05)
      )
    ORDER BY
      CASE WHEN m.same_name AND (m.same_address OR m.distance_km <= 0.05) THEN 0 ELSE 1 END,
      m.distance_km,
      m.name
    LIMIT 5
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'placeId', r.id,
        'name', r.name,
        'category', r.category,
        'address', r.address,
        'area', NULLIF(r.area, ''),
        'city', r.city,
        'lat', r.lat,
        'lng', r.lng,
        'distanceKm', round(r.distance_km::numeric, 3),
        'matchKind', r.match_kind,
        'groupStatus', COALESCE(r.target_collection_status, 'not_linked')
      )
      ORDER BY
        CASE r.match_kind WHEN 'exact' THEN 0 ELSE 1 END,
        r.distance_km,
        r.name
    ),
    '[]'::jsonb
  )
  INTO _result
  FROM ranked r;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.find_reusable_manual_place_candidates_v1(
  uuid, text, text, text, double precision, double precision, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_reusable_manual_place_candidates_v1(
  uuid, text, text, text, double precision, double precision, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.link_reusable_manual_place_v1(
  _group_id uuid,
  _place_id uuid,
  _name text,
  _address text,
  _city text,
  _lat double precision,
  _lng double precision,
  _occasions text[] DEFAULT '{}',
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _candidate jsonb;
  _status text;
  _place_name text;
  _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  SELECT candidate
  INTO _candidate
  FROM jsonb_array_elements(
    public.find_reusable_manual_place_candidates_v1(
      _group_id, _name, _address, _city, _lat, _lng, NULL
    )
  ) AS candidate
  WHERE candidate->>'placeId' = _place_id::text
  LIMIT 1;

  IF _candidate IS NULL THEN
    RAISE EXCEPTION 'Matstället matchar inte längre tillräckligt säkert. Sök efter kandidater igen';
  END IF;

  SELECT gp.collection_status
  INTO _status
  FROM public.group_places gp
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id;

  SELECT p.name INTO _place_name
  FROM public.places p
  WHERE p.id = _place_id;

  IF _status = 'active' THEN
    RETURN jsonb_build_object('placeId', _place_id, 'status', 'existing');
  END IF;

  IF _status = 'archived' THEN
    UPDATE public.group_places
    SET collection_status = 'active',
        archived_at = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE group_id = _group_id
      AND place_id = _place_id;

    RETURN jsonb_build_object('placeId', _place_id, 'status', 'restored');
  END IF;

  INSERT INTO public.group_places (
    group_id,
    place_id,
    occasions,
    notes,
    added_by,
    origin,
    source_group_id
  ) VALUES (
    _group_id,
    _place_id,
    COALESCE(_occasions, ARRAY[]::text[]),
    NULLIF(trim(COALESCE(_notes, '')), ''),
    _uid,
    'manual',
    NULL
  );

  SELECT display_name INTO _actor_name
  FROM public.profiles
  WHERE id = _uid;

  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (
    _group_id,
    'added',
    _uid,
    _place_id,
    jsonb_build_object(
      'text', COALESCE(NULLIF(trim(_actor_name), ''), 'Någon')
        || ' la till ' || COALESCE(_place_name, 'ett matställe')
    )
  );

  RETURN jsonb_build_object('placeId', _place_id, 'status', 'linked');
END;
$function$;

REVOKE ALL ON FUNCTION public.link_reusable_manual_place_v1(
  uuid, uuid, text, text, text, double precision, double precision, text[], text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_reusable_manual_place_v1(
  uuid, uuid, text, text, text, double precision, double precision, text[], text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_manual_place_fallback_v1(
  _group_id uuid,
  _name text,
  _category text,
  _cuisines text[] DEFAULT '{}',
  _occasions text[] DEFAULT '{}',
  _address text DEFAULT '',
  _area text DEFAULT NULL,
  _city text DEFAULT '',
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _notes text DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _declined_place_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid;
  _candidates jsonb := '[]'::jsonb;
  _unresolved_candidate_count integer := 0;
  _normalized_name text := public.normalize_place_match_text_v1(_name);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF length(_normalized_name) < 2 THEN RAISE EXCEPTION 'Namn krävs'; END IF;
  IF _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;
  IF (_lat IS NULL) <> (_lng IS NULL) THEN
    RAISE EXCEPTION 'Både latitud och longitud krävs';
  END IF;
  IF _lat IS NOT NULL AND (_lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Ogiltig kartposition';
  END IF;

  IF _lat IS NOT NULL THEN
    -- Geografiskt lås minskar risken att två parallella fallback-skapanden för
    -- samma verkliga plats passerar kandidatkontrollen samtidigt, även om
    -- namnen skiljer lite.
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'manual-place-cell:'
          || round(_lat::numeric, 4)::text || ':'
          || round(_lng::numeric, 4)::text,
        0
      )
    );

    _candidates := public.find_reusable_manual_place_candidates_v1(
      _group_id,
      _name,
      _address,
      _city,
      _lat,
      _lng,
      _category
    );

    SELECT count(*)
    INTO _unresolved_candidate_count
    FROM jsonb_array_elements(_candidates) AS candidate
    WHERE NOT (
      (candidate->>'placeId')::uuid = ANY(COALESCE(_declined_place_ids, ARRAY[]::uuid[]))
    );

    IF _unresolved_candidate_count > 0 THEN
      RAISE EXCEPTION 'REUSABLE_PLACE_FOUND';
    END IF;
  END IF;

  _place_id := public.create_place_v4b(
    _group_id,
    _name,
    _category,
    COALESCE(_cuisines, ARRAY[]::text[]),
    COALESCE(_occasions, ARRAY[]::text[]),
    COALESCE(_address, ''),
    NULLIF(trim(COALESCE(_area, '')), ''),
    COALESCE(_city, ''),
    _lat,
    _lng,
    NULLIF(trim(COALESCE(_notes, '')), ''),
    _photo_url
  );

  IF _lat IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.place_sources ps
       WHERE ps.place_id = _place_id
         AND ps.status = 'active'
     ) THEN
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
    )
    SELECT
      _group_id,
      _place_id,
      'needs_source_match',
      'Manuellt tillagt matställe med verifierad plats saknar aktiv extern källkoppling och behöver matchas eller granskas.',
      'open',
      p.name,
      COALESCE(p.address, ''),
      COALESCE(p.city, ''),
      p.website,
      p.lat,
      p.lng,
      '[]'::jsonb,
      _uid
    FROM public.places p
    WHERE p.id = _place_id
    ON CONFLICT (group_id, place_id, category, created_by)
      WHERE status IN ('open', 'ready_for_osm') AND created_by IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'placeId', _place_id,
    'improvementCandidate', _lat IS NOT NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_manual_place_fallback_v1(
  uuid, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, uuid[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_place_fallback_v1(
  uuid, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, uuid[]
) TO authenticated;

-- Den neutrala systemkategorin får granskas och avslutas, men aldrig markeras
-- som direkt redo för OSM. Om granskningen visar ett verkligt OSM-fel skapas
-- ett vanligt underlag av rätt kategori i ett separat, uttryckligt steg.
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
  _category text;
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

  SELECT category INTO _category
  FROM public.place_data_reports
  WHERE id = _report_id
    AND group_id = _group_id;

  IF _category IS NULL THEN
    RAISE EXCEPTION 'Rapporten finns inte i gruppen';
  END IF;
  IF _category = 'needs_source_match' AND _status = 'ready_for_osm' THEN
    RAISE EXCEPTION 'Det neutrala matchningsunderlaget måste först verifieras som ett konkret platsdatafel';
  END IF;

  UPDATE public.place_data_reports
  SET status = _status,
      resolution_note = _note,
      reviewed_by = _uid,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = _report_id
    AND group_id = _group_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_place_data_report_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_place_data_report_v1(uuid, uuid, text, text)
  TO authenticated;

COMMIT;
