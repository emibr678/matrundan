BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(38);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('10900000-0000-4000-8000-000000000001', 'journey-viewer@example.invalid', '{"full_name":"Resenären"}'::jsonb),
  ('10900000-0000-4000-8000-000000000002', 'journey-friend@example.invalid', '{"full_name":"Vännen"}'::jsonb),
  ('10900000-0000-4000-8000-000000000003', 'journey-outsider@example.invalid', '{"full_name":"Utomstående"}'::jsonb);

INSERT INTO public.profiles (id, display_name)
VALUES
  ('10900000-0000-4000-8000-000000000001', 'Resenären'),
  ('10900000-0000-4000-8000-000000000002', 'Vännen'),
  ('10900000-0000-4000-8000-000000000003', 'Utomstående')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.groups (id, name, created_by)
VALUES
  ('10910000-0000-4000-8000-000000000001', 'Enskede', '10900000-0000-4000-8000-000000000002'),
  ('10910000-0000-4000-8000-000000000002', 'Hemlig grupp', '10900000-0000-4000-8000-000000000003'),
  ('10910000-0000-4000-8000-000000000003', 'Arkiverad resa', '10900000-0000-4000-8000-000000000002');

INSERT INTO public.memberships (group_id, user_id, role, status)
VALUES
  ('10910000-0000-4000-8000-000000000001', '10900000-0000-4000-8000-000000000002', 'owner', 'active'),
  ('10910000-0000-4000-8000-000000000001', '10900000-0000-4000-8000-000000000001', 'member', 'active'),
  ('10910000-0000-4000-8000-000000000002', '10900000-0000-4000-8000-000000000003', 'owner', 'active'),
  ('10910000-0000-4000-8000-000000000003', '10900000-0000-4000-8000-000000000002', 'owner', 'active'),
  ('10910000-0000-4000-8000-000000000003', '10900000-0000-4000-8000-000000000001', 'member', 'active');

INSERT INTO public.places (id, name, category, address, area, city, added_by)
VALUES
  (
    '10920000-0000-4000-8000-000000000001', 'Gemensamma krogen', 'restaurang',
    'Testgatan 1', 'Söder', 'Stockholm', '10900000-0000-4000-8000-000000000001'
  ),
  (
    '10920000-0000-4000-8000-000000000002', 'Hemliga krogen', 'restaurang',
    'Privatgatan 2', 'Norr', 'Stockholm', '10900000-0000-4000-8000-000000000003'
  ),
  (
    '10920000-0000-4000-8000-000000000003', 'Andra stället', 'café',
    'Testgatan 3', 'Söder', 'Stockholm', '10900000-0000-4000-8000-000000000001'
  );

INSERT INTO public.group_places (group_id, place_id, added_by, notes, occasions)
VALUES
  (
    '10910000-0000-4000-8000-000000000001',
    '10920000-0000-4000-8000-000000000001',
    '10900000-0000-4000-8000-000000000001',
    'Privat gruppanteckning får inte läcka',
    ARRAY['avslappnat']::text[]
  ),
  (
    '10910000-0000-4000-8000-000000000003',
    '10920000-0000-4000-8000-000000000001',
    '10900000-0000-4000-8000-000000000001',
    'Annan privat gruppanteckning',
    ARRAY['middag']::text[]
  ),
  (
    '10910000-0000-4000-8000-000000000001',
    '10920000-0000-4000-8000-000000000003',
    '10900000-0000-4000-8000-000000000001',
    NULL,
    ARRAY['snabbt']::text[]
  ),
  (
    '10910000-0000-4000-8000-000000000002',
    '10920000-0000-4000-8000-000000000002',
    '10900000-0000-4000-8000-000000000003',
    'Hemligt',
    ARRAY['avslappnat']::text[]
  );

INSERT INTO public.favorites (user_id, place_id, group_id)
VALUES
  (
    '10900000-0000-4000-8000-000000000001',
    '10920000-0000-4000-8000-000000000001',
    '10910000-0000-4000-8000-000000000001'
  ),
  (
    '10900000-0000-4000-8000-000000000001',
    '10920000-0000-4000-8000-000000000001',
    '10910000-0000-4000-8000-000000000003'
  );

INSERT INTO public.visits (id, place_id, visited_on, meal_type, is_takeaway, created_by)
VALUES
  (
    '10930000-0000-4000-8000-000000000001',
    '10920000-0000-4000-8000-000000000001',
    current_date - 1,
    'middag',
    false,
    '10900000-0000-4000-8000-000000000002'
  ),
  (
    '10930000-0000-4000-8000-000000000002',
    '10920000-0000-4000-8000-000000000002',
    current_date - 2,
    'middag',
    false,
    '10900000-0000-4000-8000-000000000003'
  );

INSERT INTO public.visit_group_links (visit_id, group_id, link_type, linked_by)
VALUES
  (
    '10930000-0000-4000-8000-000000000001',
    '10910000-0000-4000-8000-000000000001',
    'original',
    '10900000-0000-4000-8000-000000000002'
  ),
  (
    '10930000-0000-4000-8000-000000000001',
    '10910000-0000-4000-8000-000000000003',
    'shared',
    '10900000-0000-4000-8000-000000000001'
  ),
  (
    '10930000-0000-4000-8000-000000000002',
    '10910000-0000-4000-8000-000000000002',
    'original',
    '10900000-0000-4000-8000-000000000003'
  );

INSERT INTO public.visit_participants (visit_id, user_id)
VALUES
  ('10930000-0000-4000-8000-000000000001', '10900000-0000-4000-8000-000000000001'),
  ('10930000-0000-4000-8000-000000000001', '10900000-0000-4000-8000-000000000002'),
  ('10930000-0000-4000-8000-000000000002', '10900000-0000-4000-8000-000000000003');

INSERT INTO public.reviews (
  id, visit_id, user_id, overall, taste, value, service, atmosphere, review_model, comment
)
VALUES
  (
    '10940000-0000-4000-8000-000000000001',
    '10930000-0000-4000-8000-000000000001',
    '10900000-0000-4000-8000-000000000002',
    4.00, 5, 4, 3, 4, 'food_v1_atmosphere', 'Synlig kommentar'
  ),
  (
    '10940000-0000-4000-8000-000000000002',
    '10930000-0000-4000-8000-000000000002',
    '10900000-0000-4000-8000-000000000003',
    1.00, 1, 1, 1, 1, 'food_v1_atmosphere', 'Superhemlig kommentar'
  );

INSERT INTO public.review_group_visibility (
  review_id, group_id, rating_visible, comment_visible
)
VALUES
  (
    '10940000-0000-4000-8000-000000000001',
    '10910000-0000-4000-8000-000000000001',
    true,
    true
  ),
  (
    '10940000-0000-4000-8000-000000000001',
    '10910000-0000-4000-8000-000000000003',
    true,
    false
  ),
  (
    '10940000-0000-4000-8000-000000000002',
    '10910000-0000-4000-8000-000000000002',
    true,
    true
  );

INSERT INTO public.visit_media (
  id, visit_id, group_id, storage_path, uploaded_by,
  mime_type, byte_size, width, height
)
VALUES (
  '10950000-0000-4000-8000-000000000001',
  '10930000-0000-4000-8000-000000000001',
  '10910000-0000-4000-8000-000000000001',
  '10910000-0000-4000-8000-000000000001/10930000-0000-4000-8000-000000000001/secret.jpg',
  '10900000-0000-4000-8000-000000000002',
  'image/jpeg',
  1234,
  800,
  600
);

UPDATE public.groups
SET lifecycle_status = 'archived',
    archived_at = now(),
    archived_by = '10900000-0000-4000-8000-000000000002'
WHERE id = '10910000-0000-4000-8000-000000000003';

SELECT ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.get_personal_journey_overview_v1()', 'EXECUTE'
  ),
  'authenticated can execute the personal overview'
);

SELECT ok(
  NOT pg_catalog.has_function_privilege(
    'anon', 'public.get_personal_journey_overview_v1()', 'EXECUTE'
  ),
  'anon cannot execute the personal overview'
);

SELECT ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_personal_journey_overview_v2()',
    'EXECUTE'
  ),
  'authenticated can execute the personal insight overview'
);

SELECT ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.list_personal_journey_places_v2(text,boolean,boolean,text,jsonb,integer)',
    'EXECUTE'
  ),
  'anon cannot execute the sortable personal place list'
);

SELECT ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated', 'public.personal_journey_effective_review_overall_v1(uuid)', 'EXECUTE'
  ),
  'the arbitrary-review helper remains internal'
);

SELECT ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_personal_journey_toplist_v1(text,text[],text[],boolean,jsonb,integer)',
    'EXECUTE'
  ),
  'authenticated can execute the personal Topplista'
);

SELECT ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.get_personal_journey_toplist_v1(text,text[],text[],boolean,jsonb,integer)',
    'EXECUTE'
  ),
  'anon cannot execute the personal Topplista'
);

SELECT is(
  to_regprocedure('public.get_personal_journey_overview_v1(uuid)'),
  NULL::regprocedure,
  'overview has no client-supplied user overload'
);

SELECT is(
  to_regprocedure('public.get_personal_journey_overview_v1(uuid[])'),
  NULL::regprocedure,
  'overview has no client-supplied group-list overload'
);

SELECT lives_ok(
  $$INSERT INTO public.favorites (user_id, place_id, group_id)
    VALUES (
      '10900000-0000-4000-8000-000000000001',
      '10920000-0000-4000-8000-000000000003',
      '10910000-0000-4000-8000-000000000001'
    )$$,
  'group-scoped favorite key accepts another place without disturbing cross-group favorites'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '10900000-0000-4000-8000-000000000001';

SELECT is(
  (public.get_personal_journey_overview_v1()->'summary'->>'readableGroupCount')::integer,
  2,
  'active membership keeps both active and archived groups readable'
);

SELECT is(
  (public.get_personal_journey_overview_v1()->'summary'->>'activeGroupCount')::integer,
  1,
  'archived groups are not writable contexts'
);

SELECT is(
  (public.get_personal_journey_overview_v1()->'summary'->>'attendedVisitCount')::integer,
  1,
  'the same canonical visit is counted once across groups'
);

SELECT is(
  jsonb_array_length(public.get_personal_journey_overview_v1()->'pendingReviews'),
  1,
  'a pending own review appears once across groups'
);

SELECT is(
  jsonb_array_length(public.get_personal_journey_overview_v2()->'topRatedPlaces'),
  1,
  'the personal overview shows only rated readable places as top rated'
);

SELECT is(
  public.get_personal_journey_toplist_v1(NULL, ARRAY['avslappnat'], ARRAY['middag'], false, NULL, 3)
    ->'items'->0->>'id',
  '10920000-0000-4000-8000-000000000001',
  'Topplista filters by a readable group experience and visit context'
);

SELECT is(
  (
    public.get_personal_journey_toplist_v1(
      NULL, ARRAY[]::text[], ARRAY[]::text[], false, NULL, 1
    )->'items'->0->>'rank'
  )::integer,
  1,
  'Topplista returns a stable absolute rank'
);


SELECT is(
  jsonb_array_length(
    public.get_personal_journey_toplist_v1(NULL, ARRAY['snabbt'], ARRAY['middag'], false, NULL, 3)->'items'
  ),
  0,
  'Topplista does not invent ratings for an experience without matching scored visits'
);

SELECT throws_ok(
  $SELECT public.get_personal_journey_toplist_v1(NULL, ARRAY['hemlig'], ARRAY[]::text[], false, NULL, 3)$,
  'P0001',
  'Ogiltig typ av upplevelse',
  'unknown experience filters are rejected server-side'
);

SELECT throws_ok(
  $SELECT public.get_personal_journey_toplist_v1(NULL, ARRAY[]::text[], ARRAY['kväll'], false, NULL, 3)$,
  'P0001',
  'Ogiltigt tillfälle',
  'unknown Topplista meal filters are rejected server-side'
);

SELECT is(
  public.get_personal_journey_overview_v2()->'topRatedPlaces'->0->>'id',
  '10920000-0000-4000-8000-000000000001',
  'the highest-rated section uses the canonical readable place'
);

SELECT is(
  public.list_personal_journey_places_v2(NULL, false, false, 'rating', NULL, 1)->'nextCursor'->>'id',
  '10920000-0000-4000-8000-000000000001',
  'sortable place pagination returns a stable cursor when more rows exist'
);

SELECT throws_ok(
  $$SELECT public.list_personal_journey_places_v2(NULL, false, false, 'hemlig', NULL, 20)$$,
  'P0001',
  'Ogiltig sortering',
  'unknown personal place sorts are rejected server-side'
);

SELECT is(
  jsonb_array_length(public.list_personal_journey_places_v1()->'items'),
  2,
  'place list includes only places from readable active collections'
);

SELECT is(
  jsonb_array_length(
    public.list_personal_journey_places_v1(NULL, true, false, NULL, NULL, 20)->'items'
  ),
  2,
  'favorite filter uses the current user and group-scoped favorites'
);

SELECT is(
  jsonb_array_length(
    public.list_personal_journey_places_v1(NULL, false, true, NULL, NULL, 20)->'items'
  ),
  1,
  'visited-by-me filter follows canonical participation'
);

SELECT is(
  jsonb_array_length(
    public.list_personal_journey_places_v1(NULL, false, false, NULL, NULL, 1)->'items'
  ),
  1,
  'place pagination respects the requested page size'
);

SELECT isnt(
  public.list_personal_journey_places_v1(NULL, false, false, NULL, NULL, 1)->'nextCursor',
  'null'::jsonb,
  'place pagination returns a stable cursor when more rows exist'
);

SELECT is(
  (public.get_personal_journey_place_v1('10920000-0000-4000-8000-000000000001')->>'reviewCount')::integer,
  1,
  'the same review visible through two groups contributes once'
);

SELECT is(
  jsonb_array_length(
    public.get_personal_journey_place_v1('10920000-0000-4000-8000-000000000001')->'groups'
  ),
  2,
  'place detail keeps explicit readable group contexts'
);

SELECT is(
  jsonb_array_length(public.list_personal_journey_visits_v1()->'items'),
  1,
  'visit list deduplicates the canonical visit and hides inaccessible visits'
);

SELECT is(
  (public.list_personal_journey_visits_v1()->'items'->0->>'reviewCount')::integer,
  1,
  'visit rating aggregates deduplicate review visibility rows'
);

SELECT isnt(
  public.list_personal_journey_visits_v1()->'items'->0->'photoDeliveryToken',
  'null'::jsonb,
  'source-group media is exposed through an opaque delivery token'
);

SELECT is(
  jsonb_array_length(
    public.get_personal_journey_visit_v1('10930000-0000-4000-8000-000000000001')->'reviews'
  ),
  1,
  'visit detail returns only reviews visible in a readable group'
);

SELECT ok(
  public.get_personal_journey_visit_v1('10930000-0000-4000-8000-000000000001')::text
    NOT LIKE '%storagePath%'
  AND public.get_personal_journey_visit_v1('10930000-0000-4000-8000-000000000001')::text
    NOT LIKE '%secret.jpg%'
  AND public.get_personal_journey_place_v1('10920000-0000-4000-8000-000000000001')::text
    NOT LIKE '%Privat gruppanteckning%'
  AND public.get_personal_journey_visit_v1('10930000-0000-4000-8000-000000000001')::text
    NOT LIKE '%Superhemlig kommentar%',
  'raw media paths, group overrides and inaccessible comments do not leak'
);

SELECT is(
  public.get_personal_journey_place_v1('10920000-0000-4000-8000-000000000002'),
  NULL,
  'inaccessible place detail returns no data'
);

SELECT is(
  public.get_personal_journey_visit_v1('10930000-0000-4000-8000-000000000002'),
  NULL,
  'inaccessible visit detail returns no data'
);

RESET ROLE;

UPDATE public.memberships
SET status = 'left', left_at = now()
WHERE user_id = '10900000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '10900000-0000-4000-8000-000000000001';

SELECT is(
  (public.get_personal_journey_overview_v1()->'summary'->>'readableGroupCount')::integer,
  0,
  'membership loss immediately removes groups from the overview'
);

SELECT is(
  jsonb_array_length(public.list_personal_journey_visits_v1()->'items'),
  0,
  'membership loss immediately removes visit access'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
