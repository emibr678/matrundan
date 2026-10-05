-- Disposable collision experiment for #158; NOT a migration or product API.
-- The consolidation choices below are fixture choices, not automatic policy.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(18);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('15800000-0000-4000-8000-000000000001','collision-owner@example.invalid','{}'),
 ('15800000-0000-4000-8000-000000000002','collision-member@example.invalid','{}');
INSERT INTO public.groups(id,name,created_by) VALUES
 ('15810000-0000-4000-8000-000000000001','Collision group','15800000-0000-4000-8000-000000000001'),
 ('15810000-0000-4000-8000-000000000002','Never reveal this group','15800000-0000-4000-8000-000000000001');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
 ('15810000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','owner','active'),
 ('15810000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001','owner','active'),
 ('15810000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000002','member','active');
INSERT INTO public.places(id,name,category,address,city,lat,lng,added_by) VALUES
 ('15820000-0000-4000-8000-000000000001','Collision café','café','Testgatan 1','Teststad',59,18,'15800000-0000-4000-8000-000000000001'),
 ('15820000-0000-4000-8000-000000000002','Collision café','café','Testgatan 1','Teststad',59,18,'15800000-0000-4000-8000-000000000001');
INSERT INTO public.group_places(group_id,place_id,added_by,notes) VALUES
 ('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','First own note'),
 ('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001','Second own note'),
 ('15810000-0000-4000-8000-000000000002','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','Secret group note');
INSERT INTO public.place_data_reports(id,group_id,place_id,category,description,reported_name,created_by) VALUES
 ('15890000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','duplicate','First independent observation','Collision café','15800000-0000-4000-8000-000000000001'),
 ('15890000-0000-4000-8000-000000000002','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002','duplicate','Second independent observation','Collision café','15800000-0000-4000-8000-000000000001');
INSERT INTO public.place_data_signal_confirmations(id,group_id,place_id,user_id,verdict,created_at,updated_at) VALUES
 ('15891000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','closed_permanently','2026-09-01','2026-09-01'),
 ('15891000-0000-4000-8000-000000000002','15810000-0000-4000-8000-000000000002','15820000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001','appears_open','2026-09-02','2026-09-02');
-- Includes a legacy unresolved B to falsify the partial-unique-index case.
INSERT INTO public.place_improvement_candidates(id,group_id,place_id,status,created_by) VALUES
 ('15892000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','needs_osm','15800000-0000-4000-8000-000000000001'),
 ('15892000-0000-4000-8000-000000000002','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002','open','15800000-0000-4000-8000-000000000001');
INSERT INTO public.group_place_practical_info_history(id,group_id,place_id,website_override,source_note,changed_by) VALUES
 ('15893000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','https://example.invalid/first','First historical source','15800000-0000-4000-8000-000000000001'),
 ('15893000-0000-4000-8000-000000000002','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002','https://example.invalid/second','Second historical source','15800000-0000-4000-8000-000000000001');

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;
CREATE TABLE private.prototype_collision_audit(
 group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
 kind text NOT NULL,before_row jsonb NOT NULL
);
ALTER TABLE private.prototype_collision_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.prototype_collision_audit FROM PUBLIC,anon,authenticated;
INSERT INTO private.prototype_collision_audit
 SELECT group_id,'report',to_jsonb(r) FROM public.place_data_reports r WHERE id::text LIKE '15890000%'
 UNION ALL SELECT group_id,'signal',to_jsonb(s) FROM public.place_data_signal_confirmations s WHERE id::text LIKE '15891000%'
 UNION ALL SELECT group_id,'candidate',to_jsonb(c) FROM public.place_improvement_candidates c WHERE id::text LIKE '15892000%'
 UNION ALL SELECT group_id,'practical',to_jsonb(h) FROM public.group_place_practical_info_history h WHERE id::text LIKE '15893000%'
 UNION ALL SELECT group_id,'group_place',to_jsonb(gp) FROM public.group_places gp WHERE group_id::text LIKE '15810000%';
CREATE FUNCTION public.prototype_read_collision_audit(_group uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN auth.uid() IS NOT NULL AND public.has_membership(_group,auth.uid())
 THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',kind,'before',before_row))
 FROM private.prototype_collision_audit WHERE group_id=_group),'[]'::jsonb) ELSE '[]'::jsonb END;
$$;
REVOKE ALL ON FUNCTION public.prototype_read_collision_audit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prototype_read_collision_audit(uuid) TO authenticated;
SELECT throws_ok($$UPDATE public.place_data_reports SET place_id='15820000-0000-4000-8000-000000000002' WHERE id='15890000-0000-4000-8000-000000000001'$$,'23505',NULL,'naive report repoint violates active reporter uniqueness');
SELECT throws_ok($$UPDATE public.place_data_signal_confirmations SET place_id='15820000-0000-4000-8000-000000000002' WHERE id='15891000-0000-4000-8000-000000000001'$$,'23505',NULL,'naive signal repoint would duplicate one user vote');
SELECT throws_ok($$UPDATE public.place_improvement_candidates SET place_id='15820000-0000-4000-8000-000000000002' WHERE id='15892000-0000-4000-8000-000000000001'$$,'23505',NULL,'naive improvement repoint violates unresolved uniqueness');

-- Simulates a reviewed consolidation: both report IDs/texts survive; originals
-- and prior statuses stay in group-private audit. It never submits an OSM note.
UPDATE public.place_data_reports SET status='resolved',resolution_note='Prototype: consolidated into report 15890000-0000-4000-8000-000000000001'
 WHERE id='15890000-0000-4000-8000-000000000002';
UPDATE public.place_data_reports SET place_id='15820000-0000-4000-8000-000000000002'
 WHERE id='15890000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*) FROM public.place_data_reports WHERE id::text LIKE '15890000%'),2::bigint,'both independent report IDs remain present');
SELECT ok(NOT EXISTS(SELECT before_row->>'description' FROM private.prototype_collision_audit WHERE kind='report' EXCEPT SELECT description FROM public.place_data_reports),'report text is never silently overwritten');
SELECT is((SELECT count(*) FROM public.place_data_reports WHERE id::text LIKE '15890000%' AND status IN ('open','ready_for_osm')),1::bigint,'one reviewed active case remains without a unique collision');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.place_data_reports r JOIN private.prototype_collision_audit a ON a.kind='report' AND a.before_row->>'id'=r.id::text WHERE
 (to_jsonb(r)-ARRAY['place_id','status','resolution_note']) IS DISTINCT FROM (a.before_row-ARRAY['place_id','status','resolution_note'])),'publication fields, observation provenance and report timestamps are unchanged');
SELECT is((SELECT count(*) FROM private.prototype_collision_audit WHERE kind='report' AND before_row->>'status'='open'),2::bigint,'original report statuses remain in private audit');
-- Latest observation wins one user's neutral signal; each group's full original
-- is retained in its own audit rather than shown to the other group.
DELETE FROM public.place_data_signal_confirmations WHERE id='15891000-0000-4000-8000-000000000001';
SELECT is((SELECT verdict FROM public.place_data_signal_confirmations WHERE user_id='15800000-0000-4000-8000-000000000001'),'appears_open','latest user observation survives rather than counting two votes');
SELECT is((SELECT count(*) FROM private.prototype_collision_audit WHERE kind='signal'),2::bigint,'both original signal observations retain separate group provenance');
UPDATE public.place_improvement_candidates SET status='resolved',resolved_at=now(),resolution='Prototype consolidation'
 WHERE id='15892000-0000-4000-8000-000000000002';
UPDATE public.place_improvement_candidates SET place_id='15820000-0000-4000-8000-000000000002'
 WHERE id='15892000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*) FROM public.place_improvement_candidates WHERE id::text LIKE '15892000%'),2::bigint,'improvement IDs and their event parent rows survive consolidation');
SELECT is((SELECT count(*) FROM public.place_improvement_candidates WHERE id::text LIKE '15892000%' AND status IN ('open','needs_osm')),1::bigint,'only one unresolved improvement remains');
UPDATE public.group_place_practical_info_history SET place_id='15820000-0000-4000-8000-000000000002' WHERE id='15893000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*) FROM public.group_place_practical_info_history WHERE place_id='15820000-0000-4000-8000-000000000002'),2::bigint,'both practical revisions retain their IDs on surviving identity');
SELECT ok(NOT EXISTS(SELECT before_row-'place_id' FROM private.prototype_collision_audit WHERE kind='practical' EXCEPT SELECT to_jsonb(h)-'place_id' FROM public.group_place_practical_info_history h),'historical practical content and revision timestamps remain unchanged');
SELECT set_config('request.jwt.claim.sub','15800000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT ok(public.prototype_read_collision_audit('15810000-0000-4000-8000-000000000001')::text NOT LIKE '%Secret group note%','audit for own group never includes another group private note');
SELECT is(public.prototype_read_collision_audit('15810000-0000-4000-8000-000000000002'),'[]'::jsonb,'known private group audit is unreadable to outsider');
RESET ROLE;
SELECT ok(NOT has_table_privilege('authenticated','private.prototype_collision_audit','SELECT'),'browser cannot bypass group-scoped audit reader');
SELECT is((SELECT notes FROM public.group_places WHERE group_id='15810000-0000-4000-8000-000000000002'),'Secret group note','another group note remains unchanged during consolidation');
SELECT * FROM finish();
ROLLBACK;
