
-- 1) Härdad can_see_place: enargsversion med auth.uid(), drop av tvåargsversion.
DROP POLICY IF EXISTS "places readable via can_see_place" ON public.places;
DROP FUNCTION IF EXISTS public.can_see_place(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_see_place(_place_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_places gp
    JOIN public.memberships m
      ON m.group_id = gp.group_id
     AND m.user_id = auth.uid()
     AND m.status = 'active'
    WHERE gp.place_id = _place_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_see_place(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_place(uuid) TO authenticated, service_role;

CREATE POLICY "places readable via can_see_place"
ON public.places FOR SELECT
TO authenticated
USING (public.can_see_place(id));


-- 2) get_group_app_state: grupprelevanta deltagare/recensioner = medlemskapsrad
-- oavsett status (active/left). Endast helt utomstående räknas som externa.
-- Lägger till strukturerade `participants` per visit (endast medlemsrad, med status).
CREATE OR REPLACE FUNCTION public.get_group_app_state(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
    -- Deltagare som är eller har varit medlemmar i gruppen.
    SELECT vp.visit_id, vp.user_id, mm.status AS membership_status
    FROM public.visit_participants vp
    JOIN public.memberships mm
      ON mm.group_id = _group_id AND mm.user_id = vp.user_id
  ),
  vp_external AS (
    -- Deltagare helt utan medlemskapsrad i gruppen.
    SELECT vp.visit_id, count(*)::int AS ext_count
    FROM public.visit_participants vp
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships mm
      WHERE mm.group_id = _group_id AND mm.user_id = vp.user_id
    )
    GROUP BY vp.visit_id
  ),
  reviews_scoped AS (
    -- Inkludera: (a) rating_visible=true där författaren har medlemskapsrad
    -- i gruppen (aktiv eller tidigare), (b) alltid current user's egen review.
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
      'sharedVisitsCountForProgression', grp.shared_visits_count_for_progression
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


-- 3) list_visit_share_targets: visible participants + relevant reviews räknas
-- från membership-rad oavsett status. Målgruppslistan förblir _uid:s AKTIVA grupper.
CREATE OR REPLACE FUNCTION public.list_visit_share_targets(_visit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _uid uuid := auth.uid(); _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.visit_participants
                 WHERE visit_id = _visit_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Not a participant of this visit';
  END IF;

  WITH my_groups AS (
    SELECT g.id, g.name, g.emoji, g.shared_visits_count_for_progression
    FROM public.memberships m
    JOIN public.groups g ON g.id = m.group_id
    WHERE m.user_id = _uid AND m.status = 'active'
  ),
  vp AS ( SELECT user_id FROM public.visit_participants WHERE visit_id = _visit_id ),
  own_comment AS (
    SELECT (comment IS NOT NULL AND length(trim(comment)) > 0) AS has_comment
    FROM public.reviews WHERE visit_id = _visit_id AND user_id = _uid
    LIMIT 1
  ),
  rows AS (
    SELECT
      mg.id AS group_id, mg.name AS group_name, mg.emoji AS group_emoji,
      mg.shared_visits_count_for_progression,
      EXISTS(SELECT 1 FROM public.visit_group_links vgl
             WHERE vgl.visit_id = _visit_id AND vgl.group_id = mg.id) AS already_linked,
      (SELECT count(*)::int FROM vp
        WHERE NOT EXISTS (SELECT 1 FROM public.memberships mm
                          WHERE mm.group_id = mg.id AND mm.user_id = vp.user_id)
      ) AS external_participant_count,
      (SELECT jsonb_agg(jsonb_build_object(
         'id', p.id,
         'name', COALESCE(NULLIF(trim(p.display_name),''),'Medlem'),
         'avatar', p.avatar_emoji,
         'avatarImage', p.avatar_url,
         'status', mm.status
       ))
       FROM vp
       JOIN public.memberships mm
         ON mm.group_id = mg.id AND mm.user_id = vp.user_id
       LEFT JOIN public.profiles p ON p.id = vp.user_id
      ) AS visible_participants,
      (SELECT count(*)::int
         FROM public.reviews r
         JOIN public.memberships mm
           ON mm.group_id = mg.id AND mm.user_id = r.user_id
        WHERE r.visit_id = _visit_id
      ) AS relevant_review_count,
      COALESCE((SELECT has_comment FROM own_comment), false) AS own_has_comment
    FROM my_groups mg
  )
  SELECT jsonb_agg(jsonb_build_object(
    'groupId', group_id,
    'name', group_name,
    'emoji', COALESCE(group_emoji,'🍽️'),
    'alreadyLinked', already_linked,
    'externalParticipantCount', external_participant_count,
    'visibleParticipants', COALESCE(visible_participants, '[]'::jsonb),
    'relevantReviewCount', relevant_review_count,
    'ownHasComment', own_has_comment,
    'sharedVisitsCountForProgression', shared_visits_count_for_progression
  ) ORDER BY already_linked ASC, group_name ASC) INTO _result FROM rows;

  RETURN COALESCE(_result, '[]'::jsonb);
END $function$;


-- 4) share_visit_to_group: skapa visibility för reviews vars författare har
-- membership-rad i target, oavsett status. Auth.uid() måste fortsatt vara AKTIV medlem.
CREATE OR REPLACE FUNCTION public.share_visit_to_group(
  _visit_id uuid, _target_group_id uuid, _share_own_comment boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _place_id uuid; _place_name text; _source_group uuid; _actor_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_membership(_target_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte medlem i målgruppen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.visit_participants
                 WHERE visit_id = _visit_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Du deltog inte i besöket';
  END IF;
  IF EXISTS (SELECT 1 FROM public.visit_group_links
             WHERE visit_id = _visit_id AND group_id = _target_group_id) THEN
    RAISE EXCEPTION 'Besöket är redan tillagt i denna grupp'
      USING ERRCODE = 'unique_violation';
  END IF;

  SELECT v.place_id, p.name INTO _place_id, _place_name
  FROM public.visits v JOIN public.places p ON p.id = v.place_id
  WHERE v.id = _visit_id;
  IF _place_id IS NULL THEN RAISE EXCEPTION 'Besök saknas'; END IF;

  SELECT group_id INTO _source_group
  FROM public.visit_group_links
  WHERE visit_id = _visit_id AND link_type = 'original'
  LIMIT 1;

  INSERT INTO public.group_places (group_id, place_id, added_by, origin, source_group_id)
  VALUES (_target_group_id, _place_id, _uid, 'shared_visit', _source_group)
  ON CONFLICT (group_id, place_id) DO NOTHING;

  INSERT INTO public.visit_group_links (visit_id, group_id, link_type, linked_by, source_group_id)
  VALUES (_visit_id, _target_group_id, 'shared', _uid, _source_group);

  -- Synlighet för recensioner från personer som är eller har varit medlemmar
  -- i målgruppen. Rating synligt, kommentar dold (egen kommentar per param).
  INSERT INTO public.review_group_visibility (review_id, group_id, rating_visible, comment_visible)
  SELECT r.id, _target_group_id, true,
         CASE WHEN r.user_id = _uid THEN _share_own_comment ELSE false END
  FROM public.reviews r
  WHERE r.visit_id = _visit_id
    AND EXISTS (SELECT 1 FROM public.memberships mm
                WHERE mm.group_id = _target_group_id AND mm.user_id = r.user_id)
  ON CONFLICT (review_id, group_id) DO NOTHING;

  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.activity (group_id, kind, actor_id, place_id, visit_id, payload)
  VALUES (_target_group_id, 'visited', _uid, _place_id, _visit_id,
    jsonb_build_object('text',
      coalesce(_actor_name,'Någon') || ' lade till ett besök på ' || coalesce(_place_name,'ett ställe') || ' i gruppen',
      'shared', true));

  RETURN _target_group_id;
END $function$;


-- 5) remove_shared_visit_from_group: kräv AKTIV medlem, radera aktivitetspost
-- för samma visit i denna grupp (endast payload.shared=true), atomiskt.
CREATE OR REPLACE FUNCTION public.remove_shared_visit_from_group(
  _visit_id uuid, _group_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _uid uuid := auth.uid(); _link record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Tidigare medlem får inte unlinka: kräv aktivt medlemskap i gruppen.
  IF NOT public.has_membership(_group_id, _uid) THEN
    RAISE EXCEPTION 'Du är inte aktiv medlem i gruppen';
  END IF;

  SELECT * INTO _link FROM public.visit_group_links
   WHERE visit_id = _visit_id AND group_id = _group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Länken finns inte'; END IF;
  IF _link.link_type = 'original' THEN
    RAISE EXCEPTION 'Originalbesöket kan inte tas bort från sin egen grupp';
  END IF;
  IF _link.linked_by <> _uid
     AND NOT public.has_group_role(_group_id, _uid, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Endast personen som la till besöket, eller en ägare/admin, kan ta bort det';
  END IF;

  -- Atomiskt: ta bort synligheter, aktivitetspost i denna grupp, och länken.
  DELETE FROM public.review_group_visibility rgv
   USING public.reviews r
   WHERE rgv.review_id = r.id
     AND r.visit_id = _visit_id
     AND rgv.group_id = _group_id;

  DELETE FROM public.activity
   WHERE group_id = _group_id
     AND visit_id = _visit_id
     AND COALESCE((payload->>'shared')::boolean, false) = true;

  DELETE FROM public.visit_group_links
   WHERE visit_id = _visit_id AND group_id = _group_id;
END $function$;
