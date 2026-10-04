BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('39860000-0000-4000-8000-000000000001','queue-registration@example.invalid','{"full_name":"Kötest"}'::jsonb);
INSERT INTO public.profiles(id,display_name) VALUES
('39860000-0000-4000-8000-000000000001','Kötest') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.groups(id,name,created_by) VALUES
('39861000-0000-4000-8000-000000000001','Kötest','39860000-0000-4000-8000-000000000001');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
('39861000-0000-4000-8000-000000000001','39860000-0000-4000-8000-000000000001','owner','active') ON CONFLICT DO NOTHING;
INSERT INTO public.places(id,name,category,address,city,added_by) VALUES
('39862000-0000-4000-8000-000000000001','Köställe A','restaurang','Testgatan','Teststad','39860000-0000-4000-8000-000000000001'),
('39862000-0000-4000-8000-000000000002','Köställe B','restaurang','Testgatan','Teststad','39860000-0000-4000-8000-000000000001');
INSERT INTO public.group_places(group_id,place_id,added_by,occasions) VALUES
('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001','39860000-0000-4000-8000-000000000001',ARRAY['middag']),
('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000002','39860000-0000-4000-8000-000000000001',ARRAY['middag']);
INSERT INTO public.next_stop_place_proposals(group_id,place_id,proposed_by,created_at) VALUES
('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001','39860000-0000-4000-8000-000000000001','2026-09-25'),
('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000002','39860000-0000-4000-8000-000000000001','2026-09-26');
INSERT INTO public.group_next_place(group_id,place_id,selected_by) VALUES
('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001','39860000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='39860000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.create_visit_with_review_v5('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[])$$,'Ordinary visit can use the queued place');
RESET ROLE;
SELECT is((SELECT place_id FROM public.group_next_place WHERE group_id='39861000-0000-4000-8000-000000000001'),'39862000-0000-4000-8000-000000000001'::uuid,'Ordinary visit preserves selected head');
SELECT is((SELECT count(*) FROM public.next_stop_place_proposals WHERE group_id='39861000-0000-4000-8000-000000000001'),2::bigint,'Ordinary visit preserves both proposals');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'Explicit completion succeeds');
RESET ROLE;
SELECT is((SELECT place_id FROM public.group_next_place WHERE group_id='39861000-0000-4000-8000-000000000001'),'39862000-0000-4000-8000-000000000002'::uuid,'Explicit completion advances to B');
SELECT is((SELECT count(*) FROM public.next_stop_place_proposals WHERE group_id='39861000-0000-4000-8000-000000000001'),1::bigint,'Only completed proposal removed');
DELETE FROM public.group_next_place WHERE group_id='39861000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000002',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'Existing proposal without legacy selection can complete');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.group_next_place WHERE group_id='39861000-0000-4000-8000-000000000001'),0::bigint,'Last completion empties selected head');
SELECT is((SELECT count(*) FROM public.next_stop_place_proposals WHERE group_id='39861000-0000-4000-8000-000000000001'),0::bigint,'Last completion empties proposals');
INSERT INTO public.next_stop_place_proposals(group_id,place_id,proposed_by,created_at) VALUES
('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001','39860000-0000-4000-8000-000000000001','2026-09-25'),
('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000002','39860000-0000-4000-8000-000000000001','2026-09-26');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000002',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'P0001','Besöket matchar inte gruppens aktuella nästa stopp','Orphan recovery rejects later proposal');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.visits WHERE created_by='39860000-0000-4000-8000-000000000001'),3::bigint,'Rejected completion rolls back visit');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'Oldest active orphan proposal completes');
RESET ROLE;
SELECT is((SELECT place_id FROM public.group_next_place WHERE group_id='39861000-0000-4000-8000-000000000001'),'39862000-0000-4000-8000-000000000002'::uuid,'Recovered queue advances normally');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'P0001','Besöket matchar inte gruppens aktuella nästa stopp','Stale selected place is still rejected');
SELECT lives_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000002',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'Current selected place completes');
SELECT throws_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000002',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'P0001','Besöket matchar inte gruppens aktuella nästa stopp','Empty queue remains protected');
SET LOCAL request.jwt.claim.sub='';
SELECT throws_ok($$SELECT public.create_visit_with_review_v6('39861000-0000-4000-8000-000000000001','39862000-0000-4000-8000-000000000001',CURRENT_DATE,'dryck',ARRAY['39860000-0000-4000-8000-000000000001']::uuid[],_complete_next_stop=>true)$$,'P0001','Not authenticated','Anonymous actor rejected');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.create_visit_with_review_v6(uuid,uuid,date,text,uuid[],boolean,smallint,smallint,smallint,smallint,text,text[],text[],boolean)','EXECUTE'),'Anonymous role cannot call completion RPC');
SELECT * FROM finish();
ROLLBACK;
