BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(25);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('39600000-0000-4000-8000-000000000001','sharing-1@example.invalid','{"full_name":"Person 1"}'::jsonb),
('39600000-0000-4000-8000-000000000002','sharing-2@example.invalid','{"full_name":"Person 2"}'::jsonb),
('39600000-0000-4000-8000-000000000003','sharing-3@example.invalid','{"full_name":"Person 3"}'::jsonb);
INSERT INTO public.profiles(id,display_name) VALUES
('39600000-0000-4000-8000-000000000001','Person 1'),
('39600000-0000-4000-8000-000000000002','Person 2'),
('39600000-0000-4000-8000-000000000003','Person 3') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.groups(id,name,created_by) VALUES
('39610000-0000-4000-8000-000000000001','Grupp 1','39600000-0000-4000-8000-000000000003'),
('39610000-0000-4000-8000-000000000002','Grupp 2','39600000-0000-4000-8000-000000000003'),
('39610000-0000-4000-8000-000000000003','Grupp 3','39600000-0000-4000-8000-000000000003');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
('39610000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000001','member','active'),
('39610000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000002','member','active'),
('39610000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000003','owner','active'),
('39610000-0000-4000-8000-000000000002','39600000-0000-4000-8000-000000000001','member','active'),
('39610000-0000-4000-8000-000000000002','39600000-0000-4000-8000-000000000002','member','active'),
('39610000-0000-4000-8000-000000000002','39600000-0000-4000-8000-000000000003','owner','active'),
('39610000-0000-4000-8000-000000000003','39600000-0000-4000-8000-000000000001','member','active'),
('39610000-0000-4000-8000-000000000003','39600000-0000-4000-8000-000000000002','member','active'),
('39610000-0000-4000-8000-000000000003','39600000-0000-4000-8000-000000000003','owner','active');
INSERT INTO public.places(id,name,category,address,city,added_by) VALUES('39620000-0000-4000-8000-000000000001','Teststället','restaurang','Testgatan','Teststad','39600000-0000-4000-8000-000000000001');
INSERT INTO public.group_places(group_id,place_id,added_by,notes,occasions) VALUES('39610000-0000-4000-8000-000000000001','39620000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000001','Privat original',ARRAY['avslappnat']),('39610000-0000-4000-8000-000000000002','39620000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000001','Målets anteckning',ARRAY['middag']);
INSERT INTO public.visits(id,place_id,visited_on,meal_type,created_by) VALUES('39630000-0000-4000-8000-000000000001','39620000-0000-4000-8000-000000000001','2026-09-20','middag','39600000-0000-4000-8000-000000000003');
INSERT INTO public.visit_group_links(visit_id,group_id,link_type,linked_by) VALUES('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000001','original','39600000-0000-4000-8000-000000000003');
INSERT INTO public.visit_participants(visit_id,user_id) VALUES('39630000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000001'),('39630000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000002');
INSERT INTO public.reviews(id,visit_id,user_id,overall,taste,value,service,atmosphere,review_model,comment) VALUES('39640000-0000-4000-8000-000000000001','39630000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000001',4,5,4,3,4,'food_v1_atmosphere','Kommentar 1'),('39640000-0000-4000-8000-000000000002','39630000-0000-4000-8000-000000000001','39600000-0000-4000-8000-000000000002',4,5,4,3,4,'food_v1_atmosphere','Kommentar 2');
INSERT INTO public.review_group_visibility(review_id,group_id,rating_visible,comment_visible) VALUES('39640000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000001',true,true),('39640000-0000-4000-8000-000000000002','39610000-0000-4000-8000-000000000001',true,true) ON CONFLICT(review_id,group_id) DO UPDATE SET comment_visible=true;
INSERT INTO public.visit_media(id,visit_id,group_id,storage_path,uploaded_by,mime_type,byte_size,width,height) VALUES('39650000-0000-4000-8000-000000000001','39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000001/39630000-0000-4000-8000-000000000001/39600000-0000-4000-8000-000000000001.jpg','39600000-0000-4000-8000-000000000001','image/jpeg',1234,800,600),('39650000-0000-4000-8000-000000000002','39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000001/39630000-0000-4000-8000-000000000001/39600000-0000-4000-8000-000000000002.jpg','39600000-0000-4000-8000-000000000002','image/jpeg',1234,800,600);

UPDATE public.group_places SET occasions='{}' WHERE group_id='39610000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='39600000-0000-4000-8000-000000000001';
SELECT ok(EXISTS(SELECT 1 FROM jsonb_array_elements(public.list_visit_share_targets_v6('39630000-0000-4000-8000-000000000001')) item WHERE item->>'groupId'='39610000-0000-4000-8000-000000000002' AND NOT (item->>'hasExperienceClassification')::boolean),'Existing empty relation is projected as missing');
SELECT ok(EXISTS(SELECT 1 FROM jsonb_array_elements(public.list_place_share_targets_v4b('39620000-0000-4000-8000-000000000001')) item WHERE item->>'groupId'='39610000-0000-4000-8000-000000000003' AND NOT (item->>'hasExperienceClassification')::boolean),'Absent relation is projected as missing');
SELECT lives_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000002')$$,'Sharing without confirmation leaves existing empty relation empty');
RESET ROLE;
SELECT is((SELECT occasions FROM public.group_places WHERE group_id='39610000-0000-4000-8000-000000000002' AND place_id='39620000-0000-4000-8000-000000000001'),'{}'::text[],'Unconfirmed proposal is never saved');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000002',_confirmed_occasions=>ARRAY['snabbt','avslappnat'])$$,'Member explicitly fills empty relation');
SELECT lives_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000002',_confirmed_occasions=>ARRAY['middag'])$$,'Retry with another choice cannot overwrite');
SELECT lives_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000003')$$,'No choice does not block sharing');
RESET ROLE;
SELECT is((SELECT occasions FROM public.group_places WHERE group_id='39610000-0000-4000-8000-000000000002' AND place_id='39620000-0000-4000-8000-000000000001'),ARRAY['snabbt','avslappnat'],'First explicit choice is preserved');
SELECT is((SELECT occasions FROM public.group_places WHERE group_id='39610000-0000-4000-8000-000000000003' AND place_id='39620000-0000-4000-8000-000000000001'),'{}'::text[],'No implicit copy on creation');
SELECT is((SELECT notes FROM public.group_places WHERE group_id='39610000-0000-4000-8000-000000000002' AND place_id='39620000-0000-4000-8000-000000000001'),'Målets anteckning','Other private metadata preserved');
-- Simulate a value filled after list-reading but before sharing.
UPDATE public.group_places SET occasions=ARRAY['middag'] WHERE group_id='39610000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000003',_confirmed_occasions=>ARRAY['snabbt'])$$,'Stale suggestion does not conflict with newer target choice');
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000003',_confirmed_occasions=>ARRAY['unknown'])$$,'P0001','Välj en eller två olika typer av upplevelse','Unknown type rejected');
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000003',_confirmed_occasions=>ARRAY['snabbt','snabbt'])$$,'P0001','Välj en eller två olika typer av upplevelse','Duplicate types rejected');
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000003',_confirmed_occasions=>ARRAY['snabbt','avslappnat','middag'])$$,'P0001','Välj en eller två olika typer av upplevelse','Three types rejected');
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000003',_confirmed_occasions=>ARRAY[NULL]::text[])$$,'P0001','Välj en eller två olika typer av upplevelse','Null element rejected');
SET LOCAL request.jwt.claim.sub='39600000-0000-4000-8000-000000000003';
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000002',_confirmed_occasions=>ARRAY['snabbt'])$$,'P0001','Endast faktiska deltagare kan lägga till besöket','Owner without actual participation rejected');
SET LOCAL request.jwt.claim.sub='';
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000002')$$,'P0001','Not authenticated','Authentication required');
RESET ROLE;
SELECT is((SELECT occasions FROM public.group_places WHERE group_id='39610000-0000-4000-8000-000000000003' AND place_id='39620000-0000-4000-8000-000000000001'),ARRAY['middag'],'Concurrent/stale target value preserved');
SELECT is((SELECT count(*) FROM public.reviews WHERE visit_id='39630000-0000-4000-8000-000000000001' AND review_model='food_v1_atmosphere' AND overall=4 AND atmosphere=4)::bigint,2::bigint,'Historical canonical review model and scores preserved');
SELECT is((SELECT count(*) FROM public.activity WHERE visit_id='39630000-0000-4000-8000-000000000001' AND kind='visited' AND group_id='39610000-0000-4000-8000-000000000002')::bigint,1::bigint,'No duplicate activity on retry');
SELECT ok(has_function_privilege('authenticated','public.share_visit_to_group_v6(uuid,uuid,boolean,boolean,boolean,text[])','EXECUTE'),'Authenticated execute grant');
SELECT ok(NOT has_function_privilege('anon','public.share_visit_to_group_v6(uuid,uuid,boolean,boolean,boolean,text[])','EXECUTE'),'Anonymous execute denied');
SELECT is((SELECT occasions FROM public.group_places WHERE group_id='39610000-0000-4000-8000-000000000001' AND place_id='39620000-0000-4000-8000-000000000001'),ARRAY['avslappnat'],'Source classification never changes');
UPDATE public.memberships SET status='left' WHERE group_id='39610000-0000-4000-8000-000000000002' AND user_id='39600000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='39600000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000002',_confirmed_occasions=>ARRAY['snabbt'])$$,'P0001','Du är inte aktiv medlem i målgruppen','Membership is revalidated on retry');
RESET ROLE;
UPDATE public.groups SET lifecycle_status='archived', archived_at=now(), archived_by='39600000-0000-4000-8000-000000000003' WHERE id='39610000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.share_visit_to_group_v6('39630000-0000-4000-8000-000000000001','39610000-0000-4000-8000-000000000003',_confirmed_occasions=>ARRAY['snabbt'])$$,'P0001','Målgruppen är inte aktiv','Target lifecycle is revalidated');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
