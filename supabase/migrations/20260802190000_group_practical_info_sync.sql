BEGIN;

-- v1.18.0: gruppspecifik webbplats och öppettid, säker källsnapshot samt
-- revisionshistorik. Befintliga platser, gruppkopplingar och besök bevaras.

ALTER TABLE public.group_places
  ADD COLUMN IF NOT EXISTS opening_hours_override jsonb,
  ADD COLUMN IF NOT EXISTS practical_info_source_url text,
  ADD COLUMN IF NOT EXISTS practical_info_source_note text,
  ADD COLUMN IF NOT EXISTS practical_info_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practical_info_updated_at timestamptz;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.group_places'::regclass
      AND conname = 'group_places_practical_info_source_url_check'
  ) THEN
    ALTER TABLE public.group_places
      ADD CONSTRAINT group_places_practical_info_source_url_check CHECK (
        practical_info_source_url IS NULL
        OR (
          length(practical_info_source_url) <= 2048
          AND practical_info_source_url ~* '^https?://[^[:space:]]+$'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.group_places'::regclass
      AND conname = 'group_places_practical_info_source_note_check'
  ) THEN
    ALTER TABLE public.group_places
      ADD CONSTRAINT group_places_practical_info_source_note_check CHECK (
        practical_info_source_note IS NULL
        OR length(practical_info_source_note) <= 1000
      );
  END IF;
END
$block$;

CREATE TABLE IF NOT EXISTS public.group_place_practical_info_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  website_override text,
  opening_hours_override jsonb,
  source_url text,
  source_note text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_place_practical_info_history_lookup_idx
  ON public.group_place_practical_info_history(group_id, place_id, changed_at DESC);

ALTER TABLE public.group_place_practical_info_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.group_place_practical_info_history FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.place_external_info_snapshots (
  place_id uuid PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_place_id text NOT NULL,
  website text,
  opening_hours jsonb,
  timezone text,
  fetched_at timestamptz NOT NULL,
  fingerprint text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS place_external_info_snapshots_provider_idx
  ON public.place_external_info_snapshots(provider, provider_place_id);

ALTER TABLE public.place_external_info_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.place_external_info_snapshots FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.valid_opening_hours_schedule_v1(_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT _value IS NULL OR (
    jsonb_typeof(_value) = 'object'
    AND jsonb_typeof(_value->'days') = 'array'
    AND jsonb_array_length(_value->'days') = 7
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_value->'days') AS day(value)
      WHERE jsonb_typeof(day.value) <> 'object'
        OR COALESCE(day.value->>'code', '') NOT IN ('Mo','Tu','We','Th','Fr','Sa','Su')
        OR jsonb_typeof(day.value->'intervals') <> 'array'
        OR jsonb_typeof(day.value->'closed') <> 'boolean'
        OR jsonb_typeof(day.value->'known') <> 'boolean'
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(day.value->'intervals') AS interval(value)
          WHERE length(interval.value) > 40
             OR interval.value !~ '^(Dygnet runt|([0-9]{1,2}(:[0-9]{2})?–[0-9]{1,2}(:[0-9]{2})?))$'
        )
    )
    AND (
      SELECT count(DISTINCT day.value->>'code')
      FROM jsonb_array_elements(_value->'days') AS day(value)
    ) = 7
    AND jsonb_typeof(COALESCE(_value->'partiallyParsed', 'false'::jsonb)) = 'boolean'
  );
$function$;

REVOKE ALL ON FUNCTION public.valid_opening_hours_schedule_v1(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_group_place_practical_info_v1(
  _group_id uuid,
  _place_id uuid,
  _website_override text DEFAULT NULL,
  _opening_hours_override jsonb DEFAULT NULL,
  _source_url text DEFAULT NULL,
  _source_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _website text := public.normalize_place_website(_website_override);
  _source_website text := public.normalize_place_website(_source_url);
  _source_note_normalized text := NULLIF(
    regexp_replace(trim(COALESCE(_source_note, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );
  _current public.group_places%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _website_override IS NOT NULL AND trim(_website_override) <> '' AND _website IS NULL THEN
    RAISE EXCEPTION 'Ange en giltig webbplats';
  END IF;
  IF _source_url IS NOT NULL AND trim(_source_url) <> '' AND _source_website IS NULL THEN
    RAISE EXCEPTION 'Ange en giltig källänk';
  END IF;
  IF NOT public.valid_opening_hours_schedule_v1(_opening_hours_override) THEN
    RAISE EXCEPTION 'Öppettiderna har ett ogiltigt format';
  END IF;
  IF _source_note_normalized IS NOT NULL AND length(_source_note_normalized) > 1000 THEN
    RAISE EXCEPTION 'Källanteckningen får vara högst 1000 tecken';
  END IF;
  IF (_website IS NOT NULL OR _opening_hours_override IS NOT NULL)
     AND _source_website IS NULL
     AND COALESCE(length(_source_note_normalized), 0) < 10 THEN
    RAISE EXCEPTION 'Ange en källänk eller en kort observation med minst 10 tecken';
  END IF;

  SELECT * INTO _current
  FROM public.group_places
  WHERE group_id = _group_id AND place_id = _place_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte i gruppen'; END IF;

  IF _current.website_override IS NOT DISTINCT FROM _website
     AND _current.opening_hours_override IS NOT DISTINCT FROM _opening_hours_override
     AND _current.practical_info_source_url IS NOT DISTINCT FROM _source_website
     AND _current.practical_info_source_note IS NOT DISTINCT FROM _source_note_normalized THEN
    RETURN;
  END IF;

  UPDATE public.group_places
  SET website_override = _website,
      opening_hours_override = _opening_hours_override,
      practical_info_source_url = _source_website,
      practical_info_source_note = _source_note_normalized,
      practical_info_updated_by = _uid,
      practical_info_updated_at = now(),
      updated_at = now()
  WHERE group_id = _group_id AND place_id = _place_id;

  INSERT INTO public.group_place_practical_info_history (
    group_id,
    place_id,
    website_override,
    opening_hours_override,
    source_url,
    source_note,
    changed_by
  ) VALUES (
    _group_id,
    _place_id,
    _website,
    _opening_hours_override,
    _source_website,
    _source_note_normalized,
    _uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_group_place_practical_info_v1(
  uuid, uuid, text, jsonb, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_place_practical_info_v1(
  uuid, uuid, text, jsonb, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_group_place_practical_info_history_v1(
  _group_id uuid,
  _place_id uuid,
  _limit integer DEFAULT 5
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
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_places
    WHERE group_id = _group_id AND place_id = _place_id
  ) THEN
    RAISE EXCEPTION 'Matstället finns inte i gruppen';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'changedAt' DESC), '[]'::jsonb)
  INTO _result
  FROM (
    SELECT jsonb_build_object(
      'id', h.id,
      'websiteOverride', h.website_override,
      'openingHoursOverride', h.opening_hours_override,
      'sourceUrl', h.source_url,
      'sourceNote', h.source_note,
      'changedByName', COALESCE(p.display_name, 'Tidigare medlem'),
      'changedAt', h.changed_at
    ) AS item
    FROM public.group_place_practical_info_history h
    LEFT JOIN public.profiles p ON p.id = h.changed_by
    WHERE h.group_id = _group_id
      AND h.place_id = _place_id
    ORDER BY h.changed_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 5), 1), 20)
  ) rows;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_group_place_practical_info_history_v1(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_place_practical_info_history_v1(uuid, uuid, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_place_external_info_context_v2(
  _group_id uuid,
  _place_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _provider_place_id text;
  _snapshot public.place_external_info_snapshots%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  SELECT ps.provider_place_id
  INTO _provider_place_id
  FROM public.group_places gp
  JOIN public.place_sources ps ON ps.place_id = gp.place_id
  WHERE gp.group_id = _group_id
    AND gp.place_id = _place_id
    AND ps.provider = 'geoapify'
    AND ps.status = 'active'
  ORDER BY ps.last_seen_at DESC, ps.valid_from DESC
  LIMIT 1;

  IF _provider_place_id IS NULL THEN
    RAISE EXCEPTION 'Matstället saknar en aktiv Geoapify-källa';
  END IF;

  SELECT * INTO _snapshot
  FROM public.place_external_info_snapshots
  WHERE place_id = _place_id
    AND provider = 'geoapify'
    AND provider_place_id = _provider_place_id;

  RETURN jsonb_build_object(
    'providerPlaceId', _provider_place_id,
    'snapshot', CASE WHEN _snapshot.place_id IS NULL THEN NULL ELSE jsonb_build_object(
      'openingHours', _snapshot.opening_hours,
      'website', _snapshot.website,
      'timezone', _snapshot.timezone,
      'fetchedAt', _snapshot.fetched_at,
      'attribution', 'Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.'
    ) END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_place_external_info_snapshot_v1(
  _group_id uuid,
  _place_id uuid,
  _provider_place_id text,
  _website text,
  _opening_hours jsonb,
  _timezone text,
  _fetched_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _website_normalized text := public.normalize_place_website(_website);
  _payload jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places gp
    JOIN public.place_sources ps ON ps.place_id = gp.place_id
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND ps.provider = 'geoapify'
      AND ps.provider_place_id = trim(_provider_place_id)
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matställets externa källa kunde inte verifieras';
  END IF;
  IF NOT public.valid_opening_hours_schedule_v1(_opening_hours) THEN
    RAISE EXCEPTION 'Öppettiderna har ett ogiltigt format';
  END IF;
  IF _fetched_at IS NULL OR _fetched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Ogiltig hämtningstid';
  END IF;

  _payload := jsonb_build_object(
    'website', _website_normalized,
    'openingHours', _opening_hours,
    'timezone', NULLIF(trim(COALESCE(_timezone, '')), '')
  );

  INSERT INTO public.place_external_info_snapshots (
    place_id,
    provider,
    provider_place_id,
    website,
    opening_hours,
    timezone,
    fetched_at,
    fingerprint,
    updated_at
  ) VALUES (
    _place_id,
    'geoapify',
    trim(_provider_place_id),
    _website_normalized,
    _opening_hours,
    NULLIF(trim(COALESCE(_timezone, '')), ''),
    _fetched_at,
    md5(_payload::text),
    now()
  )
  ON CONFLICT (place_id) DO UPDATE
  SET provider = EXCLUDED.provider,
      provider_place_id = EXCLUDED.provider_place_id,
      website = EXCLUDED.website,
      opening_hours = EXCLUDED.opening_hours,
      timezone = EXCLUDED.timezone,
      fetched_at = EXCLUDED.fetched_at,
      fingerprint = EXCLUDED.fingerprint,
      updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.get_place_external_info_context_v2(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_place_external_info_context_v2(uuid, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.save_place_external_info_snapshot_v1(
  uuid, uuid, text, text, jsonb, text, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_place_external_info_snapshot_v1(
  uuid, uuid, text, text, jsonb, text, timestamptz
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5g(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _places jsonb;
BEGIN
  _result := public.get_group_app_state_v5f(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      place_item.item
      || jsonb_build_object(
        'openingHoursOverride', gp.opening_hours_override,
        'practicalInfoSourceUrl', gp.practical_info_source_url,
        'practicalInfoSourceNote', gp.practical_info_source_note,
        'practicalInfoUpdatedAt', gp.practical_info_updated_at,
        'practicalInfoUpdatedBy', gp.practical_info_updated_by,
        'practicalInfoUpdatedByName', CASE
          WHEN gp.practical_info_updated_by IS NULL THEN NULL
          ELSE COALESCE(profile.display_name, 'Tidigare medlem')
        END
      )
      ORDER BY place_item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _places
  FROM jsonb_array_elements(COALESCE(_result->'places', '[]'::jsonb))
       WITH ORDINALITY AS place_item(item, ordinality)
  JOIN public.group_places gp
    ON gp.group_id = _group_id
   AND gp.place_id = (place_item.item->>'id')::uuid
  LEFT JOIN public.profiles profile
    ON profile.id = gp.practical_info_updated_by;

  RETURN jsonb_set(_result, '{places}', _places, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5g(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5g(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
