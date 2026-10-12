BEGIN;

-- #389. Sensitive provider writes only accept the trusted server boundary.
-- No data backfill, identity merge, or historical reference move happens here.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.lock_place_identity_v1()
RETURNS void LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('matrundan-place-identity-v1', 0));
$$;

CREATE OR REPLACE FUNCTION private.normalize_place_identity_v1(_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT trim(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(normalize(lower(replace(COALESCE(_value, ''), '&', ' och ')), NFKD),
      U&'[\0300-\036f]', '', 'g'), '[^a-z0-9]+', ' ', 'g'),
    '\moch\M', ' ', 'g'), '[[:space:]]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION private.place_distance_km_v1(
  _lat1 double precision, _lng1 double precision,
  _lat2 double precision, _lng2 double precision
)
RETURNS double precision LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT 12742 * asin(sqrt(least(1::double precision, greatest(0::double precision,
    power(sin(radians(_lat2-_lat1)/2),2)
      + cos(radians(_lat1))*cos(radians(_lat2))*power(sin(radians(_lng2-_lng1)/2),2)))));
$$;

CREATE OR REPLACE FUNCTION private.assert_place_group_v1(_actor uuid, _group uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.group_is_active(_group) OR NOT public.has_membership(_group, _actor) THEN
    RAISE EXCEPTION 'Gruppen kunde inte verifieras';
  END IF;
END;
$$;

-- Mutations hold membership and lifecycle stable until commit. Read-only discovery
-- uses assert_place_group_v1 without row locks.
CREATE OR REPLACE FUNCTION private.lock_place_group_v1(_actor uuid,_group uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
BEGIN
  PERFORM g.id FROM public.groups g JOIN public.memberships m ON m.group_id=g.id
    WHERE g.id=_group AND g.lifecycle_status='active' AND m.user_id=_actor AND m.status='active'
    FOR SHARE OF g,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gruppen kunde inte verifieras'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.canonical_place_projection_v1(_place uuid, _group uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'placeId', p.id, 'name', p.name, 'category', p.category, 'cuisines', p.cuisines,
    'address', p.address, 'area', p.area, 'city', p.city, 'lat', p.lat, 'lng', p.lng,
    'version', md5(jsonb_build_array(p.id,p.name,p.category,p.cuisines,p.address,
      p.city,p.lat,p.lng,p.updated_at)::text),
    'groupStatus', COALESCE(gp.collection_status, 'not_linked')
  ) FROM public.places p
  LEFT JOIN public.group_places gp ON gp.place_id=p.id AND gp.group_id=_group
  WHERE p.id=_place;
$$;

CREATE OR REPLACE FUNCTION private.manual_place_eligible_v1(_place uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.places p WHERE p.id=_place
    AND p.lat BETWEEN -90 AND 90 AND p.lng BETWEEN -180 AND 180
    AND NOT EXISTS(SELECT 1 FROM public.place_sources s
      WHERE s.place_id=p.id AND s.status='active')
    AND EXISTS(SELECT 1 FROM public.place_improvement_candidates c
      WHERE c.place_id=p.id AND c.reason='unmatched_verified_manual'
        AND c.status IN ('open','needs_osm')));
$$;

CREATE OR REPLACE FUNCTION private.provider_place_version_v1(_data jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT md5(jsonb_build_array(_data->>'externalId',_data->>'name',_data->>'category',
    _data->'cuisines',COALESCE(_data->>'address',''),COALESCE(_data->>'area',''),
    COALESCE(_data->>'city',''),_data->'lat',_data->'lng',_data->>'osmType',
    _data->>'osmId')::text);
$$;

-- Full pool is private: a legacy/dismissed match can block INSERT without leaking it.
CREATE OR REPLACE FUNCTION private.place_identity_candidates_v1(_group uuid, _data jsonb)
RETURNS TABLE(place_id uuid, projection jsonb, eligible boolean)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH request AS (
    SELECT private.normalize_place_identity_v1(_data->>'name') AS name,
      private.normalize_place_identity_v1(_data->>'address') AS address,
      private.normalize_place_identity_v1(_data->>'city') AS city,
      (_data->>'lat')::double precision AS lat, (_data->>'lng')::double precision AS lng
  ), pool AS (
    SELECT p.*, r.name AS requested_name, r.address AS requested_address,
      r.city AS requested_city,
      private.normalize_place_identity_v1(p.name) AS match_name,
      private.normalize_place_identity_v1(p.address) AS match_address,
      private.normalize_place_identity_v1(p.city) AS match_city,
      private.place_distance_km_v1(r.lat,r.lng,p.lat,p.lng) AS distance
    FROM public.places p CROSS JOIN request r
    WHERE length(r.name)>=2 AND r.lat BETWEEN -90 AND 90 AND r.lng BETWEEN -180 AND 180
      AND p.lat BETWEEN r.lat-0.002 AND r.lat+0.002
      AND abs(p.lng-r.lng) <= 0.002 / greatest(0.001,abs(cos(radians(r.lat))))
      AND p.lat BETWEEN -90 AND 90 AND p.lng BETWEEN -180 AND 180
      AND NOT EXISTS(SELECT 1 FROM public.place_sources s
        WHERE s.place_id=p.id AND s.status='active')
  )
  SELECT id, private.canonical_place_projection_v1(id,_group) || jsonb_build_object(
    'distanceKm',distance,
    'matchKind', CASE WHEN match_name=requested_name
      AND (match_address='' OR requested_address='' OR match_address=requested_address)
      AND (match_city='' OR requested_city='' OR match_city=requested_city)
      AND ((match_address<>'' AND match_address=requested_address) OR distance<=0.05)
      THEN 'strong' ELSE 'possible' END
    ), private.manual_place_eligible_v1(id)
  FROM pool WHERE distance<=0.15 AND (
    match_name=requested_name OR (distance<=0.1 AND least(length(match_name),length(requested_name))>=4
      AND (starts_with(match_name,requested_name||' ') OR starts_with(requested_name,match_name||' '))))
  ORDER BY distance,id;
$$;

CREATE OR REPLACE FUNCTION private.link_place_group_v1(
  _actor uuid, _group uuid, _place uuid, _occasions text[] DEFAULT '{}',
  _notes text DEFAULT NULL, _origin text DEFAULT 'manual'
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE _status text; _name text; _actor_name text;
BEGIN
  PERFORM private.lock_place_group_v1(_actor,_group);
  IF COALESCE(cardinality(_occasions),0)>2
    OR NOT COALESCE(_occasions,'{}') <@ ARRAY['snabbt','avslappnat','middag']::text[] THEN
    RAISE EXCEPTION 'Ogiltig Typ av upplevelse';
  END IF;
  SELECT name INTO _name FROM public.places WHERE id=_place FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället kunde inte verifieras'; END IF;
  SELECT collection_status INTO _status FROM public.group_places
    WHERE group_id=_group AND place_id=_place FOR UPDATE;
  IF _status='active' THEN
    RETURN jsonb_build_object('placeId',_place,'status','already_active');
  ELSIF _status='archived' THEN
    UPDATE public.group_places SET collection_status='active',archived_at=NULL,archived_by=NULL,
      updated_at=now() WHERE group_id=_group AND place_id=_place;
    RETURN jsonb_build_object('placeId',_place,'status','restored');
  END IF;
  INSERT INTO public.group_places(group_id,place_id,occasions,notes,added_by,origin)
    VALUES(_group,_place,COALESCE(_occasions,'{}'),NULLIF(trim(_notes),''),_actor,_origin);
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id=_actor;
  INSERT INTO public.activity(group_id,kind,actor_id,place_id,payload)
    VALUES(_group,'added',_actor,_place,jsonb_build_object(
      'text',COALESCE(_actor_name,'Någon')||' la till '||_name));
  RETURN jsonb_build_object('placeId',_place,'status','linked');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_place_discovery_context_v1(_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  RETURN jsonb_build_object('canConfirm',public.has_group_role(_group_id,auth.uid(),ARRAY['owner','admin']));
END;
$$;

CREATE OR REPLACE FUNCTION public.search_canonical_places_v1(
  _group_id uuid, _text text, _centers jsonb, _categories text[] DEFAULT '{}',
  _cuisines text[] DEFAULT '{}', _limit integer DEFAULT 100
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _result jsonb; _center jsonb;
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  IF COALESCE(jsonb_typeof(_centers),'null')<>'array' OR jsonb_array_length(_centers) NOT BETWEEN 1 AND 5
    OR (_limit IS NULL OR _limit NOT BETWEEN 1 AND 200) OR length(COALESCE(_text,''))>120
    OR cardinality(_categories)>6 OR cardinality(_cuisines)>20 THEN
    RAISE EXCEPTION 'Ogiltig sökning';
  END IF;
  IF length(private.normalize_place_identity_v1(_text))<2
    AND cardinality(_categories)=0 AND cardinality(_cuisines)=0 THEN RETURN '[]'::jsonb; END IF;
  FOR _center IN SELECT value FROM jsonb_array_elements(_centers) LOOP
    IF NOT (_center->>'lat')::double precision BETWEEN -90 AND 90
      OR NOT (_center->>'lng')::double precision BETWEEN -180 AND 180
      OR NOT COALESCE((_center->>'radiusKm')::double precision BETWEEN 0 AND 50,false)
      OR (_center ? 'bounds' AND (jsonb_typeof(_center->'bounds')<>'array' OR jsonb_array_length(_center->'bounds')<>4
        OR NOT COALESCE((_center->'bounds'->>0)::double precision BETWEEN -180 AND 180,false)
        OR NOT COALESCE((_center->'bounds'->>2)::double precision BETWEEN -180 AND 180,false)
        OR NOT COALESCE((_center->'bounds'->>1)::double precision BETWEEN -90 AND 90,false)
        OR NOT COALESCE((_center->'bounds'->>3)::double precision BETWEEN -90 AND 90,false)
        OR (_center->'bounds'->>0)::double precision>(_center->'bounds'->>2)::double precision
        OR (_center->'bounds'->>1)::double precision>(_center->'bounds'->>3)::double precision)) THEN
      RAISE EXCEPTION 'Ogiltigt sökområde';
    END IF;
  END LOOP;
  SELECT COALESCE(jsonb_agg(projection),'[]'::jsonb) INTO _result FROM (
    SELECT private.canonical_place_projection_v1(p.id,_group_id) AS projection
    FROM public.places p WHERE private.manual_place_eligible_v1(p.id)
      AND (cardinality(_categories)=0 OR p.category=ANY(_categories))
      AND (cardinality(_cuisines)=0 OR p.cuisines && _cuisines)
      AND (length(trim(COALESCE(_text,'')))<2 OR NOT EXISTS(
        SELECT 1 FROM unnest(string_to_array(private.normalize_place_identity_v1(_text),' ')) term
        WHERE strpos(private.normalize_place_identity_v1(concat_ws(' ',p.name,p.address,p.area,
          p.city,p.category,array_to_string(p.cuisines,' '))),term)=0))
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(_centers) c WHERE
        CASE WHEN c ? 'bounds' THEN p.lng BETWEEN (c->'bounds'->>0)::double precision AND (c->'bounds'->>2)::double precision
          AND p.lat BETWEEN (c->'bounds'->>1)::double precision AND (c->'bounds'->>3)::double precision
        ELSE private.place_distance_km_v1(p.lat,p.lng,(c->>'lat')::double precision,
          (c->>'lng')::double precision)<=(c->>'radiusKm')::double precision END)
    ORDER BY private.normalize_place_identity_v1(p.name),p.id LIMIT _limit
  ) candidates;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_place_discovery_candidates_v1(_group_id uuid, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _result jsonb;
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  IF COALESCE(jsonb_typeof(_items),'null')<>'array' OR jsonb_array_length(_items)>250 THEN
    RAISE EXCEPTION 'För många sökträffar';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'providerPlaceId',item->>'externalId',
    'providerVersion',private.provider_place_version_v1(item),
    'knownPlace',private.canonical_place_projection_v1(COALESCE(known.place_id,osm.place_id),_group_id),
    'identityConflict',known.place_id IS NOT NULL AND osm.place_id IS NOT NULL AND known.place_id<>osm.place_id,
    'candidates',COALESCE(matches.candidates,'[]'::jsonb),
    'reviewRequired',COALESCE(matches.total,0)>0
  )),'[]'::jsonb) INTO _result
  FROM jsonb_array_elements(_items) item
  LEFT JOIN public.place_sources known ON known.provider='geoapify'
    AND known.provider_place_id=item->>'externalId' AND known.status='active'
  LEFT JOIN public.place_sources osm ON osm.provider='openstreetmap' AND osm.status='active'
    AND osm.provider_place_id=(item->>'osmType')||':'||(item->>'osmId')
  LEFT JOIN LATERAL (
    SELECT count(*) AS total,
      jsonb_agg(c.projection ORDER BY c.place_id) FILTER(WHERE c.eligible) AS candidates
    FROM private.place_identity_candidates_v1(_group_id,item) c
  ) matches ON true;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_canonical_place_to_group_v1(
  _group_id uuid, _place_id uuid, _occasions text[] DEFAULT '{}', _notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  PERFORM private.lock_place_identity_v1();
  PERFORM private.lock_place_group_v1(auth.uid(),_group_id);
  IF NOT private.manual_place_eligible_v1(_place_id) AND NOT EXISTS(SELECT 1 FROM public.group_places
    WHERE group_id=_group_id AND place_id=_place_id) THEN
    RETURN jsonb_build_object('status','verification_required');
  END IF;
  RETURN private.link_place_group_v1(auth.uid(),_group_id,_place_id,_occasions,_notes,'manual');
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_provider_data_v1(_data jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF length(COALESCE(_data->>'externalId','')) NOT BETWEEN 1 AND 240
    OR length(trim(COALESCE(_data->>'name',''))) NOT BETWEEN 2 AND 300
    OR COALESCE(_data->>'category','') NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn')
    OR NOT COALESCE((_data->>'lat')::double precision BETWEEN -90 AND 90,false)
    OR NOT COALESCE((_data->>'lng')::double precision BETWEEN -180 AND 180,false)
    OR NOT COALESCE((_data->>'fetchedAt')::timestamptz BETWEEN now()-interval '10 minutes'
      AND now()+interval '5 minutes',false) THEN
    RAISE EXCEPTION 'verification_required';
  END IF;
  IF ((_data->>'osmType' IS NULL) <> (_data->>'osmId' IS NULL)) OR
    (_data->>'osmType' IS NOT NULL AND (
      _data->>'osmType' NOT IN ('node','way','relation') OR _data->>'osmId' !~ '^[1-9][0-9]*$')) THEN
    RAISE EXCEPTION 'verification_required';
  END IF;
END;
$$;

-- Shared by the normal group action and the already privileged maintenance action.
CREATE OR REPLACE FUNCTION private.attach_verified_place_source_v1(_place uuid, _data jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE _osm text := CASE WHEN _data->>'osmType' IS NOT NULL
  THEN (_data->>'osmType')||':'||(_data->>'osmId') END;
BEGIN
  PERFORM private.validate_provider_data_v1(_data);
  IF EXISTS(SELECT 1 FROM public.place_sources s WHERE s.status='active' AND (
    (s.provider='geoapify' AND (s.provider_place_id=_data->>'externalId' OR s.place_id=_place))
    OR (s.provider='openstreetmap' AND (s.provider_place_id=_osm OR s.place_id=_place))
  )) THEN RAISE EXCEPTION 'identity_conflict'; END IF;
  INSERT INTO public.place_sources(place_id,provider,provider_place_id,raw,status,
    fetched_at,first_seen_at,last_seen_at,valid_from,valid_to)
  VALUES(_place,'geoapify',_data->>'externalId',jsonb_strip_nulls(jsonb_build_object(
    'osmType',_data->>'osmType','osmId',_data->>'osmId','website',_data->>'website')),
    'active',(_data->>'fetchedAt')::timestamptz,now(),now(),now(),NULL);
  IF _osm IS NOT NULL THEN
    INSERT INTO public.place_sources(place_id,provider,provider_place_id,raw,status,
      fetched_at,first_seen_at,last_seen_at,valid_from,valid_to)
    VALUES(_place,'openstreetmap',_osm,'{}','active',(_data->>'fetchedAt')::timestamptz,
      now(),now(),now(),NULL);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_verified_provider_place_v1(
  _actor_id uuid,
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
  _uid uuid := _actor_id;
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

  IF COALESCE(cardinality(_occasions),0)>2 THEN RAISE EXCEPTION 'Ogiltig Typ av upplevelse'; END IF;
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
    _osm_source_id := NULL;
  ELSE
    _osm_source_id := _osm_type || ':' || _osm_id;
  END IF;

  -- Alla anrop låser först Geoapify-identiteten och därefter OSM-identiteten.
  -- Den stabila ordningen undviker deadlocks mellan samtidiga tillägg.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_provider_normalized || ':' || _provider_id_normalized, 0)
  );
  IF _osm_source_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('openstreetmap:' || _osm_source_id, 0));
  END IF;

  SELECT ps.place_id
  INTO _pid
  FROM public.place_sources ps
  WHERE ps.provider = _provider_normalized
    AND ps.provider_place_id = _provider_id_normalized
    AND ps.status = 'active'
  LIMIT 1;

  IF _osm_source_id IS NOT NULL THEN
    SELECT ps.place_id
    INTO _osm_pid
    FROM public.place_sources ps
    WHERE ps.provider = 'openstreetmap'
      AND ps.provider_place_id = _osm_source_id
      AND ps.status = 'active'
    LIMIT 1;
  END IF;

  -- En exakt OSM-identitet får återanvända en befintlig kanonisk plats när
  -- Geoapifys ID är nytt. Om Geoapify- och OSM-identiteterna redan pekar på
  -- olika platser väljs Geoapify-identiteten och konflikten lämnas orörd.
  IF _pid IS NULL AND _osm_pid IS NOT NULL THEN
    _pid := _osm_pid;
  END IF;

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
    IF EXISTS (
      SELECT 1
      FROM public.place_sources ps
      WHERE ps.provider = _provider_normalized
        AND ps.provider_place_id = _provider_id_normalized
        AND ps.status = 'active'
        AND ps.place_id = _pid
    ) THEN
      UPDATE public.place_sources
      SET raw = COALESCE(_raw, '{}'::jsonb),
          fetched_at = now(),
          last_seen_at = now()
      WHERE provider = _provider_normalized
        AND provider_place_id = _provider_id_normalized
        AND status = 'active'
        AND place_id = _pid;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM public.place_sources ps
      WHERE ps.place_id = _pid
        AND ps.provider = _provider_normalized
        AND ps.status = 'active'
    ) THEN
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
    END IF;

    UPDATE public.places
    SET website = COALESCE(website, _website)
    WHERE id = _pid;
  END IF;

  IF _osm_source_id IS NOT NULL THEN
    IF _osm_pid IS NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.place_sources ps
         WHERE ps.place_id = _pid
           AND ps.provider = 'openstreetmap'
           AND ps.status = 'active'
       ) THEN
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
        AND status = 'active'
        AND place_id = _pid;
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

CREATE OR REPLACE FUNCTION public.resolve_verified_provider_place_v1(
  _actor_id uuid, _group_id uuid, _data jsonb, _choice text DEFAULT 'auto',
  _place_id uuid DEFAULT NULL, _decisions jsonb DEFAULT '[]',
  _occasions text[] DEFAULT '{}', _notes text DEFAULT NULL, _provider_version text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _provider_place uuid; _osm_place uuid; _resolved uuid; _before text;
  _candidates jsonb; _total integer; _unreviewed integer; _target jsonb;
  _osm text := CASE WHEN _data->>'osmType' IS NOT NULL
    THEN (_data->>'osmType')||':'||(_data->>'osmId') END;
BEGIN
  PERFORM private.assert_place_group_v1(_actor_id,_group_id);
  PERFORM private.validate_provider_data_v1(_data);
  IF _choice NOT IN ('auto','link','separate') OR COALESCE(jsonb_typeof(_decisions),'null')<>'array'
    OR jsonb_array_length(_decisions)>100 THEN RAISE EXCEPTION 'Ogiltigt beslut'; END IF;
  PERFORM private.lock_place_identity_v1();
  PERFORM private.lock_place_group_v1(_actor_id,_group_id);
  IF _choice='link' AND NOT public.has_group_role(_group_id,_actor_id,ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Gruppens admin behöver bekräfta matchningen';
  END IF;
  SELECT place_id INTO _provider_place FROM public.place_sources
    WHERE provider='geoapify' AND provider_place_id=_data->>'externalId' AND status='active';
  SELECT place_id INTO _osm_place FROM public.place_sources
    WHERE provider='openstreetmap' AND provider_place_id=_osm AND status='active';
  IF _provider_place IS NOT NULL AND _osm_place IS NOT NULL AND _provider_place<>_osm_place THEN
    RETURN jsonb_build_object('status','identity_conflict');
  END IF;
  _resolved := COALESCE(_provider_place,_osm_place);
  IF _resolved IS NOT NULL AND _osm IS NOT NULL AND EXISTS(SELECT 1 FROM public.place_sources
    WHERE place_id=_resolved AND provider='openstreetmap' AND status='active' AND provider_place_id<>_osm) THEN
    RETURN jsonb_build_object('status','identity_conflict');
  END IF;
  IF _resolved IS NOT NULL AND _choice='link' AND _place_id IS DISTINCT FROM _resolved THEN
    RETURN jsonb_build_object('status','identity_conflict');
  END IF;
  IF _resolved IS NULL THEN
    SELECT count(*),COALESCE(jsonb_agg(projection ORDER BY place_id) FILTER(WHERE eligible),'[]'),
      count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_decisions) d
        WHERE d->>'placeId'=c.place_id::text AND d->>'version'=c.projection->>'version'))
      INTO _total,_candidates,_unreviewed
      FROM private.place_identity_candidates_v1(_group_id,_data) c;
    IF _choice<>'auto' AND _provider_version IS DISTINCT FROM private.provider_place_version_v1(_data) THEN
      RETURN jsonb_build_object('status','review_required','candidates',_candidates,
        'providerVersion',private.provider_place_version_v1(_data));
    END IF;
    IF _choice='link' THEN
      IF NOT public.has_group_role(_group_id,_actor_id,ARRAY['owner','admin']) THEN
        RAISE EXCEPTION 'Endast gruppens ägare och administratörer kan bekräfta matchningen';
      END IF;
      SELECT projection INTO _target FROM private.place_identity_candidates_v1(_group_id,_data)
        WHERE place_id=_place_id AND eligible AND projection->>'matchKind'='strong';
      IF _target IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_decisions) d
        WHERE d->>'placeId'=_place_id::text AND d->>'version'=_target->>'version') THEN
        RETURN jsonb_build_object('status','review_required','candidates',_candidates,
          'providerVersion',private.provider_place_version_v1(_data));
      END IF;
      PERFORM private.attach_verified_place_source_v1(_place_id,_data);
      _resolved := _place_id;
    ELSIF _total>0 AND (_choice<>'separate' OR _unreviewed>0) THEN
      RETURN jsonb_build_object('status','review_required','candidates',_candidates,
        'providerVersion',private.provider_place_version_v1(_data));
    END IF;
  END IF;
  IF _resolved IS NOT NULL THEN
    SELECT collection_status INTO _before FROM public.group_places
      WHERE group_id=_group_id AND place_id=_resolved;
  END IF;
  -- New Geoapify IDs for an established OSM identity supersede the old ID,
  -- preserving source history rather than silently ignoring the new source.
  IF _provider_place IS NULL AND _osm_place IS NOT NULL THEN
    UPDATE public.place_sources SET status='superseded',valid_to=now()
      WHERE place_id=_osm_place AND provider='geoapify' AND status='active';
  END IF;
  _provider_place := private.create_verified_provider_place_v1(
    _actor_id,_group_id,'geoapify',_data->>'externalId',_data->>'name',_data->>'category',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(_data->'cuisines','[]'))),
    _occasions,COALESCE(_data->>'address',''),_data->>'area',COALESCE(_data->>'city',''),
    (_data->>'lat')::double precision,(_data->>'lng')::double precision,_notes,NULL,
    jsonb_strip_nulls(jsonb_build_object('osmType',_data->>'osmType','osmId',_data->>'osmId',
      'website',_data->>'website')));
  RETURN jsonb_build_object('placeId',_provider_place,'status',CASE
    WHEN _resolved IS NULL THEN 'created' WHEN _before='active' THEN 'already_active'
    WHEN _before='archived' THEN 'restored' ELSE 'linked' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_verified_maintenance_source_v1(
  _actor_id uuid, _candidate_id uuid, _data jsonb
)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _place uuid; _target jsonb;
BEGIN
  IF _actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.place_maintainers
    WHERE user_id=_actor_id) THEN RAISE EXCEPTION 'Underhållsärendet kunde inte verifieras'; END IF;
  PERFORM private.validate_provider_data_v1(_data);
  PERFORM private.lock_place_identity_v1();
  PERFORM user_id FROM public.place_maintainers WHERE user_id=_actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Underhållsärendet kunde inte verifieras'; END IF;
  SELECT place_id INTO _place FROM public.place_improvement_candidates
    WHERE id=_candidate_id AND status IN ('open','needs_osm') FOR UPDATE;
  SELECT projection INTO _target FROM private.place_identity_candidates_v1(NULL,_data)
    WHERE place_id=_place AND eligible AND projection->>'matchKind'='strong';
  IF _target IS NULL THEN RAISE EXCEPTION 'review_required'; END IF;
  PERFORM private.attach_verified_place_source_v1(_place,_data);
  INSERT INTO public.place_maintenance_events(work_item_kind,work_item_id,place_id,action,actor_id,metadata)
    VALUES('improvement_candidate',_candidate_id,_place,'provider_source_linked',_actor_id,
      jsonb_build_object('provider','geoapify','providerPlaceId',_data->>'externalId'));
  RETURN _place;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_reusable_manual_place_candidates_v2(
  _group_id uuid, _name text, _address text, _city text,
  _lat double precision, _lng double precision, _category text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _result jsonb;
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  SELECT COALESCE(jsonb_agg(projection || jsonb_build_object('matchKind',CASE
    WHEN projection->>'matchKind'='strong' THEN 'exact' ELSE 'similar' END)),'[]')
    INTO _result FROM (SELECT projection FROM private.place_identity_candidates_v1(_group_id,
      jsonb_build_object('name',_name,'address',_address,'city',_city,'lat',_lat,'lng',_lng))
      LIMIT 20) candidates;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_manual_place_v2(
  _actor uuid, _group uuid, _data jsonb, _decisions jsonb DEFAULT '[]'
)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE _place uuid; _linked jsonb; _occasions text[];
  _lat double precision := (_data->>'lat')::double precision;
  _lng double precision := (_data->>'lng')::double precision;
BEGIN
  PERFORM private.assert_place_group_v1(_actor,_group);
  IF COALESCE(jsonb_typeof(_data),'null')<>'object' OR octet_length(_data::text)>40000
    OR length(COALESCE(_data->>'address',''))>500 OR length(COALESCE(_data->>'area',''))>200
    OR length(COALESCE(_data->>'city',''))>200 OR length(COALESCE(_data->>'notes',''))>2000
    OR jsonb_typeof(COALESCE(_data->'cuisines','[]'))<>'array'
    OR jsonb_array_length(COALESCE(_data->'cuisines','[]'))>20
    OR length(trim(COALESCE(_data->>'name',''))) NOT BETWEEN 2 AND 300
    OR COALESCE(_data->>'category','') NOT IN ('restaurang','café','bageri','snabbmat','pub','matvagn')
    OR (_lat IS NULL)<>(_lng IS NULL)
    OR (_lat IS NOT NULL AND (_lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180))
    OR COALESCE(jsonb_typeof(_decisions),'null')<>'array' OR jsonb_array_length(_decisions)>100 THEN
    RAISE EXCEPTION 'Ogiltigt matställe';
  END IF;
  PERFORM private.lock_place_identity_v1();
  PERFORM private.lock_place_group_v1(_actor,_group);
  IF EXISTS(SELECT 1 FROM public.places p WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND private.normalize_place_identity_v1(p.name)=private.normalize_place_identity_v1(_data->>'name')
    AND private.place_distance_km_v1(_lat,_lng,p.lat,p.lng)<=0.15
    AND EXISTS(SELECT 1 FROM public.place_sources ps WHERE ps.place_id=p.id AND ps.status='active')) THEN
    RAISE EXCEPTION 'Kartstället finns redan. Sök efter stället igen innan du lägger till det.';
  END IF;
  IF EXISTS(SELECT 1 FROM private.place_identity_candidates_v1(_group,_data) c
    WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_decisions) d
      WHERE d->>'placeId'=c.place_id::text AND d->>'version'=c.projection->>'version')) THEN
    RAISE EXCEPTION 'REUSABLE_PLACE_FOUND';
  END IF;
  _occasions := ARRAY(SELECT jsonb_array_elements_text(COALESCE(_data->'occasions','[]')));
  IF cardinality(_occasions)>2 OR NOT _occasions <@ ARRAY['snabbt','avslappnat','middag'] THEN
    RAISE EXCEPTION 'Ogiltig Typ av upplevelse';
  END IF;
  SELECT p.id INTO _place FROM public.places p JOIN public.group_places gp ON gp.place_id=p.id
    WHERE gp.group_id=_group
      AND private.normalize_place_identity_v1(p.name)=private.normalize_place_identity_v1(_data->>'name')
      AND private.normalize_place_identity_v1(p.address)=private.normalize_place_identity_v1(_data->>'address')
    ORDER BY p.id LIMIT 1;
  IF _place IS NOT NULL THEN
    PERFORM private.link_place_group_v1(_actor,_group,_place,_occasions,_data->>'notes','manual');
    RETURN jsonb_build_object('placeId',_place,'improvementCandidate',false);
  END IF;
  INSERT INTO public.places(name,category,cuisines,address,area,city,lat,lng,photo_url,added_by)
    VALUES(trim(_data->>'name'),_data->>'category',public.normalize_food_tags(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(_data->'cuisines','[]')))),
      COALESCE(_data->>'address',''),NULLIF(_data->>'area',''),COALESCE(_data->>'city',''),
      _lat,_lng,_data->>'photo',_actor) RETURNING id INTO _place;
  _linked := private.link_place_group_v1(_actor,_group,_place,_occasions,_data->>'notes','manual');
  IF _lat IS NOT NULL THEN
    INSERT INTO public.place_improvement_candidates(group_id,place_id,reason,status,created_by)
      VALUES(_group,_place,'unmatched_verified_manual','open',_actor);
  END IF;
  RETURN jsonb_build_object('placeId',_place,'improvementCandidate',_lat IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manual_place_fallback_v2(
  _group_id uuid, _data jsonb, _decisions jsonb DEFAULT '[]'
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN private.create_manual_place_v2(auth.uid(),_group_id,_data,_decisions);
END;
$$;

-- Legacy callers can reuse an established provider ID. Client matching fields
-- cannot establish a new provider identity or alter an existing source.
CREATE OR REPLACE FUNCTION public.create_or_link_provider_place_v5f(
  _group_id uuid, _provider text, _provider_place_id text, _name text, _category text,
  _cuisines text[] DEFAULT '{}', _occasions text[] DEFAULT '{}', _address text DEFAULT '',
  _area text DEFAULT NULL, _city text DEFAULT '', _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL, _notes text DEFAULT NULL, _photo_url text DEFAULT NULL,
  _raw jsonb DEFAULT '{}'
)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _place uuid; _result jsonb;
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  PERFORM private.lock_place_identity_v1();
  PERFORM private.lock_place_group_v1(auth.uid(),_group_id);
  SELECT place_id INTO _place FROM public.place_sources WHERE provider='geoapify'
    AND _provider='geoapify' AND provider_place_id=trim(_provider_place_id) AND status='active';
  IF _place IS NULL THEN RAISE EXCEPTION 'verification_required'; END IF;
  _result := private.link_place_group_v1(auth.uid(),_group_id,_place,_occasions,_notes,'provider');
  RETURN _place;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_place_v4b(
  _group_id uuid, _name text, _category text, _cuisines text[] DEFAULT '{}',
  _occasions text[] DEFAULT '{}', _address text DEFAULT '', _area text DEFAULT NULL,
  _city text DEFAULT '', _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL,
  _notes text DEFAULT NULL, _photo_url text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _result jsonb;
BEGIN
  _result := private.create_manual_place_v2(auth.uid(),_group_id,jsonb_build_object(
    'name',_name,'category',_category,'cuisines',COALESCE(_cuisines,'{}'),
    'occasions',COALESCE(_occasions,'{}'),'address',_address,'area',_area,'city',_city,
    'lat',_lat,'lng',_lng,'notes',_notes,'photo',_photo_url),'[]');
  RETURN (_result->>'placeId')::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_provider_source_to_existing_place_v1(
  _group_id uuid, _place_id uuid, _provider text, _provider_place_id text,
  _name text, _address text, _city text, _lat double precision, _lng double precision,
  _raw jsonb DEFAULT '{}'
)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  IF NOT public.has_group_role(_group_id,auth.uid(),ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Matchningen kunde inte verifieras';
  END IF;
  IF EXISTS(SELECT 1 FROM public.place_sources s JOIN public.group_places gp ON gp.place_id=s.place_id
    WHERE s.place_id=_place_id AND s.provider='geoapify' AND _provider='geoapify'
      AND s.provider_place_id=_provider_place_id AND s.status='active'
      AND gp.group_id=_group_id AND gp.collection_status='active') THEN RETURN _place_id; END IF;
  RAISE EXCEPTION 'verification_required';
END;
$$;

CREATE OR REPLACE FUNCTION public.link_provider_source_for_maintenance_v1(
  _candidate_id uuid, _provider text, _provider_place_id text, _name text,
  _address text, _city text, _lat double precision, _lng double precision, _raw jsonb DEFAULT '{}'
)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.place_maintainers
    WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Underhållsärendet kunde inte verifieras'; END IF;
  RAISE EXCEPTION 'verification_required';
END;
$$;


CREATE OR REPLACE FUNCTION public.create_or_link_provider_places_batch_v1(_group_id uuid,_items jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE _item jsonb; _place uuid; _before text; _linked jsonb; _results jsonb:='[]';
  _added integer:=0; _restored integer:=0; _existing integer:=0; _failed integer:=0; _status text;
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(),_group_id);
  IF COALESCE(jsonb_typeof(_items),'null')<>'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Ogiltigt masstillägg'; END IF;
  PERFORM private.lock_place_identity_v1();
  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    _place:=NULL;
    SELECT place_id INTO _place FROM public.place_sources WHERE provider='geoapify'
      AND _item->>'provider'='geoapify' AND provider_place_id=_item->>'providerPlaceId' AND status='active';
    IF _place IS NULL THEN _status:='failed'; _failed:=_failed+1;
    ELSE
      SELECT collection_status INTO _before FROM public.group_places WHERE group_id=_group_id AND place_id=_place;
      _linked:=private.link_place_group_v1(auth.uid(),_group_id,_place,'{}',NULL,'provider');
      _status:=CASE WHEN _before='active' THEN 'existing' WHEN _before='archived' THEN 'restored' ELSE 'added' END;
      IF _status='existing' THEN _existing:=_existing+1;
      ELSIF _status='restored' THEN _restored:=_restored+1; ELSE _added:=_added+1; END IF;
    END IF;
    _results:=_results||jsonb_build_array(jsonb_build_object('externalId',_item->>'externalId',
      'name',COALESCE(_item->>'name','Matställe'),'status',_status,'placeId',_place,
      'message',CASE WHEN _status='failed' THEN 'verification_required' ELSE NULL END));
  END LOOP;
  RETURN jsonb_build_object('items',_results,'added',_added,'restored',_restored,'existing',_existing,'failed',_failed);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_place_external_location_v1(
  _actor_id uuid,
  _group_id uuid,
  _place_id uuid,
  _provider_place_id text,
  _address text,
  _area text,
  _city text,
  _lat double precision,
  _lng double precision,
  _osm_type text,
  _osm_id text,
  _fetched_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _address_normalized text := NULLIF(regexp_replace(trim(COALESCE(_address, '')), '[[:space:]]+', ' ', 'g'), '');
  _area_normalized text := NULLIF(regexp_replace(trim(COALESCE(_area, '')), '[[:space:]]+', ' ', 'g'), '');
  _city_normalized text := NULLIF(regexp_replace(trim(COALESCE(_city, '')), '[[:space:]]+', ' ', 'g'), '');
  _osm_type_normalized text := NULLIF(lower(trim(COALESCE(_osm_type, ''))), '');
  _osm_id_normalized text := NULLIF(trim(COALESCE(_osm_id, '')), '');
  _osm_provider_id text;
  _current public.places%ROWTYPE;
  _source_linked boolean := false;
BEGIN
  PERFORM private.lock_place_identity_v1();
  IF _actor_id IS NULL THEN RAISE EXCEPTION 'Användaren kunde inte verifieras'; END IF;
  IF NOT public.group_is_active(_group_id) THEN
    RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.group_id = _group_id
      AND m.user_id = _actor_id
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Endast gruppens ägare och administratörer kan använda ny kartdata';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_places gp
    JOIN public.place_sources ps ON ps.place_id = gp.place_id
    WHERE gp.group_id = _group_id
      AND gp.place_id = _place_id
      AND gp.collection_status = 'active'
      AND ps.provider = 'geoapify'
      AND ps.provider_place_id = trim(_provider_place_id)
      AND ps.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Matställets externa källa kunde inte verifieras';
  END IF;
  IF _fetched_at IS NULL
     OR _fetched_at < now() - interval '10 minutes'
     OR _fetched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Kartdatan måste hämtas på nytt före uppdateringen';
  END IF;
  IF _address_normalized IS NULL
     OR length(_address_normalized) > 500
     OR _address_normalized !~* '[[:alpha:]]'
     OR _address_normalized !~* '([[:digit:]]|gata(n)?|väg(en)?|gränd(en)?|torg(et)?|allé(n)?|aveny(n)?|kaj(en)?|backe(n)?|stig(en)?|stråk(et)?|terrass(en)?|esplanad(en)?|gång(en)?|led(en)?|plats(en)?|street|road)' THEN
    RAISE EXCEPTION 'Kartdatan innehåller ingen säker gatuadress';
  END IF;
  IF _city_normalized IS NULL OR length(_city_normalized) > 200 THEN
    RAISE EXCEPTION 'Kartdatan innehåller ingen säker ort';
  END IF;
  IF length(COALESCE(_area_normalized, '')) > 200 THEN
    RAISE EXCEPTION 'Kartdatan innehåller ett ogiltigt område';
  END IF;
  IF _lat IS NULL OR _lng IS NULL
     OR _lat < -90 OR _lat > 90
     OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Kartdatan innehåller ingen säker position';
  END IF;
  IF ((_osm_type_normalized IS NULL) <> (_osm_id_normalized IS NULL))
     OR (_osm_type_normalized IS NOT NULL AND (
       _osm_type_normalized NOT IN ('node','way','relation')
       OR _osm_id_normalized !~ '^[0-9]+$'
     )) THEN
    RAISE EXCEPTION 'Kartdatan innehåller en ogiltig OpenStreetMap-identitet';
  END IF;

  SELECT * INTO _current
  FROM public.places
  WHERE id = _place_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matstället finns inte'; END IF;

  IF lower(regexp_replace(trim(_current.name), '[[:space:]]+', ' ', 'g')) =
     lower(regexp_replace(_address_normalized, '[[:space:]]+', ' ', 'g')) THEN
    RAISE EXCEPTION 'Kartdatan innehåller ställets namn i stället för en adress';
  END IF;

  IF _osm_type_normalized IS NOT NULL THEN
    _osm_provider_id := _osm_type_normalized || ':' || _osm_id_normalized;

    IF EXISTS (
      SELECT 1 FROM public.place_sources
      WHERE provider = 'openstreetmap'
        AND provider_place_id = _osm_provider_id
        AND status = 'active'
        AND place_id <> _place_id
    ) THEN
      RAISE EXCEPTION 'Kartkällan är redan kopplad till ett annat matställe';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.place_sources
      WHERE provider = 'openstreetmap'
        AND status = 'active'
        AND place_id = _place_id
        AND provider_place_id <> _osm_provider_id
    ) THEN
      RAISE EXCEPTION 'Matstället har redan en annan aktiv OpenStreetMap-källa';
    END IF;
  END IF;

  UPDATE public.places
  SET address = _address_normalized,
      area = _area_normalized,
      city = _city_normalized,
      lat = _lat,
      lng = _lng,
      updated_at = now()
  WHERE id = _place_id;

  IF _osm_provider_id IS NOT NULL THEN
    INSERT INTO public.place_sources (
      place_id,
      provider,
      provider_place_id,
      raw,
      fetched_at,
      status,
      first_seen_at,
      last_seen_at,
      valid_from,
      valid_to
    ) VALUES (
      _place_id,
      'openstreetmap',
      _osm_provider_id,
      jsonb_build_object(
        'provider', 'openstreetmap',
        'osmType', _osm_type_normalized,
        'osmId', _osm_id_normalized
      ),
      _fetched_at,
      'active',
      now(),
      now(),
      now(),
      NULL
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.place_sources
    SET last_seen_at = now(),
        fetched_at = _fetched_at,
        raw = jsonb_build_object(
          'provider', 'openstreetmap',
          'osmType', _osm_type_normalized,
          'osmId', _osm_id_normalized
        )
    WHERE place_id = _place_id
      AND provider = 'openstreetmap'
      AND provider_place_id = _osm_provider_id
      AND status = 'active';

    _source_linked := EXISTS (
      SELECT 1 FROM public.place_sources
      WHERE place_id = _place_id
        AND provider = 'openstreetmap'
        AND provider_place_id = _osm_provider_id
        AND status = 'active'
    );
  END IF;

  RETURN jsonb_build_object(
    'address', _address_normalized,
    'area', _area_normalized,
    'city', _city_normalized,
    'lat', _lat,
    'lng', _lng,
    'sourceLinked', _source_linked
  );
END;
$function$;

-- Statement locks happen before row locks, including location refresh and
-- other trusted source writers. The global lock is short and never covers HTTP.
CREATE OR REPLACE FUNCTION private.serialize_place_identity_writes_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_place_identity_v1();
  RETURN NULL;
END;
$$;
CREATE TRIGGER serialize_place_identity_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.places
  FOR EACH STATEMENT EXECUTE FUNCTION private.serialize_place_identity_writes_v1();
CREATE TRIGGER serialize_source_identity_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.place_sources
  FOR EACH STATEMENT EXECUTE FUNCTION private.serialize_place_identity_writes_v1();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;

-- Restate the legacy ACLs beside every replaced SECURITY DEFINER boundary.
REVOKE ALL ON FUNCTION public.create_or_link_provider_place_v5f(uuid,text,text,text,text,text[],text[],text,text,text,double precision,double precision,text,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_place_v4b(uuid,text,text,text[],text[],text,text,text,double precision,double precision,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_provider_source_to_existing_place_v1(uuid,uuid,text,text,text,text,text,double precision,double precision,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_provider_source_for_maintenance_v1(uuid,text,text,text,text,text,double precision,double precision,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_or_link_provider_places_batch_v1(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apply_place_external_location_v1(uuid,uuid,uuid,text,text,text,text,double precision,double precision,text,text,timestamp with time zone) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.resolve_verified_provider_place_v1(uuid,uuid,jsonb,text,uuid,jsonb,text[],text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_verified_maintenance_source_v1(uuid,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_verified_provider_place_v1(uuid,uuid,jsonb,text,uuid,jsonb,text[],text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.link_verified_maintenance_source_v1(uuid,uuid,jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_place_discovery_context_v1(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.search_canonical_places_v1(uuid,text,jsonb,text[],text[],integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.match_place_discovery_candidates_v1(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_canonical_place_to_group_v1(uuid,uuid,text[],text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.find_reusable_manual_place_candidates_v2(uuid,text,text,text,double precision,double precision,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_manual_place_fallback_v2(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_place_discovery_context_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.search_canonical_places_v1(uuid,text,jsonb,text[],text[],integer) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.match_place_discovery_candidates_v1(uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.link_canonical_place_to_group_v1(uuid,uuid,text[],text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.find_reusable_manual_place_candidates_v2(uuid,text,text,text,double precision,double precision,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_manual_place_fallback_v2(uuid,jsonb,jsonb) TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
