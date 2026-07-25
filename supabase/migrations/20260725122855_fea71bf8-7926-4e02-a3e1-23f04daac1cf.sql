
-- A1. EXECUTE-grants: bara authenticated får anropa write-RPC:erna.
REVOKE ALL ON FUNCTION public.create_group_with_owner(text, text, text, double precision, double precision, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_owner(text, text, text, double precision, double precision, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_group_settings(uuid, text, text, text, double precision, double precision, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_settings(uuid, text, text, text, double precision, double precision, text, text, boolean, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.get_group_app_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state(uuid) TO authenticated;

-- A2. Tristate-check på groups.home_location.
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_home_location_tristate;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_home_location_tristate CHECK (
    -- Tomt: allt null.
    (home_location_label IS NULL
      AND home_location_provider IS NULL
      AND home_location_place_id IS NULL
      AND home_lat IS NULL
      AND home_lng IS NULL)
    OR
    -- Legacy: label kan finnas, övriga alla null.
    (home_location_provider IS NULL
      AND home_location_place_id IS NULL
      AND home_lat IS NULL
      AND home_lng IS NULL)
    OR
    -- Verifierat: geoapify + label/place_id/lat/lng finns och inom giltiga intervall.
    (home_location_provider = 'geoapify'
      AND home_location_label IS NOT NULL
      AND home_location_place_id IS NOT NULL
      AND home_lat IS NOT NULL AND home_lng IS NOT NULL
      AND home_lat BETWEEN -90 AND 90
      AND home_lng BETWEEN -180 AND 180)
  );

-- A3. Härdad create_group_with_owner: verifierad plats eller ingen plats.
CREATE OR REPLACE FUNCTION public.create_group_with_owner(
  _name text,
  _emoji text DEFAULT NULL,
  _home_label text DEFAULT NULL,
  _home_lat double precision DEFAULT NULL,
  _home_lng double precision DEFAULT NULL,
  _home_provider text DEFAULT NULL,
  _home_place_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _gid uuid;
  _prov text;
  _any_home boolean;
  _all_home boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  INSERT INTO public.profiles (id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;

  _any_home := _home_label IS NOT NULL
            OR _home_provider IS NOT NULL
            OR _home_place_id IS NOT NULL
            OR _home_lat IS NOT NULL
            OR _home_lng IS NOT NULL;
  _all_home := _home_label IS NOT NULL
           AND _home_provider IS NOT NULL
           AND _home_place_id IS NOT NULL
           AND _home_lat IS NOT NULL
           AND _home_lng IS NOT NULL;

  IF _any_home AND NOT _all_home THEN
    RAISE EXCEPTION 'Ofullständigt sökområde. Välj ett förslag från listan eller lämna fältet tomt.';
  END IF;

  IF _all_home THEN
    _prov := lower(trim(_home_provider));
    IF _prov <> 'geoapify' THEN
      RAISE EXCEPTION 'Okänd platsleverantör';
    END IF;
    IF _home_lat < -90 OR _home_lat > 90 OR _home_lng < -180 OR _home_lng > 180 THEN
      RAISE EXCEPTION 'Ogiltiga koordinater för sökområdet';
    END IF;
    INSERT INTO public.groups (
      name, emoji,
      home_location_label, home_lat, home_lng,
      home_location_provider, home_location_place_id,
      created_by
    ) VALUES (
      trim(_name), _emoji,
      NULLIF(trim(_home_label),''), _home_lat, _home_lng,
      _prov, trim(_home_place_id),
      _uid
    ) RETURNING id INTO _gid;
  ELSE
    -- Inga home-parametrar → gruppen skapas utan förvalt sökområde.
    INSERT INTO public.groups (name, emoji, created_by)
    VALUES (trim(_name), _emoji, _uid)
    RETURNING id INTO _gid;
  END IF;

  INSERT INTO public.memberships (group_id, user_id, role)
  VALUES (_gid, _uid, 'owner');

  RETURN _gid;
END;
$function$;

-- Applicera grants även på den ersatta versionen (CREATE OR REPLACE återsätter default-grants).
REVOKE ALL ON FUNCTION public.create_group_with_owner(text, text, text, double precision, double precision, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_owner(text, text, text, double precision, double precision, text, text) TO authenticated;
