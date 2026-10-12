BEGIN;

-- Forward-only correction to the already applied #389 migration. No data moves.
-- The private pool includes ineligible matches; only a boolean eligibility for
-- source confirmation is exposed, never hidden candidates or their counts.

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
  ), candidates AS (
  SELECT id AS place_id, private.canonical_place_projection_v1(id,_group) || jsonb_build_object(
    'distanceKm',distance,
    'matchKind', CASE WHEN match_name=requested_name
      AND (match_address='' OR requested_address='' OR match_address=requested_address)
      AND (match_city='' OR requested_city='' OR match_city=requested_city)
      AND ((match_address<>'' AND match_address=requested_address) OR distance<=0.05)
      THEN 'strong' ELSE 'possible' END
    ) AS projection, private.manual_place_eligible_v1(id) AS eligible
  FROM pool WHERE distance<=0.15 AND (
    match_name=requested_name OR (distance<=0.1 AND least(length(match_name),length(requested_name))>=4
      AND (starts_with(match_name,requested_name||' ') OR starts_with(requested_name,match_name||' '))))
  )
  SELECT place_id, projection || jsonb_build_object(
    'canConfirmSource',count(*) OVER ()=1 AND eligible AND projection->>'matchKind'='strong'
  ), eligible FROM candidates ORDER BY (projection->>'distanceKm')::double precision,place_id;
$$;

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
      -- A strong selected match is insufficient when any plausible competitor
      -- exists, including private legacy/dismissed rows. Recompute under the lock.
      IF _total<>1 OR _target IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_decisions) d
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
    -- Two known different addresses/cities are counterevidence. Missing values
    -- remain conservative and do not justify creating another identity.
    AND (private.normalize_place_identity_v1(p.address)=''
      OR private.normalize_place_identity_v1(_data->>'address')=''
      OR private.normalize_place_identity_v1(p.address)=private.normalize_place_identity_v1(_data->>'address'))
    AND (private.normalize_place_identity_v1(p.city)=''
      OR private.normalize_place_identity_v1(_data->>'city')=''
      OR private.normalize_place_identity_v1(p.city)=private.normalize_place_identity_v1(_data->>'city'))
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

-- Repeat the existing boundary explicitly for the migration/RPC contract.
REVOKE ALL ON FUNCTION public.resolve_verified_provider_place_v1(uuid,uuid,jsonb,text,uuid,jsonb,text[],text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_verified_provider_place_v1(uuid,uuid,jsonb,text,uuid,jsonb,text[],text,text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
