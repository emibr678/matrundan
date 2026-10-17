BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

-- Issue #497: medlemmen ansluter efter ett redan registrerat originalbesök.
-- Inga befintliga riktiga person- eller gruppuppgifter används i testet.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  ('49700000-0000-4000-8000-000000000001','visit-497-actor@example.invalid','{"full_name":"Registrerare"}'::jsonb),
  ('49700000-0000-4000-8000-000000000002','visit-497-guest@example.invalid','{"full_name":"Senare medlem"}'::jsonb),
  ('49700000-0000-4000-8000-000000000003','visit-497-outside@example.invalid','{"full_name":"Utomstående"}'::jsonb);
INSERT INTO public.profiles(id,display_name) VALUES
  ('49700000-0000-4000-8000-000000000001','Registrerare'),
  ('49700000-0000-4000-8000-000000000002','Senare medlem'),
  ('49700000-0000-4000-8000-000000000003','Utomstående')
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.groups(id,name,created_by) VALUES
  ('49710000-0000-4000-8000-000000000001','Originalgrupp','49700000-0000-4000-8000-000000000001'),
  ('49710000-0000-4000-8000-000000000002','Olänkad grupp','49700000-0000-4000-8000-000000000001');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
  ('49710000-0000-4000-8000-000000000001','49700000-0000-4000-8000-000000000001','owner','active'),
  ('49710000-0000-4000-8000-000000000002','49700000-0000-4000-8000-000000000001','member','active'),
  ('49710000-0000-4000-8000-000000000002','49700000-0000-4000-8000-000000000003','member','active');

INSERT INTO public.places(id,name,category,address,city,added_by) VALUES
  ('49720000-0000-4000-8000-000000000001','Restaurang före medlemskap','restaurang','Testgatan 1','Teststad','49700000-0000-4000-8000-000000000001');
INSERT INTO public.group_places(group_id,place_id,added_by) VALUES
  ('49710000-0000-4000-8000-000000000001','49720000-0000-4000-8000-000000000001','49700000-0000-4000-8000-000000000001');
INSERT INTO public.visits(id,place_id,visited_on,meal_type,created_by) VALUES
  ('49730000-0000-4000-8000-000000000001','49720000-0000-4000-8000-000000000001',DATE '2026-10-14','middag','49700000-0000-4000-8000-000000000001');
INSERT INTO public.visit_group_links(visit_id,group_id,link_type,linked_by) VALUES
  ('49730000-0000-4000-8000-000000000001','49710000-0000-4000-8000-000000000001','original','49700000-0000-4000-8000-000000000001');
INSERT INTO public.visit_participants(visit_id,user_id) VALUES
  ('49730000-0000-4000-8000-000000000001','49700000-0000-4000-8000-000000000001');
INSERT INTO public.visit_guests(id,visit_id,display_name,sort_order) VALUES
  ('49740000-0000-4000-8000-000000000001','49730000-0000-4000-8000-000000000001','Roger',1);

-- Personen blir gruppmedlem först efter det registrerade besöket.
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
  ('49710000-0000-4000-8000-000000000001','49700000-0000-4000-8000-000000000002','member','active');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='49700000-0000-4000-8000-000000000001';

SELECT ok(EXISTS (
  SELECT 1
  FROM jsonb_array_elements(public.list_visit_guest_member_targets_v1(
    '49710000-0000-4000-8000-000000000001',
    '49730000-0000-4000-8000-000000000001'
  )) AS candidate
  WHERE candidate->>'guestId' = '49740000-0000-4000-8000-000000000001'
    AND candidate->>'groupId' = '49710000-0000-4000-8000-000000000001'
    AND candidate->>'memberId' = '49700000-0000-4000-8000-000000000002'
), 'Later member is a valid target within the single linked original group');

SELECT ok(NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(public.list_visit_guest_member_targets_v1(
    '49710000-0000-4000-8000-000000000001',
    '49730000-0000-4000-8000-000000000001'
  )) AS candidate
  WHERE candidate->>'groupId' = '49710000-0000-4000-8000-000000000002'
), 'An unlinked group is never returned among target candidates');

SELECT throws_ok(
  $$SELECT public.propose_visit_guest_member_v1(
    '49710000-0000-4000-8000-000000000001',
    '49730000-0000-4000-8000-000000000001',
    '49740000-0000-4000-8000-000000000001',
    '49710000-0000-4000-8000-000000000002',
    '49700000-0000-4000-8000-000000000003'
  )$$, 'P0001', 'Besöket måste först läggas till i målgruppen',
  'Cannot propose a link into an unrelated unlinked group'
);

SELECT throws_ok(
  $$SELECT public.propose_visit_guest_member_v1(
    '49710000-0000-4000-8000-000000000001',
    '49730000-0000-4000-8000-000000000001',
    '49740000-0000-4000-8000-000000000001',
    '49710000-0000-4000-8000-000000000001',
    '49700000-0000-4000-8000-000000000003'
  )$$, 'P0001', 'Personen är inte aktiv medlem i målgruppen',
  'Cannot target an account outside the original group'
);

SELECT lives_ok(
  $$SELECT public.propose_visit_guest_member_v1(
    '49710000-0000-4000-8000-000000000001',
    '49730000-0000-4000-8000-000000000001',
    '49740000-0000-4000-8000-000000000001',
    '49710000-0000-4000-8000-000000000001',
    '49700000-0000-4000-8000-000000000002'
  )$$,
  'Can send a precise identity question to a later member in the original group'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.visit_participants
   WHERE visit_id='49730000-0000-4000-8000-000000000001'
     AND user_id='49700000-0000-4000-8000-000000000002'),
  0, 'Sending the question does not award participation'
);
SELECT is(
  (SELECT status FROM public.visit_guest_member_proposals
   WHERE guest_id='49740000-0000-4000-8000-000000000001'),
  'pending', 'Proposal waits for a recipient response'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='49700000-0000-4000-8000-000000000003';
SELECT throws_ok(
  $$SELECT public.list_visit_guest_member_targets_v1(
    '49710000-0000-4000-8000-000000000001',
    '49730000-0000-4000-8000-000000000001'
  )$$, 'P0001', 'Du är inte aktiv medlem i gruppen',
  'An outsider cannot list private guest identities'
);

SET LOCAL request.jwt.claim.sub='49700000-0000-4000-8000-000000000002';
SELECT ok(
  (public.get_own_visit_guest_proposal_v1(
    '49710000-0000-4000-8000-000000000001',
    '49730000-0000-4000-8000-000000000001'
  )->>'status') = 'pending',
  'The later member can see their neutral pending question in the same group'
);

SELECT lives_ok(
  $$SELECT public.respond_visit_guest_proposal_v1(
    '49710000-0000-4000-8000-000000000001',
    (public.get_own_visit_guest_proposal_v1(
      '49710000-0000-4000-8000-000000000001',
      '49730000-0000-4000-8000-000000000001'
    )->>'proposalId')::uuid,
    'accept'
  )$$,
  'Only the recipient explicitly accepts before participation changes'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.visit_participants
   WHERE visit_id='49730000-0000-4000-8000-000000000001'
     AND user_id='49700000-0000-4000-8000-000000000002'),
  1, 'The same canonical visit has exactly one identified participation'
);
SELECT is(
  (SELECT status FROM public.visit_guest_member_proposals
   WHERE guest_id='49740000-0000-4000-8000-000000000001'),
  'accepted', 'The same guest identity is confirmed, without a new visit'
);

SELECT * FROM finish();
ROLLBACK;
