BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(20);
SELECT is(private.place_address_relation_v1('Ringvägen','Ringvägen 106'),'compatible','street without number is incomplete');
SELECT is(private.place_address_relation_v1('Ringvägen 106','Ringvägen'),'compatible','address compatibility is symmetric');
SELECT is(private.place_address_relation_v1('Ringvägen 106','Ringvägen 150'),'conflict','different known numbers are counterevidence');
SELECT is(private.place_address_relation_v1('Ringvägen 106','Götgatan 106'),'conflict','different streets are counterevidence');
SELECT is(private.place_address_relation_v1('','Ringvägen 106'),'unknown','missing address proves nothing');
SELECT is(private.place_address_relation_v1('Ringvägen 106 A, Stockholm','Ringvägen 106a'),'equal','house suffix and formatted city normalize');
SELECT ok(private.specific_place_name_matches_v1('Monster Chicken','Monster Chicken'),'exact specific name eligible');
SELECT ok(private.specific_place_name_matches_v1('Monster Chicken','Monster Chicken Söder'),'short trailing qualifier eligible');
SELECT ok(NOT private.specific_place_name_matches_v1('pizza','Pizza'),'generic query not widened');
SELECT ok(NOT private.specific_place_name_matches_v1('hamburgare','Hamburgare'),'long generic query not widened');
SELECT set_config('request.jwt.claim.sub','38963000-0000-4000-8000-000000000001',true);
INSERT INTO auth.users(id,email) VALUES ('38963000-0000-4000-8000-000000000001','search-first@example.invalid');
INSERT INTO public.groups(id,name,created_by) VALUES
 ('38963100-0000-4000-8000-000000000001','Current group','38963000-0000-4000-8000-000000000001'),
 ('38963100-0000-4000-8000-000000000002','SECRET other group','38963000-0000-4000-8000-000000000001');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES ('38963100-0000-4000-8000-000000000001','38963000-0000-4000-8000-000000000001','owner','active');
INSERT INTO public.places(id,name,category,address,city,lat,lng,added_by) VALUES
 ('38963200-0000-4000-8000-000000000001','Monster Chicken','snabbmat','Ringvägen 106','Stockholm',59,18,'38963000-0000-4000-8000-000000000001');
INSERT INTO public.place_improvement_candidates(group_id,place_id,reason,status,created_by) VALUES
 ('38963100-0000-4000-8000-000000000002','38963200-0000-4000-8000-000000000001','unmatched_verified_manual','open','38963000-0000-4000-8000-000000000001');
CREATE FUNCTION pg_temp.search(_text text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.search_canonical_places_v1('38963100-0000-4000-8000-000000000001',_text,'[{"lat":59.02,"lng":18,"radiusKm":1}]');
$$;
SELECT is(jsonb_array_length(pg_temp.search('Monster Chicken')),1,'specific name finds unvisited eligible place outside narrow point radius');
SELECT is(jsonb_array_length(pg_temp.search('pizza')),0,'generic query remains geographical');
SELECT is(jsonb_array_length(pg_temp.search('')),0,'empty query is not a catalogue');
SELECT is(pg_temp.search('Monster Chicken')->0->>'groupStatus','not_linked','other group identity is projected as not linked');
SELECT ok(NOT (pg_temp.search('Monster Chicken')::text ~ '(SECRET|visits|notes|createdBy|groupId|addedBy|reviews)'), 'projection leaks no private origin or history');
CREATE FUNCTION pg_temp.data() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('externalId','389:partial','name','Monster Chicken','category','snabbmat','cuisines','[]'::jsonb,'address','Ringvägen','city','Stockholm','lat',59.00006,'lng',18,'osmType','node','osmId','389630001','fetchedAt',now());
$$;
SELECT is((SELECT projection->>'matchKind' FROM private.place_identity_candidates_v1('38963100-0000-4000-8000-000000000001',pg_temp.data())),'strong','partial street plus name and 7m is strong');
SELECT is((SELECT projection->>'canConfirmSource' FROM private.place_identity_candidates_v1('38963100-0000-4000-8000-000000000001',pg_temp.data())),'true','one compatible strong candidate can be confirmed');
SELECT is((SELECT projection->>'matchKind' FROM private.place_identity_candidates_v1('38963100-0000-4000-8000-000000000001',pg_temp.data()||'{"address":"Ringvägen 150"}')),'possible','opposite house number never strong even at 7m');
SELECT is(public.resolve_verified_provider_place_v1('38963000-0000-4000-8000-000000000001','38963100-0000-4000-8000-000000000001',pg_temp.data(),'link','38963200-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('placeId','38963200-0000-4000-8000-000000000001','version',private.canonical_place_projection_v1('38963200-0000-4000-8000-000000000001',NULL)->>'version')),'{}',NULL,private.provider_place_version_v1(pg_temp.data()))->>'placeId','38963200-0000-4000-8000-000000000001','compatible attachment preserves canonical ID');
SELECT throws_like($$SELECT private.create_manual_place_v2('38963000-0000-4000-8000-000000000001','38963100-0000-4000-8000-000000000001',pg_temp.data())$$,'%Kartstället finns redan%','manual duplicate guard recognizes partial street too');
SELECT * FROM finish();
ROLLBACK;
