BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(24);

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('39800000-0000-4000-8000-000000000001','sharing-1@example.invalid','{"full_name":"Person 1"}'::jsonb),
('39800000-0000-4000-8000-000000000002','sharing-2@example.invalid','{"full_name":"Person 2"}'::jsonb),
('39800000-0000-4000-8000-000000000003','sharing-3@example.invalid','{"full_name":"Person 3"}'::jsonb);
INSERT INTO public.profiles(id,display_name) VALUES
('39800000-0000-4000-8000-000000000001','Person 1'),
('39800000-0000-4000-8000-000000000002','Person 2'),
('39800000-0000-4000-8000-000000000003','Person 3') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.groups(id,name,created_by) VALUES
('39810000-0000-4000-8000-000000000001','Grupp 1','39800000-0000-4000-8000-000000000003'),
('39810000-0000-4000-8000-000000000002','Grupp 2','39800000-0000-4000-8000-000000000003'),
('39810000-0000-4000-8000-000000000003','Grupp 3','39800000-0000-4000-8000-000000000003');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
('39810000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000001','member','active'),
('39810000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000002','member','active'),
('39810000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000003','owner','active'),
('39810000-0000-4000-8000-000000000002','39800000-0000-4000-8000-000000000001','member','active'),
('39810000-0000-4000-8000-000000000002','39800000-0000-4000-8000-000000000002','member','active'),
('39810000-0000-4000-8000-000000000002','39800000-0000-4000-8000-000000000003','owner','active'),
('39810000-0000-4000-8000-000000000003','39800000-0000-4000-8000-000000000001','member','active'),
('39810000-0000-4000-8000-000000000003','39800000-0000-4000-8000-000000000002','member','active'),
('39810000-0000-4000-8000-000000000003','39800000-0000-4000-8000-000000000003','owner','active');
INSERT INTO public.places(id,name,category,address,city,added_by) VALUES('39820000-0000-4000-8000-000000000001','Teststället','restaurang','Testgatan','Teststad','39800000-0000-4000-8000-000000000001');
INSERT INTO public.group_places(group_id,place_id,added_by,notes,occasions) VALUES('39810000-0000-4000-8000-000000000001','39820000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000001','Privat original',ARRAY['avslappnat']),('39810000-0000-4000-8000-000000000002','39820000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000001','Målets anteckning',ARRAY['middag']);
INSERT INTO public.visits(id,place_id,visited_on,meal_type,created_by) VALUES('39830000-0000-4000-8000-000000000001','39820000-0000-4000-8000-000000000001','2026-09-20','middag','39800000-0000-4000-8000-000000000003');
INSERT INTO public.visit_group_links(visit_id,group_id,link_type,linked_by) VALUES('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000001','original','39800000-0000-4000-8000-000000000003');
INSERT INTO public.visit_participants(visit_id,user_id) VALUES('39830000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000001'),('39830000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000002');
INSERT INTO public.reviews(id,visit_id,user_id,overall,taste,value,service,atmosphere,review_model,comment) VALUES('39840000-0000-4000-8000-000000000001','39830000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000001',4,5,4,3,4,'food_v1_atmosphere','Kommentar 1'),('39840000-0000-4000-8000-000000000002','39830000-0000-4000-8000-000000000001','39800000-0000-4000-8000-000000000002',4,5,4,3,4,'food_v1_atmosphere','Kommentar 2');
INSERT INTO public.review_group_visibility(review_id,group_id,rating_visible,comment_visible) VALUES('39840000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000001',true,true),('39840000-0000-4000-8000-000000000002','39810000-0000-4000-8000-000000000001',true,true) ON CONFLICT(review_id,group_id) DO UPDATE SET comment_visible=true;
INSERT INTO public.visit_media(id,visit_id,group_id,storage_path,uploaded_by,mime_type,byte_size,width,height) VALUES('39850000-0000-4000-8000-000000000001','39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000001/39830000-0000-4000-8000-000000000001/39800000-0000-4000-8000-000000000001.jpg','39800000-0000-4000-8000-000000000001','image/jpeg',1234,800,600),('39850000-0000-4000-8000-000000000002','39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000001/39830000-0000-4000-8000-000000000001/39800000-0000-4000-8000-000000000002.jpg','39800000-0000-4000-8000-000000000002','image/jpeg',1234,800,600);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '39800000-0000-4000-8000-000000000003';
SELECT throws_ok($$SELECT public.share_visit_to_group_v5('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000002',true,false,true)$$,'P0001','Endast faktiska deltagare kan lägga till besöket','Registrar and group owner cannot share without participation');
SET LOCAL request.jwt.claim.sub = '39800000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.share_visit_to_group_v5('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000002',true,false,true)$$,'Participant shares own content');
SELECT lives_ok($$SELECT public.share_visit_to_group_v5('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000002',false,false,false)$$,'Retry with false flags is idempotent and does not revoke');
SELECT is(public.get_visit_content_impact_v1('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000002'), '{"commentSharedElsewhere":true,"photoSharedElsewhere":true}'::jsonb,'Impact exposes only two booleans');
SELECT throws_ok($$SELECT public.get_visit_content_impact_v1('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000002','39800000-0000-4000-8000-000000000002')$$,'P0001','Du kan bara läsa konsekvenser för ditt eget innehåll','Member cannot inspect another participant');
SELECT ok(EXISTS(SELECT 1 FROM jsonb_array_elements(public.list_visit_share_targets_v6('39830000-0000-4000-8000-000000000001')) item WHERE item->>'groupId'='39810000-0000-4000-8000-000000000002' AND (item->>'ownCommentShared')::boolean AND (item->>'ownPhotoShared')::boolean),'Targets reflect own grants on an existing link');
SELECT ok(EXISTS(SELECT 1 FROM jsonb_array_elements(public.list_own_visits_for_place_on_add_v2('39820000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000003')) item WHERE item->>'visitId'='39830000-0000-4000-8000-000000000001' AND (item->>'ownHasPhoto')::boolean),'Previous visits include own photo availability');
SET LOCAL request.jwt.claim.sub = '39800000-0000-4000-8000-000000000002';
SELECT lives_ok($$SELECT public.share_visit_to_group_v5('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000002',true,false,true)$$,'Second participant can grant own content on existing link');
SELECT lives_ok($$SELECT public.share_visit_to_group_v5('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000003',true,false,true)$$,'Further sharing reuses the canonical visit');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.visits WHERE id='39830000-0000-4000-8000-000000000001')::bigint,1::bigint,'No visit copy');
SELECT is((SELECT count(*) FROM public.visit_group_links WHERE visit_id='39830000-0000-4000-8000-000000000001')::bigint,3::bigint,'Exactly one link per target');
SELECT is((SELECT count(*) FROM public.activity WHERE visit_id='39830000-0000-4000-8000-000000000001' AND group_id='39810000-0000-4000-8000-000000000002' AND kind='visited')::bigint,1::bigint,'Retries and additional content create no extra activity');
SELECT is((SELECT count(*) FROM public.reviews WHERE visit_id='39830000-0000-4000-8000-000000000001' AND overall=4 AND taste=5 AND value=4 AND service=3 AND atmosphere=4 AND review_model='food_v1_atmosphere')::bigint,2::bigint,'Canonical ratings and models preserved');
SELECT is((SELECT count(*) FROM public.review_group_visibility WHERE group_id='39810000-0000-4000-8000-000000000002' AND review_id IN ('39840000-0000-4000-8000-000000000001','39840000-0000-4000-8000-000000000002') AND comment_visible)::bigint,2::bigint,'False flags preserved first grant and second participant added theirs');
SELECT is((SELECT count(*) FROM public.visit_media_group_visibility WHERE visit_id='39830000-0000-4000-8000-000000000001' AND group_id='39810000-0000-4000-8000-000000000002')::bigint,2::bigint,'Only each participant own photo granted');
SELECT is((SELECT notes FROM public.group_places WHERE group_id='39810000-0000-4000-8000-000000000002' AND place_id='39820000-0000-4000-8000-000000000001'),'Målets anteckning','Target metadata preserved');
UPDATE public.memberships SET status='left' WHERE group_id='39810000-0000-4000-8000-000000000003' AND user_id='39800000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='39800000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.share_visit_to_group_v5('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000003',true,false,true)$$,'P0001','Du är inte aktiv medlem i målgruppen','Membership is revalidated on an existing link');
RESET ROLE;
UPDATE public.groups SET lifecycle_status='archived',archived_at=now(),archived_by='39800000-0000-4000-8000-000000000003' WHERE id='39810000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='39800000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.share_visit_to_group_v5('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000003',true,false,true)$$,'P0001','Målgruppen är inte aktiv','Archived group rejected even on existing link');
RESET ROLE;
DELETE FROM public.visit_group_links WHERE visit_id='39830000-0000-4000-8000-000000000001' AND group_id='39810000-0000-4000-8000-000000000002';
SELECT is((SELECT count(*) FROM public.visit_media_group_visibility WHERE visit_id='39830000-0000-4000-8000-000000000001' AND group_id='39810000-0000-4000-8000-000000000002')::bigint,0::bigint,'Unlink removes target photo grants');
SELECT is((SELECT count(*) FROM public.review_group_visibility WHERE group_id='39810000-0000-4000-8000-000000000002' AND review_id IN ('39840000-0000-4000-8000-000000000001','39840000-0000-4000-8000-000000000002'))::bigint,0::bigint,'Unlink removes target review visibility');
SELECT is((SELECT count(*) FROM public.visits WHERE id='39830000-0000-4000-8000-000000000001')::bigint,1::bigint,'Unlink preserves canonical event');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='39800000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.get_visit_content_impact_v1('39830000-0000-4000-8000-000000000001','39810000-0000-4000-8000-000000000002')$$,'P0001','Besöket är inte tillgängligt i gruppen','Impact requires current visit link');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.share_visit_to_group_v5(uuid,uuid,boolean,boolean,boolean)','EXECUTE'),'Anonymous mutation denied');
SELECT ok(NOT has_function_privilege('anon','public.get_visit_content_impact_v1(uuid,uuid,uuid)','EXECUTE'),'Anonymous impact denied');
SELECT * FROM finish();
ROLLBACK;
