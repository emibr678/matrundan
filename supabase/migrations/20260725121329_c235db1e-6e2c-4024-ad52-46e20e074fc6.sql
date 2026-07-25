
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS home_location_provider text,
  ADD COLUMN IF NOT EXISTS home_location_place_id text;

-- ---- update_group_settings: utökad signatur ----
DROP FUNCTION IF EXISTS public.update_group_settings(uuid, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.update_group_settings(
  _group_id uuid,
  _name text,
  _emoji text DEFAULT NULL,
  _home_label text DEFAULT NULL,
  _home_lat double precision DEFAULT NULL,
  _home_lng double precision DEFAULT NULL,
  _home_provider text DEFAULT NULL,
  _home_place_id text DEFAULT NULL,
  _clear_home boolean DEFAULT false,
  _shared_visits_count_for_progression boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _n text; _prov text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast ägare eller admin kan ändra gruppens inställningar';
  END IF;
  _n := trim(coalesce(_name,''));
  IF length(_n) < 2 OR length(_n) > 60 THEN
    RAISE EXCEPTION 'Gruppnamnet måste vara 2–60 tecken';
  END IF;

  UPDATE public.groups SET
    name = _n,
    emoji = NULLIF(trim(coalesce(_emoji,'')),''),
    shared_visits_count_for_progression =
      COALESCE(_shared_visits_count_for_progression, shared_visits_count_for_progression),
    updated_at = now()
  WHERE id = _group_id;

  IF _clear_home THEN
    UPDATE public.groups SET
      home_location_label = NULL,
      home_lat = NULL,
      home_lng = NULL,
      home_location_provider = NULL,
      home_location_place_id = NULL,
      updated_at = now()
    WHERE id = _group_id;
  ELSIF _home_provider IS NOT NULL
        AND _home_place_id IS NOT NULL
        AND _home_lat IS NOT NULL
        AND _home_lng IS NOT NULL
        AND _home_label IS NOT NULL THEN
    _prov := lower(trim(_home_provider));
    IF _prov <> 'geoapify' THEN
      RAISE EXCEPTION 'Okänd platsleverantör';
    END IF;
    UPDATE public.groups SET
      home_location_label = NULLIF(trim(_home_label),''),
      home_lat = _home_lat,
      home_lng = _home_lng,
      home_location_provider = _prov,
      home_location_place_id = trim(_home_place_id),
      updated_at = now()
    WHERE id = _group_id;
  END IF;
END $function$;

-- ---- create_group_with_owner: acceptera verifierat sökområde ----
DROP FUNCTION IF EXISTS public.create_group_with_owner(text, text, text, double precision, double precision);

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
  _has_verified boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  INSERT INTO public.profiles (id) VALUES (_uid)
    ON CONFLICT (id) DO NOTHING;

  _has_verified := _home_provider IS NOT NULL
                   AND _home_place_id IS NOT NULL
                   AND _home_lat IS NOT NULL
                   AND _home_lng IS NOT NULL
                   AND _home_label IS NOT NULL;
  IF _has_verified THEN
    _prov := lower(trim(_home_provider));
    IF _prov <> 'geoapify' THEN
      RAISE EXCEPTION 'Okänd platsleverantör';
    END IF;
  END IF;

  IF _has_verified THEN
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
    INSERT INTO public.groups (
      name, emoji,
      home_location_label,
      created_by
    ) VALUES (
      trim(_name), _emoji,
      NULLIF(trim(coalesce(_home_label,'')),''),
      _uid
    ) RETURNING id INTO _gid;
  END IF;

  INSERT INTO public.memberships (group_id, user_id, role)
  VALUES (_gid, _uid, 'owner');

  RETURN _gid;
END;
$function$;

-- ---- get_group_app_state: exponera structured homeLocation ----
CREATE OR REPLACE FUNCTION public.get_group_app_state(_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Not a member of group';
  END IF;

  WITH
  grp AS (
    SELECT g.*,
      (SELECT user_id FROM public.memberships
        WHERE group_id = g.id AND role='owner' AND status='active' LIMIT 1) AS owner_id
    FROM public.groups g WHERE g.id = _group_id
  ),
  members AS (
    SELECT m.user_id, m.role, p.display_name, p.avatar_url, p.avatar_emoji
    FROM public.memberships m LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.group_id = _group_id AND m.status='active'
  ),
  places_agg AS (
    SELECT gp.place_id, p.name, p.category, p.cuisines, p.address, p.area, p.city,
           p.lat, p.lng, p.photo_url,
           gp.occasions, gp.notes, gp.added_by, gp.origin, gp.created_at AS linked_at
    FROM public.group_places gp JOIN public.places p ON p.id = gp.place_id
    WHERE gp.group_id = _group_id
  ),
  visits_in_group AS (
    SELECT v.id AS visit_id, v.place_id, v.visited_on, v.meal_type, v.created_by,
           vgl.link_type, vgl.linked_by, vgl.linked_at
    FROM public.visit_group_links vgl JOIN public.visits v ON v.id = vgl.visit_id
    WHERE vgl.group_id = _group_id
  ),
  vp_relevant AS (
    SELECT vp.visit_id, vp.user_id, mm.status AS membership_status
    FROM public.visit_participants vp
    JOIN public.memberships mm
      ON mm.group_id = _group_id AND mm.user_id = vp.user_id
  ),
  vp_external AS (
    SELECT vp.visit_id, count(*)::int AS ext_count
    FROM public.visit_participants vp
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships mm
      WHERE mm.group_id = _group_id AND mm.user_id = vp.user_id
    )
    GROUP BY vp.visit_id
  ),
  reviews_scoped AS (
    SELECT r.id AS review_id, r.visit_id, r.user_id, r.overall, r.taste, r.value, r.service,
           CASE WHEN rgv.comment_visible OR r.user_id = _uid THEN r.comment ELSE NULL END AS comment,
           rgv.rating_visible, rgv.comment_visible
    FROM public.reviews r
    JOIN public.review_group_visibility rgv
      ON rgv.review_id = r.id AND rgv.group_id = _group_id
    WHERE (
      (rgv.rating_visible = true
        AND EXISTS (SELECT 1 FROM public.memberships mm
                    WHERE mm.group_id = _group_id AND mm.user_id = r.user_id))
      OR r.user_id = _uid
    )
  ),
  visits_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', vg.visit_id, 'placeId', vg.place_id, 'date', vg.visited_on,
      'meal', vg.meal_type, 'createdBy', vg.created_by,
      'linkType', vg.link_type, 'linkedBy', vg.linked_by, 'linkedAt', vg.linked_at,
      'countsForProgression',
        CASE WHEN vg.link_type = 'original' THEN true
             ELSE COALESCE((SELECT shared_visits_count_for_progression FROM grp), true) END,
      'externalParticipantCount', COALESCE(vpx.ext_count, 0),
      'participantIds', COALESCE(
        (SELECT jsonb_agg(vpr.user_id) FROM vp_relevant vpr WHERE vpr.visit_id = vg.visit_id),
        '[]'::jsonb),
      'participants', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
           'id', vpr.user_id,
           'name', COALESCE(NULLIF(trim(p.display_name),''),'Medlem'),
           'avatar', p.avatar_emoji,
           'avatarImage', p.avatar_url,
           'status', vpr.membership_status
         ))
         FROM vp_relevant vpr
         LEFT JOIN public.profiles p ON p.id = vpr.user_id
         WHERE vpr.visit_id = vg.visit_id),
        '[]'::jsonb),
      'reviews', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id', rv.review_id, 'userId', rv.user_id, 'overall', rv.overall,
          'taste', rv.taste, 'value', rv.value, 'service', rv.service,
          'comment', rv.comment,
          'ratingVisible', rv.rating_visible, 'commentVisible', rv.comment_visible
        )) FROM reviews_scoped rv WHERE rv.visit_id = vg.visit_id),
        '[]'::jsonb)
    )) AS arr
    FROM visits_in_group vg LEFT JOIN vp_external vpx ON vpx.visit_id = vg.visit_id
  ),
  favs_json AS (
    SELECT jsonb_agg(jsonb_build_object('memberId', user_id, 'placeId', place_id)) AS arr
    FROM public.favorites WHERE group_id = _group_id
  ),
  act_src AS (
    SELECT * FROM public.activity WHERE group_id = _group_id
    ORDER BY created_at DESC LIMIT 50
  ),
  act_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'memberId', COALESCE(actor_id, _uid),
      'placeId', place_id, 'visitId', visit_id, 'at', created_at,
      'text', COALESCE(payload->>'text','Aktivitet')
    )) AS arr FROM act_src
  ),
  members_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', user_id, 'name', COALESCE(NULLIF(trim(display_name),''),'Medlem'),
      'avatar', avatar_emoji, 'avatarImage', avatar_url, 'role', role
    )) AS arr FROM members
  ),
  places_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', place_id, 'name', name, 'category', category, 'cuisines', cuisines,
      'occasions', occasions, 'address', address, 'area', area, 'city', city,
      'lat', lat, 'lng', lng, 'photo', photo_url, 'notes', notes,
      'addedBy', added_by, 'addedAt', linked_at, 'origin', origin
    )) AS arr FROM places_agg
  )
  SELECT jsonb_build_object(
    'currentUserId', _uid,
    'group', jsonb_build_object(
      'id', grp.id, 'name', grp.name, 'emoji', COALESCE(grp.emoji,'🍽️'),
      'city', COALESCE(grp.home_location_label,''),
      'createdAt', grp.created_at, 'ownerId', COALESCE(grp.owner_id, grp.created_by),
      'sharedVisitsCountForProgression', grp.shared_visits_count_for_progression,
      'homeLocation', CASE
        WHEN grp.home_location_provider IS NOT NULL
             AND grp.home_location_place_id IS NOT NULL
             AND grp.home_lat IS NOT NULL
             AND grp.home_lng IS NOT NULL
             AND grp.home_location_label IS NOT NULL
        THEN jsonb_build_object(
          'label', grp.home_location_label,
          'lat', grp.home_lat,
          'lng', grp.home_lng,
          'provider', grp.home_location_provider,
          'placeId', grp.home_location_place_id,
          'verified', true
        )
        WHEN grp.home_location_label IS NOT NULL
        THEN jsonb_build_object(
          'label', grp.home_location_label,
          'verified', false
        )
        ELSE NULL
      END
    ),
    'members', COALESCE(members_json.arr, '[]'::jsonb),
    'places', COALESCE(places_json.arr, '[]'::jsonb),
    'visits', COALESCE(visits_json.arr, '[]'::jsonb),
    'favorites', COALESCE(favs_json.arr, '[]'::jsonb),
    'activity', COALESCE(act_json.arr, '[]'::jsonb),
    'nextPlaceId', (SELECT place_id FROM public.group_next_place WHERE group_id = _group_id)
  ) INTO _result
  FROM grp, members_json, places_json, visits_json, favs_json, act_json;
  RETURN _result;
END $function$;
