BEGIN;

-- Platsdatagrund: webbplats på kanoniska ställen, gruppspecifik override och
-- tidsbegränsade externa källkopplingar. Befintliga ställen, gruppkopplingar
-- och all besökshistorik bevaras.

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS website text;

ALTER TABLE public.group_places
  ADD COLUMN IF NOT EXISTS website_override text;

ALTER TABLE public.place_sources
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_to timestamptz;

UPDATE public.place_sources
SET first_seen_at = COALESCE(first_seen_at, fetched_at, now()),
    last_seen_at = COALESCE(last_seen_at, fetched_at, now()),
    valid_from = COALESCE(valid_from, fetched_at, now())
WHERE first_seen_at IS NULL
   OR last_seen_at IS NULL
   OR valid_from IS NULL;

ALTER TABLE public.place_sources
  ALTER COLUMN first_seen_at SET DEFAULT now(),
  ALTER COLUMN first_seen_at SET NOT NULL,
  ALTER COLUMN last_seen_at SET DEFAULT now(),
  ALTER COLUMN last_seen_at SET NOT NULL,
  ALTER COLUMN valid_from SET DEFAULT now(),
  ALTER COLUMN valid_from SET NOT NULL;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.places'::regclass
      AND conname = 'places_website_http_check'
  ) THEN
    ALTER TABLE public.places
      ADD CONSTRAINT places_website_http_check
      CHECK (
        website IS NULL
        OR (length(website) <= 2048 AND website ~* '^https?://[^[:space:]]+$')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.group_places'::regclass
      AND conname = 'group_places_website_override_http_check'
  ) THEN
    ALTER TABLE public.group_places
      ADD CONSTRAINT group_places_website_override_http_check
      CHECK (
        website_override IS NULL
        OR (
          length(website_override) <= 2048
          AND website_override ~* '^https?://[^[:space:]]+$'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_sources'::regclass
      AND conname = 'place_sources_status_check'
  ) THEN
    ALTER TABLE public.place_sources
      ADD CONSTRAINT place_sources_status_check
      CHECK (status IN ('active', 'superseded'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.place_sources'::regclass
      AND conname = 'place_sources_valid_period_check'
  ) THEN
    ALTER TABLE public.place_sources
      ADD CONSTRAINT place_sources_valid_period_check
      CHECK (valid_to IS NULL OR valid_to >= valid_from);
  END IF;
END
$block$;

-- Den gamla globala unikheten ersätts av en unik aktiv koppling. Därmed kan
-- samma leverantörsobjekt bevaras historiskt när verksamheten på platsen byts.
DO $block$
DECLARE
  _constraint record;
  _index record;
BEGIN
  FOR _constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.place_sources'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ~* 'UNIQUE[[:space:]]*\([[:space:]]*provider[[:space:]]*,[[:space:]]*provider_place_id[[:space:]]*\)'
  LOOP
    EXECUTE format('ALTER TABLE public.place_sources DROP CONSTRAINT %I', _constraint.conname);
  END LOOP;

  FOR _index IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'place_sources'
      AND indexdef ~* '^CREATE UNIQUE INDEX'
      AND indexdef ~* '\([[:space:]]*provider[[:space:]]*,[[:space:]]*provider_place_id[[:space:]]*\)'
      AND indexname <> 'place_sources_active_provider_identity_uidx'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', _index.indexname);
  END LOOP;
END
$block$;

CREATE UNIQUE INDEX IF NOT EXISTS place_sources_active_provider_identity_uidx
  ON public.place_sources(provider, provider_place_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS place_sources_place_status_idx
  ON public.place_sources(place_id, status, last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.normalize_place_website(_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _candidate text := trim(COALESCE(_value, ''));
BEGIN
  IF _candidate = '' OR length(_candidate) > 2048 OR _candidate ~ '[[:space:]]' THEN
    RETURN NULL;
  END IF;

  IF _candidate !~* '^[a-z][a-z0-9+.-]*:' THEN
    _candidate := 'https://' || _candidate;
  END IF;

  IF _candidate !~* '^https?://[^/@[:space:]]+(:[0-9]+)?([/?#].*)?$' THEN
    RETURN NULL;
  END IF;

  RETURN regexp_replace(_candidate, '#.*$', '');
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_place_website(text) FROM PUBLIC, anon, authenticated;

-- Fyll kanonisk webbplats från redan begränsad provider-metadata när den är
-- giltig. Befintliga manuella värden skrivs aldrig över.
WITH website_candidates AS (
  SELECT DISTINCT ON (ps.place_id)
    ps.place_id,
    public.normalize_place_website(ps.raw->>'website') AS website
  FROM public.place_sources ps
  WHERE public.normalize_place_website(ps.raw->>'website') IS NOT NULL
  ORDER BY
    ps.place_id,
    (ps.status = 'active') DESC,
    ps.last_seen_at DESC,
    ps.fetched_at DESC
)
UPDATE public.places p
SET website = candidate.website
FROM website_candidates candidate
WHERE p.id = candidate.place_id
  AND p.website IS NULL;

-- Separera OSM-identiteten från Geoapifys place_id när metadata redan finns.
WITH osm_candidates AS (
  SELECT
    ps.place_id,
    CASE lower(trim(COALESCE(ps.raw->>'osmType', ps.raw->>'osm_type', '')))
      WHEN 'n' THEN 'node'
      WHEN 'node' THEN 'node'
      WHEN 'w' THEN 'way'
      WHEN 'way' THEN 'way'
      WHEN 'r' THEN 'relation'
      WHEN 'relation' THEN 'relation'
      ELSE NULL
    END AS osm_type,
    trim(COALESCE(ps.raw->>'osmId', ps.raw->>'osm_id', '')) AS osm_id,
    ps.first_seen_at,
    ps.last_seen_at,
    ps.valid_from
  FROM public.place_sources ps
  WHERE ps.provider = 'geoapify'
    AND ps.status = 'active'
), valid_osm_candidates AS (
  SELECT *
  FROM osm_candidates
  WHERE osm_type IS NOT NULL
    AND osm_id ~ '^[1-9][0-9]*$'
)
INSERT INTO public.place_sources (
  place_id,
  provider,
  provider_place_id,
  raw,
  status,
  first_seen_at,
  last_seen_at,
  valid_from,
  valid_to
)
SELECT
  candidate.place_id,
  'openstreetmap',
  candidate.osm_type || ':' || candidate.osm_id,
  '{}'::jsonb,
  'active',
  candidate.first_seen_at,
  candidate.last_seen_at,
  candidate.valid_from,
  NULL
FROM valid_osm_candidates candidate
ON CONFLICT (provider, provider_place_id) WHERE status = 'active'
DO UPDATE SET
  last_seen_at = GREATEST(public.place_sources.last_seen_at, EXCLUDED.last_seen_at);

CREATE OR REPLACE FUNCTION public.create_or_link_provider_place_v5f(
  _group_id uuid,
  _provider text,
  _provider_place_id text,
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
  _raw jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _osm_pid uuid;
  _collection_status text;
  _actor_name text;
  _provider_normalized text := lower(trim(COALESCE(_provider, '')));
  _provider_id_normalized text := trim(COALESCE(_provider_place_id, ''));
  _website text := public.normalize_place_website(_raw->>'website');
  _osm_type text;
  _osm_id text := trim(COALESCE(_raw->>'osmId', _raw->>'osm_id', ''));
  _osm_source_id text;
  _occasion text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;
  IF _provider_normalized <> 'geoapify' OR _provider_id_normalized = '' THEN
    RAISE EXCEPTION 'Okänd eller ofullständig platsleverantör';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Namn krävs'; END IF;
  IF _category NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn') THEN
    RAISE EXCEPTION 'Ogiltig kategori';
  END IF;

  FOREACH _occasion IN ARRAY COALESCE(_occasions, ARRAY[]::text[])
  LOOP
    IF _occasion NOT IN ('snabbt','avslappnat','middag') THEN
      RAISE EXCEPTION 'Ogiltig etikett för Passar för';
    END IF;
  END LOOP;

  _osm_type := CASE lower(trim(COALESCE(_raw->>'osmType', _raw->>'osm_type', '')))
    WHEN 'n' THEN 'node'
    WHEN 'node' THEN 'node'
    WHEN 'w' THEN 'way'
    WHEN 'way' THEN 'way'
    WHEN 'r' THEN 'relation'
    WHEN 'relation' THEN 'relation'
    ELSE NULL
  END;
  IF _osm_type IS NULL OR _osm_id !~ '^[1-9][0-9]*$' THEN
    _osm_type := NULL;
    _osm_id := '';
  ELSE
    _osm_source_id := _osm_type || ':' || _osm_id;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_provider_normalized || ':' || _provider_id_normalized, 0)
  );

  SELECT ps.place_id
  INTO _pid
  FROM public.place_sources ps
  WHERE ps.provider = _provider_normalized
    AND ps.provider_place_id = _provider_id_normalized
    AND ps.status = 'active'
  LIMIT 1;

  IF _pid IS NULL THEN
    INSERT INTO public.places (
      name,
      category,
      cuisines,
      address,
      area,
      city,
      lat,
      lng,
      website,
      photo_url,
      added_by
    ) VALUES (
      trim(_name),
      _category,
      public.normalize_food_tags(COALESCE(_cuisines, ARRAY[]::text[])),
      COALESCE(trim(_address), ''),
      NULLIF(trim(COALESCE(_area, '')), ''),
      COALESCE(trim(_city), ''),
      _lat,
      _lng,
      _website,
      _photo_url,
      _uid
    )
    RETURNING id INTO _pid;

    INSERT INTO public.place_sources (
      place_id,
      provider,
      provider_place_id,
      raw,
      status,
      first_seen_at,
      last_seen_at,
      valid_from,
      valid_to
    ) VALUES (
      _pid,
      _provider_normalized,
      _provider_id_normalized,
      COALESCE(_raw, '{}'::jsonb),
      'active',
      now(),
      now(),
      now(),
      NULL
    );
  ELSE
    UPDATE public.place_sources
    SET raw = COALESCE(_raw, '{}'::jsonb),
        fetched_at = now(),
        last_seen_at = now()
    WHERE provider = _provider_normalized
      AND provider_place_id = _provider_id_normalized
      AND status = 'active';

    UPDATE public.places
    SET website = COALESCE(website, _website)
    WHERE id = _pid;
  END IF;

  IF _osm_source_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('openstreetmap:' || _osm_source_id, 0));

    SELECT ps.place_id
    INTO _osm_pid
    FROM public.place_sources ps
    WHERE ps.provider = 'openstreetmap'
      AND ps.provider_place_id = _osm_source_id
      AND ps.status = 'active'
    LIMIT 1;

    IF _osm_pid IS NULL THEN
      INSERT INTO public.place_sources (
        place_id,
        provider,
        provider_place_id,
        raw,
        status,
        first_seen_at,
        last_seen_at,
        valid_from,
        valid_to
      ) VALUES (
        _pid,
        'openstreetmap',
        _osm_source_id,
        '{}'::jsonb,
        'active',
        now(),
        now(),
        now(),
        NULL
      );
    ELSIF _osm_pid = _pid THEN
      UPDATE public.place_sources
      SET fetched_at = now(),
          last_seen_at = now()
      WHERE provider = 'openstreetmap'
        AND provider_place_id = _osm_source_id
        AND status = 'active';
    END IF;
  END IF;

  SELECT gp.collection_status
  INTO _collection_status
  FROM public.group_places gp
  WHERE gp.group_id = _group_id
    AND gp.place_id = _pid;

  IF _collection_status = 'archived' THEN
    UPDATE public.group_places
    SET collection_status = 'active',
        archived_at = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE group_id = _group_id
      AND place_id = _pid;
    RETURN _pid;
  ELSIF _collection_status = 'active' THEN
    RETURN _pid;
  END IF;

  INSERT INTO public.group_places (
    group_id,
    place_id,
    occasions,
    notes,
    added_by,
    origin
  ) VALUES (
    _group_id,
    _pid,
    COALESCE(_occasions, ARRAY[]::text[]),
    NULLIF(trim(COALESCE(_notes, '')), ''),
    _uid,
    'provider'
  );

  SELECT display_name INTO _actor_name
  FROM public.profiles
  WHERE id = _uid;

  INSERT INTO public.activity (group_id, kind, actor_id, place_id, payload)
  VALUES (
    _group_id,
    'added',
    _uid,
    _pid,
    jsonb_build_object(
      'text', COALESCE(_actor_name, 'Någon') || ' la till ' || trim(_name),
      'provider', _provider_normalized
    )
  );

  RETURN _pid;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_or_link_provider_place_v5f(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_link_provider_place_v5f(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) TO authenticated;

-- Bakåtkompatibla skrivgränser för nuvarande och äldre klienter. De får den nya
-- källhanteringen utan att klienten behöver publiceras i samma ögonblick.
CREATE OR REPLACE FUNCTION public.create_or_link_provider_place_v4b(
  _group_id uuid,
  _provider text,
  _provider_place_id text,
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
  _raw jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.create_or_link_provider_place_v5f(
    _group_id,
    _provider,
    _provider_place_id,
    _name,
    _category,
    _cuisines,
    _occasions,
    _address,
    _area,
    _city,
    _lat,
    _lng,
    _notes,
    _photo_url,
    _raw
  );
$function$;

CREATE OR REPLACE FUNCTION public.create_or_link_provider_place(
  _group_id uuid,
  _provider text,
  _provider_place_id text,
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
  _raw jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.create_or_link_provider_place_v5f(
    _group_id,
    _provider,
    _provider_place_id,
    _name,
    _category,
    _cuisines,
    _occasions,
    _address,
    _area,
    _city,
    _lat,
    _lng,
    _notes,
    _photo_url,
    _raw
  );
$function$;

REVOKE ALL ON FUNCTION public.create_or_link_provider_place_v4b(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_link_provider_place_v4b(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.create_or_link_provider_place(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_link_provider_place(
  uuid, text, text, text, text, text[], text[], text, text, text,
  double precision, double precision, text, text, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5f(_group_id uuid)
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
  _result := public.get_group_app_state_v5e(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      place_item.item
      || jsonb_build_object(
        'canonicalWebsite', p.website,
        'websiteOverride', gp.website_override,
        'website', COALESCE(gp.website_override, p.website),
        'sources', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'provider', ps.provider,
                'providerPlaceId', ps.provider_place_id,
                'status', ps.status,
                'firstSeenAt', ps.first_seen_at,
                'lastSeenAt', ps.last_seen_at,
                'validFrom', ps.valid_from,
                'validTo', ps.valid_to
              )
              ORDER BY
                CASE ps.status WHEN 'active' THEN 0 ELSE 1 END,
                ps.provider,
                ps.valid_from DESC
            )
            FROM public.place_sources ps
            WHERE ps.place_id = p.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY place_item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _places
  FROM jsonb_array_elements(COALESCE(_result->'places', '[]'::jsonb))
       WITH ORDINALITY AS place_item(item, ordinality)
  JOIN public.places p
    ON p.id = (place_item.item->>'id')::uuid
  JOIN public.group_places gp
    ON gp.group_id = _group_id
   AND gp.place_id = p.id;

  RETURN jsonb_set(_result, '{places}', _places, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5f(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5f(uuid) TO authenticated;

COMMIT;
