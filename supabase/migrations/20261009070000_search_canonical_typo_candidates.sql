BEGIN;

-- Read-only typo retrieval. Identity resolution and source attachment remain strict.
CREATE FUNCTION private.place_single_typo_v1(_a text, _b text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE a text := COALESCE(_a, '');
  b text := COALESCE(_b, '');
  la integer := length(a);
  lb integer := length(b);
  i integer;
BEGIN
  IF least(la, lb) < 4 OR abs(la - lb) > 1 OR a = b THEN RETURN false; END IF;
  FOR i IN 1..greatest(la, lb) LOOP
    IF la = lb AND left(a, i - 1) = left(b, i - 1)
      AND substr(a, i + 1) = substr(b, i + 1) THEN RETURN true; END IF;
    IF la = lb AND i < la
      AND left(a, i - 1) = left(b, i - 1)
      AND substr(a, i, 1) = substr(b, i + 1, 1)
      AND substr(a, i + 1, 1) = substr(b, i, 1)
      AND substr(a, i + 2) = substr(b, i + 2) THEN RETURN true; END IF;
    IF la = lb + 1 AND left(a, i - 1) = left(b, i - 1)
      AND substr(a, i + 1) = substr(b, i) THEN RETURN true; END IF;
    IF lb = la + 1 AND left(a, i - 1) = left(b, i - 1)
      AND substr(a, i) = substr(b, i + 1) THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE FUNCTION private.place_typo_name_matches_v1(_query text, _name text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE q text := private.normalize_place_identity_v1(_query);
  n text := private.normalize_place_identity_v1(_name);
  qt text[];
  nt text[];
  qword text;
  nword text;
  used boolean[];
  qi integer;
  ni integer;
  chosen integer;
  fuzzy integer := 0;
  exact_anchor boolean := false;
  fuzzy_choice boolean;
BEGIN
  IF length(q) < 6 OR length(q) > 120 OR length(n) > 300
    OR NOT private.specific_place_name_matches_v1(q, q) THEN RETURN false; END IF;
  qt := string_to_array(q, ' ');
  nt := string_to_array(n, ' ');
  IF cardinality(qt) < 1 OR cardinality(qt) > 5
    OR cardinality(nt) < cardinality(qt) OR cardinality(nt) > 12 THEN RETURN false; END IF;
  used := array_fill(false, ARRAY[cardinality(nt)]);
  FOR qi IN 1..cardinality(qt) LOOP
    qword := qt[qi];
    chosen := NULL;
    fuzzy_choice := false;
    FOR ni IN 1..cardinality(nt) LOOP
      nword := nt[ni];
      IF NOT used[ni] AND starts_with(nword, qword) THEN
        chosen := ni;
        IF length(qword) >= 5 THEN exact_anchor := true; END IF;
        EXIT;
      END IF;
    END LOOP;
    IF chosen IS NULL AND fuzzy = 0 THEN
      FOR ni IN 1..cardinality(nt) LOOP
        nword := nt[ni];
        IF used[ni] THEN CONTINUE; END IF;
        IF (cardinality(qt) = 1 AND length(qword) >= 6
            AND private.place_single_typo_v1(qword, nword))
          OR (cardinality(qt) > 1 AND length(qword) >= 4
            AND (private.place_single_typo_v1(qword, left(nword, length(qword)))
              OR private.place_single_typo_v1(qword, left(nword, length(qword) + 1)))) THEN
          chosen := ni;
          fuzzy_choice := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    IF chosen IS NULL THEN RETURN false; END IF;
    used[chosen] := true;
    IF fuzzy_choice THEN fuzzy := fuzzy + 1; END IF;
  END LOOP;
  RETURN fuzzy = 1 AND (cardinality(qt) = 1 OR exact_anchor);
END;
$$;

REVOKE ALL ON FUNCTION private.place_single_typo_v1(text,text),
  private.place_typo_name_matches_v1(text,text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.search_canonical_name_candidates_v1(
  _group_id uuid, _text text, _centers jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _center jsonb; _result jsonb;
BEGIN
  PERFORM private.assert_place_group_v1(auth.uid(), _group_id);
  IF COALESCE(jsonb_typeof(_centers),'null') <> 'array'
    OR jsonb_array_length(_centers) NOT BETWEEN 1 AND 5
    OR length(COALESCE(_text,'')) NOT BETWEEN 6 AND 120 THEN
    RAISE EXCEPTION 'Ogiltig namnsökning';
  END IF;
  FOR _center IN SELECT value FROM jsonb_array_elements(_centers) LOOP
    IF NOT COALESCE((_center->>'lat')::double precision BETWEEN -90 AND 90,false)
      OR NOT COALESCE((_center->>'lng')::double precision BETWEEN -180 AND 180,false)
      OR NOT COALESCE((_center->>'radiusKm')::double precision BETWEEN 0 AND 50,false)
      OR (_center ? 'bounds' AND
        (jsonb_typeof(_center->'bounds') <> 'array'
          OR jsonb_array_length(_center->'bounds') <> 4
          OR NOT COALESCE((_center->'bounds'->>0)::double precision BETWEEN -180 AND 180,false)
          OR NOT COALESCE((_center->'bounds'->>2)::double precision BETWEEN -180 AND 180,false)
          OR NOT COALESCE((_center->'bounds'->>1)::double precision BETWEEN -90 AND 90,false)
          OR NOT COALESCE((_center->'bounds'->>3)::double precision BETWEEN -90 AND 90,false)
          OR (_center->'bounds'->>0)::double precision > (_center->'bounds'->>2)::double precision
          OR (_center->'bounds'->>1)::double precision > (_center->'bounds'->>3)::double precision))
    THEN RAISE EXCEPTION 'Ogiltigt sökområde'; END IF;
  END LOOP;
  SELECT COALESCE(jsonb_agg(projection), '[]'::jsonb) INTO _result FROM (
    SELECT private.canonical_place_projection_v1(p.id, _group_id) AS projection
    FROM public.places p
    WHERE private.manual_place_eligible_v1(p.id)
      AND p.lat IS NOT NULL AND p.lng IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(_centers) c WHERE
          CASE WHEN c ? 'bounds' THEN
            p.lng BETWEEN (c->'bounds'->>0)::double precision AND (c->'bounds'->>2)::double precision
            AND p.lat BETWEEN (c->'bounds'->>1)::double precision AND (c->'bounds'->>3)::double precision
          ELSE private.place_distance_km_v1(p.lat,p.lng,(c->>'lat')::double precision,
            (c->>'lng')::double precision) <= (c->>'radiusKm')::double precision END
      )
      AND private.place_typo_name_matches_v1(_text, p.name)
    ORDER BY private.normalize_place_identity_v1(p.name),p.id
    LIMIT 50
  ) candidate_rows;
  RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.search_canonical_name_candidates_v1(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_canonical_name_candidates_v1(uuid,text,jsonb)
  TO authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
