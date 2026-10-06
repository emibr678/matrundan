BEGIN;

-- Forward-only search-first correction. No data changes and no new write entry point.
CREATE OR REPLACE FUNCTION private.place_address_relation_v1(_a text, _b text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE a text := lower(trim(split_part(COALESCE(_a,''),',',1)));
  b text := lower(trim(split_part(COALESCE(_b,''),',',1)));
  am text[]; bm text[]; ast text; bst text; an text; bn text;
BEGIN
  am := regexp_match(a,'^(.+?)[[:space:]]+([0-9]+([[:space:]]?[a-z])?([[:space:]]?[-/][[:space:]]?[0-9]+([[:space:]]?[a-z])?)?)$');
  bm := regexp_match(b,'^(.+?)[[:space:]]+([0-9]+([[:space:]]?[a-z])?([[:space:]]?[-/][[:space:]]?[0-9]+([[:space:]]?[a-z])?)?)$');
  ast := private.normalize_place_identity_v1(COALESCE(am[1],a));
  bst := private.normalize_place_identity_v1(COALESCE(bm[1],b));
  an := regexp_replace(COALESCE(am[2],''),'[[:space:]]','','g');
  bn := regexp_replace(COALESCE(bm[2],''),'[[:space:]]','','g');
  IF ast='' OR bst='' THEN RETURN 'unknown'; END IF;
  IF ast<>bst OR (an<>'' AND bn<>'' AND an<>bn) THEN RETURN 'conflict'; END IF;
  RETURN CASE WHEN an=bn THEN 'equal' ELSE 'compatible' END;
END;
$$;

CREATE OR REPLACE FUNCTION private.specific_place_name_matches_v1(_query text, _name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT length(q)>=6 AND q<>ALL(ARRAY['restaurang','restauranger','cafe','cafeer','pizza','pizzeria','bageri','snabbmat','pub','matvagn','hamburgare','sushi','kebab','falafel','lunch','middag','mat','kaffe','asiatiskt','italienskt','vegetariskt'])
   AND q<>ALL(ARRAY['cuisine swedish','svenskt nordiskt','swedish','scandinavian','nordic','svenskt','nordiskt','cuisine italian','italienskt','italian','cuisine japanese','japanskt','japanese','izakaya','cuisine korean','koreanskt','korean','cuisine chinese','kinesiskt','chinese','cuisine thai','thailandskt','thai','cuisine vietnamese','vietnamesiskt','vietnamese','cuisine indian','indiskt','indian','cuisine middle eastern','mellanostern','middle eastern','lebanese','arab','arabic','turkish','libanesiskt','turkiskt','cuisine mexican latin','mexikanskt latinamerikanskt','mexican','latin american','mexikanskt','latinamerikanskt','cuisine mediterranean','medelhavsmat','mediterranean','cuisine greek','grekiskt','greek','cuisine french','franskt','french','cuisine spanish','spanskt','spanish','cuisine american','amerikanskt','american','cuisine persian','persiskt','persian','iranian','cuisine international','internationellt','international','cuisine vegetarian vegan','vegetariskt veganskt','vegetarian','vegan','vegetariskt','veganskt','specialty sushi','sushi','specialty ramen','ramen','specialty pizza','pizza','pizzeria','specialty burger','burgare','burger','burgers','specialty grill','grillat','grill','grilled','barbecue','bbq','specialty tapas','tapas','specialty seafood','fisk skaldjur','seafood','fish','fisk','skaldjur','specialty bowl','bowl','poke','poke bowl','specialty pasta','pasta','specialty falafel','falafel','specialty street food','street food','specialty home style','husmanskost','home cooking','specialty small plates','smaratter','small plates','specialty pub food','pubmat','pub food','specialty fika','fika','specialty coffee','kaffe','coffee','specialty pastries','bakverk','pastry','pastries','specialty sourdough','surdeg','sourdough','specialty danish pastry','wienerbrod','danish','danish pastry'])
   AND (n=q OR (starts_with(n,q||' ') AND length(n)-length(q)<=15))
 FROM (SELECT private.normalize_place_identity_v1(_query) q, private.normalize_place_identity_v1(_name) n) names;
$$;
REVOKE ALL ON FUNCTION private.place_address_relation_v1(text,text), private.specific_place_name_matches_v1(text,text) FROM PUBLIC,anon,authenticated;

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
      r.city AS requested_city, private.place_address_relation_v1(p.address,_data->>'address') AS address_relation,
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
      AND address_relation<>'conflict'
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
    AND private.place_address_relation_v1(p.address,_data->>'address')<>'conflict'
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
          (c->>'lng')::double precision)<= CASE WHEN private.specific_place_name_matches_v1(_text,p.name)
            THEN greatest(50,(c->>'radiusKm')::double precision) ELSE (c->>'radiusKm')::double precision END END)
    ORDER BY private.normalize_place_identity_v1(p.name),p.id LIMIT _limit
  ) candidates;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_canonical_places_v1(uuid,text,jsonb,text[],text[],integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_canonical_places_v1(uuid,text,jsonb,text[],text[],integer) TO authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
