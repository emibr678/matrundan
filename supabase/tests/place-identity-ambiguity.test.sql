BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(26);
SELECT set_config('request.jwt.claim.sub','38960000-0000-4000-8000-000000000001',true);
INSERT INTO auth.users(id,email) VALUES ('38960000-0000-4000-8000-000000000001','identity-ambiguity@example.invalid');
INSERT INTO public.groups(id,name,created_by) VALUES ('38961000-0000-4000-8000-000000000001','Identity ambiguity','38960000-0000-4000-8000-000000000001');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES ('38961000-0000-4000-8000-000000000001','38960000-0000-4000-8000-000000000001','owner','active');
INSERT INTO public.places(id,name,category,address,city,lat,lng,added_by) VALUES
 ('38962000-0000-4000-8000-000000000001','Chain cafe','café','Testgatan 1','Teststad',59,18,'38960000-0000-4000-8000-000000000001'),
 ('38962000-0000-4000-8000-000000000002','Chain cafe annex','café','','Teststad',59.0007,18,'38960000-0000-4000-8000-000000000001');
INSERT INTO public.place_improvement_candidates(group_id,place_id,reason,status,created_by)
 SELECT '38961000-0000-4000-8000-000000000001',id,'unmatched_verified_manual','open',added_by FROM public.places WHERE id::text LIKE '38962000%';
CREATE FUNCTION pg_temp.data() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('externalId','389:ambiguous','name','Chain cafe','category','café','cuisines','[]'::jsonb,'address','Testgatan 1','city','Teststad','lat',59,'lng',18,'osmType','node','osmId','389600001','fetchedAt',now());
$$;
CREATE FUNCTION pg_temp.review() RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.match_place_discovery_candidates_v1('38961000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.data()))->0;
$$;
CREATE FUNCTION pg_temp.confirm() RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.resolve_verified_provider_place_v1('38960000-0000-4000-8000-000000000001','38961000-0000-4000-8000-000000000001',pg_temp.data(),'link','38962000-0000-4000-8000-000000000001',
 jsonb_build_array(jsonb_build_object('placeId','38962000-0000-4000-8000-000000000001','version',private.canonical_place_projection_v1('38962000-0000-4000-8000-000000000001',NULL)->>'version')),'{}',NULL,private.provider_place_version_v1(pg_temp.data()));
$$;
SELECT is(jsonb_array_length(pg_temp.review()->'candidates'),2,'both strong and plausible competitors are presented');
SELECT is(pg_temp.review()->'candidates'->0->>'matchKind','strong','chosen candidate is strong');
SELECT is(pg_temp.review()->'candidates'->1->>'matchKind','possible','competitor need not be strong');
SELECT is(pg_temp.review()->'candidates'->0->>'canConfirmSource','false','strong does not mean unambiguous');
SELECT is(pg_temp.confirm()->>'status','review_required','forged link request is rejected despite fresh selected version');
SELECT is(pg_temp.confirm()->'candidates'->0->>'canConfirmSource','false','fresh server review keeps attachment disabled');
SELECT is((SELECT count(*)::integer FROM public.place_sources WHERE provider_place_id='389:ambiguous'),0,'ambiguous confirmation writes no external source');
SELECT is((SELECT count(*)::integer FROM public.group_places WHERE group_id='38961000-0000-4000-8000-000000000001'),0,'ambiguous confirmation writes no group relation');
SELECT is((SELECT count(*)::integer FROM public.places WHERE id::text LIKE '38962000%'),2,'ambiguous confirmation creates no new place');
UPDATE public.places SET name='Chain cafe',address='Testgatan 1',lat=59.0001 WHERE id='38962000-0000-4000-8000-000000000002';
SELECT is(pg_temp.review()->'candidates'->1->>'matchKind','strong','two strong candidates are still ambiguous');
SELECT is(pg_temp.confirm()->>'status','review_required','second strong candidate also blocks confirmation');
SELECT is(public.resolve_verified_provider_place_v1('38960000-0000-4000-8000-000000000001','38961000-0000-4000-8000-000000000001',pg_temp.data(),'link','38962000-0000-4000-8000-000000000001',
 (SELECT jsonb_agg(jsonb_build_object('placeId',place_id,'version',projection->>'version')) FROM private.place_identity_candidates_v1('38961000-0000-4000-8000-000000000001',pg_temp.data())),
 '{}',NULL,private.provider_place_version_v1(pg_temp.data()))->>'status','review_required','fresh decisions for every candidate do not authorize ambiguous attachment');
UPDATE public.places SET name='Chain cafe annex',address='',lat=59.0007 WHERE id='38962000-0000-4000-8000-000000000002';
UPDATE public.place_improvement_candidates SET status='dismissed' WHERE place_id='38962000-0000-4000-8000-000000000002';
SELECT is(jsonb_array_length(pg_temp.review()->'candidates'),1,'ineligible competitor stays out of public projection');
SELECT is(pg_temp.review()->'candidates'->0->>'canConfirmSource','false','hidden competitor still prevents global attachment');
SELECT is(pg_temp.confirm()->>'status','review_required','hidden competitor cannot be bypassed through RPC');
UPDATE public.places SET lat=59.003 WHERE id='38962000-0000-4000-8000-000000000002';
SELECT is(pg_temp.review()->'candidates'->0->>'canConfirmSource','true','single strong candidate can be confirmed');
-- A new plausible row appears after the previous preview. The mutation recomputes
-- the full pool under the shared identity lock, rather than trusting that preview.
INSERT INTO public.places(id,name,category,address,city,lat,lng,added_by) VALUES
 ('38962000-0000-4000-8000-000000000003','Chain cafe','café','','Teststad',59.0008,18,'38960000-0000-4000-8000-000000000001');
SELECT is(pg_temp.confirm()->>'status','review_required','candidate arriving after preview blocks confirmation');
SELECT is((SELECT count(*)::integer FROM public.place_sources WHERE provider_place_id='389:ambiguous'),0,'stale unique preview writes no source');
DELETE FROM public.places WHERE id='38962000-0000-4000-8000-000000000003';
SELECT is(pg_temp.confirm()->>'placeId','38962000-0000-4000-8000-000000000001','unambiguous confirmation retains canonical identity');
SELECT is((SELECT count(*)::integer FROM public.place_sources WHERE place_id='38962000-0000-4000-8000-000000000001' AND status='active'),2,'unambiguous confirmation attaches Geoapify and OSM');
INSERT INTO public.places(id,name,category,address,city,lat,lng,added_by) VALUES
 ('38962000-0000-4000-8000-000000000010','Espresso House','café','Stationsgatan 1','Teststad',59.01,18,'38960000-0000-4000-8000-000000000001'),
 ('38962000-0000-4000-8000-000000000020','City chain','café','Sharedgatan 1','Ort Alfa',59.02,18,'38960000-0000-4000-8000-000000000001'),
 ('38962000-0000-4000-8000-000000000030','Missing chain','café','','',59.03,18,'38960000-0000-4000-8000-000000000001'),
 ('38962000-0000-4000-8000-000000000040','Equivalent chain','café','Ågatan 1','Teststad',59.04,18,'38960000-0000-4000-8000-000000000001');
INSERT INTO public.place_sources(place_id,provider,provider_place_id,status) SELECT id,'geoapify','guard:'||id,'active' FROM public.places WHERE id::text LIKE '38962000%' AND id::text ~ '0[1234]0$';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','38960000-0000-4000-8000-000000000001',true);
SELECT throws_ok($$SELECT public.create_manual_place_fallback_v2('38961000-0000-4000-8000-000000000001','{"name":"Espresso House","category":"café","address":"Stationsgatan 1","city":"Teststad","lat":59.0105,"lng":18}')$$,'P0001','Kartstället finns redan. Sök efter stället igen innan du lägger till det.','same name and address still rejects nearby duplicate');
SELECT lives_ok($$SELECT public.create_manual_place_fallback_v2('38961000-0000-4000-8000-000000000001','{"name":"Espresso House","category":"café","address":"Stationsgatan 2","city":"Teststad","lat":59.0105,"lng":18}')$$,'same name but different known address under 150m is allowed');
SELECT throws_ok($$SELECT public.create_manual_place_fallback_v2('38961000-0000-4000-8000-000000000001','{"name":"Espresso House","category":"café","address":"","city":"Teststad","lat":59.0105,"lng":18}')$$,'P0001','Kartstället finns redan. Sök efter stället igen innan du lägger till det.','missing requested address is not evidence of a different place');
SELECT lives_ok($$SELECT public.create_manual_place_fallback_v2('38961000-0000-4000-8000-000000000001','{"name":"City chain","category":"café","address":"Sharedgatan 1","city":"Ort Beta","lat":59.0205,"lng":18}')$$,'different known cities count as counterevidence');
SELECT throws_ok($$SELECT public.create_manual_place_fallback_v2('38961000-0000-4000-8000-000000000001','{"name":"Missing chain","category":"café","address":"Gatan 1","city":"Teststad","lat":59.0305,"lng":18}')$$,'P0001','Kartstället finns redan. Sök efter stället igen innan du lägger till det.','missing existing address and city remain conservative');
SELECT throws_ok($$SELECT public.create_manual_place_fallback_v2('38961000-0000-4000-8000-000000000001','{"name":"Equivalent chain","category":"café","address":"Agatan 1","city":"Teststad","lat":59.0405,"lng":18}')$$,'P0001','Kartstället finns redan. Sök efter stället igen innan du lägger till det.','normalized equivalent addresses still reject duplicates');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
