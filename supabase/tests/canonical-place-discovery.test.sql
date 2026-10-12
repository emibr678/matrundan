BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(31);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('38900000-0000-4000-8000-000000000001','discovery-owner@example.invalid','{"full_name":"Owner"}'),
 ('38900000-0000-4000-8000-000000000002','discovery-member@example.invalid','{"full_name":"Member"}'),
 ('38900000-0000-4000-8000-000000000003','discovery-private@example.invalid','{"full_name":"Private"}');
INSERT INTO public.groups(id,name,created_by) VALUES
 ('38910000-0000-4000-8000-000000000001','Discovery','38900000-0000-4000-8000-000000000001'),
 ('38910000-0000-4000-8000-000000000002','Never expose this group','38900000-0000-4000-8000-000000000003');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
 ('38910000-0000-4000-8000-000000000001','38900000-0000-4000-8000-000000000001','owner','active'),
 ('38910000-0000-4000-8000-000000000001','38900000-0000-4000-8000-000000000002','member','active'),
 ('38910000-0000-4000-8000-000000000002','38900000-0000-4000-8000-000000000003','owner','active');
INSERT INTO public.places(id,name,category,cuisines,address,city,lat,lng,added_by) VALUES
 ('38920000-0000-4000-8000-000000000001','Café Åström','café',ARRAY['Svenskt'],'Testgatan 1','Teststad',59,18,'38900000-0000-4000-8000-000000000003'),
 ('38920000-0000-4000-8000-000000000002','Legacy Cafe','café','{}','Testgatan 2','Teststad',59,18,'38900000-0000-4000-8000-000000000003');
INSERT INTO public.group_places(group_id,place_id,notes,added_by) VALUES
 ('38910000-0000-4000-8000-000000000002','38920000-0000-4000-8000-000000000001','Never expose this note','38900000-0000-4000-8000-000000000003');
INSERT INTO public.place_improvement_candidates(group_id,place_id,reason,status,created_by) VALUES
 ('38910000-0000-4000-8000-000000000002','38920000-0000-4000-8000-000000000001','unmatched_verified_manual','open','38900000-0000-4000-8000-000000000003');
INSERT INTO public.visits(id,place_id,visited_on,meal_type,created_by) VALUES
 ('38930000-0000-4000-8000-000000000001','38920000-0000-4000-8000-000000000001','2026-09-01','fika','38900000-0000-4000-8000-000000000003');
INSERT INTO public.visit_group_links(visit_id,group_id,link_type,linked_by) VALUES
 ('38930000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000002','original','38900000-0000-4000-8000-000000000003');
CREATE TEMP TABLE discovery_before AS SELECT to_jsonb(v) AS visit FROM public.visits v WHERE id='38930000-0000-4000-8000-000000000001';
CREATE FUNCTION pg_temp.provider_data(_name text DEFAULT 'Cafe Astrom') RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('externalId','389:geoapify','name',_name,'category','café','cuisines',jsonb_build_array('Svenskt'),
   'address','Testgatan 1','area',NULL,'city','Teststad','lat',59,'lng',18,'osmType','node','osmId','389000001','fetchedAt',now());
$$;
CREATE TEMP TABLE discovery_decision AS SELECT private.canonical_place_projection_v1('38920000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001')->>'version' AS version;
SELECT is(private.normalize_place_identity_v1('Café Åström & Co.'),'cafe astrom co','matching has the same Swedish accent contract');
SELECT ok(NOT has_function_privilege('authenticated','public.resolve_verified_provider_place_v1(uuid,uuid,jsonb,text,uuid,jsonb,text[],text,text)','EXECUTE'),'client cannot forge verified provider data');
SELECT ok(NOT has_schema_privilege('authenticated','private','USAGE'),'private matching pool cannot be enumerated');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','38900000-0000-4000-8000-000000000002',true);
SELECT is(public.get_place_discovery_context_v1('38910000-0000-4000-8000-000000000001')->>'canConfirm','false','ordinary group member cannot confirm sources');
SELECT is(jsonb_array_length(public.search_canonical_places_v1('38910000-0000-4000-8000-000000000001','Astrom','[{"lat":59,"lng":18,"radiusKm":1}]')),1,'eligible canonical place is discoverable across groups');
SELECT is(public.search_canonical_places_v1('38910000-0000-4000-8000-000000000001','','[{"lat":59,"lng":18,"radiusKm":1}]'),'[]'::jsonb,'empty discovery never exposes an internal catalogue');
SELECT is(public.search_canonical_places_v1('38910000-0000-4000-8000-000000000001','Legacy','[{"lat":59,"lng":18,"radiusKm":1}]'),'[]'::jsonb,'legacy providerless row is not exposed');
SELECT ok(public.search_canonical_places_v1('38910000-0000-4000-8000-000000000001','Astrom','[{"lat":59,"lng":18,"radiusKm":1}]')::text NOT LIKE '%Never expose%','no group names or private notes leak');
SELECT throws_ok($$SELECT public.get_place_discovery_context_v1('38910000-0000-4000-8000-000000000002')$$,'P0001','Gruppen kunde inte verifieras','cross-group read is rejected');
SELECT throws_ok($$SELECT public.search_canonical_places_v1('38910000-0000-4000-8000-000000000001','Astrom','[{"lat":59,"lng":18,"radiusKm":1}]','{}','{}',NULL)$$,'P0001','Ogiltig sökning','NULL cannot remove the search limit');
SELECT throws_ok($$SELECT public.create_or_link_provider_place_v5f('38910000-0000-4000-8000-000000000001','geoapify','new-forged-source','Cafe Astrom','café')$$,'P0001','verification_required','legacy single cannot create a source from browser fields');
SELECT is(public.create_or_link_provider_places_batch_v1('38910000-0000-4000-8000-000000000001','[{"externalId":"new","provider":"geoapify","providerPlaceId":"new-forged-source","name":"Cafe Astrom"}]')->>'failed','1','legacy bulk also fails closed for new sources');
SELECT is(public.link_canonical_place_to_group_v1('38910000-0000-4000-8000-000000000001','38920000-0000-4000-8000-000000000001')->>'status','linked','member can reuse the canonical place');
SELECT is(public.link_canonical_place_to_group_v1('38910000-0000-4000-8000-000000000001','38920000-0000-4000-8000-000000000001')->>'status','already_active','canonical reuse is idempotent');
RESET ROLE;
UPDATE public.group_places SET notes='Own private note',occasions=ARRAY['middag'] WHERE group_id='38910000-0000-4000-8000-000000000001' AND place_id='38920000-0000-4000-8000-000000000001';
SELECT is(public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001',pg_temp.provider_data())->>'status','review_required','manual candidate prevents a new provider row');
SELECT throws_ok($$SELECT public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000002','38910000-0000-4000-8000-000000000001',pg_temp.provider_data(),'link','38920000-0000-4000-8000-000000000001')$$,'P0001','Gruppens admin behöver bekräfta matchningen','server rechecks role at confirmation');
SELECT is(public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001',pg_temp.provider_data(),'separate',NULL,jsonb_build_array(jsonb_build_object('placeId','38920000-0000-4000-8000-000000000001','version','00000000000000000000000000000000')),'{}',NULL,private.provider_place_version_v1(pg_temp.provider_data()))->>'status','review_required','stale candidate decision cannot approve separation');
SELECT is(public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001',pg_temp.provider_data()||'{"address":"Testgatan 99"}'::jsonb,'separate',NULL,jsonb_build_array(jsonb_build_object('placeId','38920000-0000-4000-8000-000000000001','version',(SELECT version FROM discovery_decision))),'{}',NULL,private.provider_place_version_v1(pg_temp.provider_data()))->>'status','review_required','changed provider fields require a fresh review');
SELECT is((SELECT count(*)::integer FROM public.place_sources WHERE provider_place_id='389:geoapify'),0,'stale decisions cause no source writes');
SELECT is(public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001',pg_temp.provider_data('Legacy Cafe')||'{"externalId":"legacy:attempt"}'::jsonb)->>'status','review_required','unexposed legacy candidate still blocks creation');
SELECT is(public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001',pg_temp.provider_data(),'link','38920000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('placeId','38920000-0000-4000-8000-000000000001','version',(SELECT version FROM discovery_decision))), '{}',NULL,private.provider_place_version_v1(pg_temp.provider_data()))->>'placeId','38920000-0000-4000-8000-000000000001','confirmation keeps the canonical ID');
SELECT is((SELECT count(*)::integer FROM public.places WHERE id IN ('38920000-0000-4000-8000-000000000001','38920000-0000-4000-8000-000000000002')),2,'no place row is duplicated');
SELECT is((SELECT count(*)::integer FROM public.place_sources WHERE place_id='38920000-0000-4000-8000-000000000001' AND status='active'),2,'Geoapify and OSM attach to the same place');
SELECT is((SELECT to_jsonb(v) FROM public.visits v WHERE id='38930000-0000-4000-8000-000000000001'),(SELECT visit FROM discovery_before),'existing visit remains exactly unchanged');
SELECT is((SELECT notes FROM public.group_places WHERE group_id='38910000-0000-4000-8000-000000000002' AND place_id='38920000-0000-4000-8000-000000000001'),'Never expose this note','other group metadata remains untouched');
SELECT is(public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001',pg_temp.provider_data())->>'status','already_active','repeated verified add reuses same identity');
SELECT is(public.resolve_verified_provider_place_v1('38900000-0000-4000-8000-000000000001','38910000-0000-4000-8000-000000000001',pg_temp.provider_data()||'{"osmId":"389000999"}'::jsonb)->>'status','identity_conflict','changed OSM identity cannot silently replace an active identity');
SELECT is((SELECT count(*)::integer FROM public.place_sources WHERE provider_place_id='node:389000999'),0,'conflicting identity causes no source write');
SELECT is((SELECT notes FROM public.group_places WHERE group_id='38910000-0000-4000-8000-000000000001' AND place_id='38920000-0000-4000-8000-000000000001'),'Own private note','existing own group metadata also survives source attachment');
SELECT is((SELECT occasions FROM public.group_places WHERE group_id='38910000-0000-4000-8000-000000000001' AND place_id='38920000-0000-4000-8000-000000000001'),ARRAY['middag']::text[],'source attachment does not replace experience classification');
SELECT is((SELECT status FROM public.place_improvement_candidates WHERE place_id='38920000-0000-4000-8000-000000000001'),'resolved','active source resolves the improvement candidate');
SELECT * FROM finish();
ROLLBACK;
