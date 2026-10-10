BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(12);
SELECT ok(private.place_typo_name_matches_v1('Pharmarim','Pharmarium'),'one missing character');
SELECT ok(private.place_typo_name_matches_v1('Efraim bark','Efraim Barbits Pub'),'anchored fuzzy prefix');
SELECT ok(private.place_typo_name_matches_v1('Efraim bark','Efraim Park'),'ambiguous nearby name retained');
SELECT ok(NOT private.place_typo_name_matches_v1('bar','Barbits Pub'),'short generic rejected');
SELECT ok(NOT private.place_typo_name_matches_v1('Efrim bark','Efraim Barbits Pub'),'two wrong tokens rejected');
SELECT ok(NOT private.place_typo_name_matches_v1('Pharmarium','Pharmarium'),'exact names use primary retrieval');
SELECT ok(NOT private.place_typo_name_matches_v1('restaurang','Restaurangen'),'long generic rejected');
INSERT INTO auth.users(id,email) VALUES ('46500000-0000-4000-8000-000000000001','typo465@example.invalid');
INSERT INTO public.groups(id,name,created_by) VALUES
 ('46510000-0000-4000-8000-000000000001','Current group','46500000-0000-4000-8000-000000000001'),
 ('46510000-0000-4000-8000-000000000002','Private other group','46500000-0000-4000-8000-000000000001');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
 ('46510000-0000-4000-8000-000000000001','46500000-0000-4000-8000-000000000001','owner','active');
INSERT INTO public.places(id,name,category,address,city,lat,lng,added_by) VALUES
 ('46520000-0000-4000-8000-000000000001','Efraim Barbits Pub','pub','Gatan 1','Stockholm',59.325,18.071,'46500000-0000-4000-8000-000000000001'),
 ('46520000-0000-4000-8000-000000000002','Efraim Park','pub','Gatan 2','Stockholm',59.3251,18.0711,'46500000-0000-4000-8000-000000000001'),
 ('46520000-0000-4000-8000-000000000003','Efraim Barbits Pub','pub','Gatan 3','Solna',59.356,18.03,'46500000-0000-4000-8000-000000000001');
INSERT INTO public.place_improvement_candidates(group_id,place_id,reason,status,created_by) VALUES
 ('46510000-0000-4000-8000-000000000002','46520000-0000-4000-8000-000000000001','unmatched_verified_manual','open','46500000-0000-4000-8000-000000000001'),
 ('46510000-0000-4000-8000-000000000002','46520000-0000-4000-8000-000000000002','unmatched_verified_manual','open','46500000-0000-4000-8000-000000000001'),
 ('46510000-0000-4000-8000-000000000002','46520000-0000-4000-8000-000000000003','unmatched_verified_manual','open','46500000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claim.sub','46500000-0000-4000-8000-000000000001',true);
CREATE FUNCTION pg_temp.typo_search() RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.search_canonical_name_candidates_v1(
  '46510000-0000-4000-8000-000000000001','Efraim bark',
  '[{"lat":59.325,"lng":18.071,"radiusKm":1}]'::jsonb);
$$;
SELECT is(jsonb_array_length(pg_temp.typo_search()),2,'two nearby ambiguous candidates remain separate');
SELECT ok(pg_temp.typo_search()::text !~ '(Private other group|groupId|visits|reviews|notes|createdBy)','private origin not leaked');
SELECT is(jsonb_array_length(public.search_canonical_name_candidates_v1(
 '46510000-0000-4000-8000-000000000001','Efraim bark',
 '[{"lat":59.325,"lng":18.071,"radiusKm":0.001}]'::jsonb)),1,'radius restricts fuzzy candidates');
SELECT is(jsonb_array_length(public.search_canonical_name_candidates_v1(
 '46510000-0000-4000-8000-000000000001','Efraim bark',
 '[{"lat":59.325,"lng":18.071,"radiusKm":50}]'::jsonb)),3,'same names at different addresses remain distinct');
SELECT throws_like($$SELECT public.search_canonical_name_candidates_v1(
 '46510000-0000-4000-8000-000000000002','Efraim bark',
 '[{"lat":59.325,"lng":18.071,"radiusKm":1}]'::jsonb)$$,
 '%','unauthorized group denied');
SELECT * FROM finish();
ROLLBACK;
