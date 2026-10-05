-- Disposable local prototype for Issue #158. NOT a migration or merge API.
-- Apply to a migration-built database; every object and fixture rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(41);

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('15800000-0000-4000-8000-000000000001','merge-prototype@example.invalid','{}'),
 ('15800000-0000-4000-8000-000000000002','merge-member@example.invalid','{}');
INSERT INTO public.groups(id,name,created_by) VALUES
 ('15810000-0000-4000-8000-000000000001','Active prototype','15800000-0000-4000-8000-000000000001'),
 ('15810000-0000-4000-8000-000000000002','Archived prototype','15800000-0000-4000-8000-000000000001');
INSERT INTO public.memberships(group_id,user_id,role,status) VALUES
 ('15810000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','owner','active'),
 ('15810000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000002','member','active'),
 ('15810000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001','owner','active');
INSERT INTO public.places(id,name,category,address,city,lat,lng,added_by) VALUES
 ('15820000-0000-4000-8000-000000000001','Mergecafé','café','Testgatan 1','Teststad',59,18,'15800000-0000-4000-8000-000000000001'),
 ('15820000-0000-4000-8000-000000000002','Mergecafé','café','Testgatan 1','Teststad',59,18,'15800000-0000-4000-8000-000000000001');
INSERT INTO public.group_places(group_id,place_id,added_by,notes,occasions) VALUES
 ('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','Active note',ARRAY['avslappnat']),
 ('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001','Active note',ARRAY['avslappnat']),
 ('15810000-0000-4000-8000-000000000002','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','Archived private note',ARRAY['middag']);
INSERT INTO public.visits(id,place_id,visited_on,meal_type,created_by) VALUES
 ('15830000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','2026-09-01','fika','15800000-0000-4000-8000-000000000001'),
 ('15830000-0000-4000-8000-000000000002','15820000-0000-4000-8000-000000000002','2026-09-01','fika','15800000-0000-4000-8000-000000000001');
INSERT INTO public.visit_group_links(visit_id,group_id,link_type,linked_by) VALUES
 ('15830000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','original','15800000-0000-4000-8000-000000000001'),
 ('15830000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000002','shared','15800000-0000-4000-8000-000000000001'),
 ('15830000-0000-4000-8000-000000000002','15810000-0000-4000-8000-000000000001','original','15800000-0000-4000-8000-000000000001');
INSERT INTO public.visit_participants(visit_id,user_id) SELECT id,created_by FROM public.visits WHERE id::text LIKE '15830000%';
INSERT INTO public.reviews(id,visit_id,user_id,overall,taste,value,service,atmosphere,review_model,comment) VALUES
 ('15840000-0000-4000-8000-000000000001','15830000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001',4,5,4,3,4,'food_v1_atmosphere','Preserve this review');
INSERT INTO public.visit_media(id,visit_id,group_id,uploaded_by,storage_path,mime_type,byte_size,width,height) VALUES
 ('15870000-0000-4000-8000-000000000001','15830000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','prototype/158/photo.jpg','image/jpeg',1000,100,100);
INSERT INTO public.visit_media_group_visibility(media_id,visit_id,group_id,granted_by) VALUES
 ('15870000-0000-4000-8000-000000000001','15830000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001');
INSERT INTO public.activity(id,group_id,kind,actor_id,place_id,visit_id,payload) VALUES
 ('15880000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','prototype','15800000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15830000-0000-4000-8000-000000000001','{}');
INSERT INTO public.favorites(user_id,place_id,group_id) VALUES
 ('15800000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001'),
 ('15800000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002','15810000-0000-4000-8000-000000000001'),
 ('15800000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000002');
INSERT INTO public.next_stop_place_proposals(id,group_id,place_id,proposed_by,created_at) VALUES
 ('15850000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001','2026-09-01'),
 ('15850000-0000-4000-8000-000000000002','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001','2026-09-02');
INSERT INTO public.next_stop_place_supports(proposal_id,member_id) VALUES
 ('15850000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001'),
 ('15850000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000001');
INSERT INTO public.group_next_place(group_id,place_id,selected_by) VALUES
 ('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001');
INSERT INTO public.next_stop_date_proposals(id,group_id,place_id,proposed_date,created_by) VALUES
 ('15860000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','2026-10-20','15800000-0000-4000-8000-000000000001');
UPDATE public.groups SET lifecycle_status='archived',archived_at=now(),archived_by=created_by WHERE id='15810000-0000-4000-8000-000000000002';

CREATE TEMP TABLE prototype_originals AS SELECT 'review' AS kind,to_jsonb(r) AS row FROM public.reviews r WHERE id::text LIKE '15840000%'
 UNION ALL SELECT 'participant',to_jsonb(p) FROM public.visit_participants p WHERE visit_id::text LIKE '15830000%'
 UNION ALL SELECT 'link',to_jsonb(l) FROM public.visit_group_links l WHERE visit_id::text LIKE '15830000%'
 UNION ALL SELECT 'media',to_jsonb(m) FROM public.visit_media m WHERE id::text LIKE '15870000%'
 UNION ALL SELECT 'visibility',to_jsonb(m) FROM public.visit_media_group_visibility m WHERE media_id::text LIKE '15870000%'
 UNION ALL SELECT 'activity',to_jsonb(a) FROM public.activity a WHERE id::text LIKE '15880000%'
 UNION ALL SELECT 'visit',to_jsonb(v) FROM public.visits v WHERE id::text LIKE '15830000%'
 UNION ALL SELECT 'plan',to_jsonb(p) FROM public.next_stop_plans p WHERE group_id::text LIKE '15810000%';
CREATE FUNCTION pg_temp.naive_date_repoint() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 UPDATE public.group_next_place SET place_id='15820000-0000-4000-8000-000000000002' WHERE group_id='15810000-0000-4000-8000-000000000001';
 IF EXISTS(SELECT 1 FROM public.next_stop_date_proposals WHERE id='15860000-0000-4000-8000-000000000001' AND status='cancelled') THEN
   RAISE EXCEPTION 'DATE_WAS_CANCELLED'; END IF;
END $$;
SELECT throws_ok('SELECT pg_temp.naive_date_repoint()','P0001','DATE_WAS_CANCELLED','naive UPDATE really cancels the planned date');
SELECT throws_ok($$UPDATE public.group_places SET place_id='15820000-0000-4000-8000-000000000002' WHERE group_id='15810000-0000-4000-8000-000000000002'$$,'P0001','Gruppen är arkiverad och kan bara läsas','ordinary archived writes stay blocked');

-- Transaction-bound exact row capabilities. These are private; never a client flag.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;
-- Same lock key as #389; keep the disposable experiment runnable on main too.
CREATE OR REPLACE FUNCTION private.lock_place_identity_v1() RETURNS void
 LANGUAGE sql VOLATILE SET search_path='' AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('matrundan-place-identity-v1',0));
$$;
REVOKE ALL ON FUNCTION private.lock_place_identity_v1() FROM PUBLIC,anon,authenticated;
CREATE TABLE private.prototype_merge_caps(tx bigint NOT NULL,table_name text NOT NULL,op text NOT NULL,before_row jsonb,after_row jsonb);
REVOKE ALL ON private.prototype_merge_caps FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.prototype_allowed_write(_table text,_op text,_before jsonb,_after jsonb) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.prototype_merge_caps c WHERE c.tx=txid_current() AND c.table_name=_table AND c.op=_op
   AND (c.before_row-'updated_at') IS NOT DISTINCT FROM (_before-'updated_at')
   AND (c.after_row-'updated_at') IS NOT DISTINCT FROM (_after-'updated_at'));
$$;
REVOKE ALL ON FUNCTION private.prototype_allowed_write(text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.enforce_group_writable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE _group uuid; BEGIN
 IF private.prototype_allowed_write(TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END) THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 _group:=NULLIF((CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END)->>'group_id','')::uuid;
 IF _group IS NULL THEN RAISE EXCEPTION 'Gruppkoppling saknas'; END IF;
 IF NOT public.group_is_active(_group) THEN RAISE EXCEPTION 'Gruppen är arkiverad och kan bara läsas'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF private.prototype_allowed_write(TG_TABLE_NAME,TG_OP,to_jsonb(OLD),to_jsonb(NEW)) THEN NEW.updated_at:=OLD.updated_at; ELSE NEW.updated_at:=now(); END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.close_next_stop_date_on_next_place_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF private.prototype_allowed_write(TG_TABLE_NAME,TG_OP,to_jsonb(OLD),CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END)
   OR current_setting('matrundan.next_stop_v2_sync',true)='1' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_OP='DELETE' OR NEW.place_id IS DISTINCT FROM OLD.place_id THEN
 UPDATE public.next_stop_date_proposals SET status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),updated_at=now() WHERE group_id=OLD.group_id AND status IN ('active','confirmed'); END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

INSERT INTO private.prototype_merge_caps SELECT txid_current(),'group_places','INSERT',NULL,to_jsonb(gp)||jsonb_build_object('place_id','15820000-0000-4000-8000-000000000002') FROM public.group_places gp WHERE gp.group_id='15810000-0000-4000-8000-000000000002';
INSERT INTO public.group_places SELECT (jsonb_populate_record(NULL::public.group_places,c.after_row)).* FROM private.prototype_merge_caps c WHERE table_name='group_places';
SELECT is((SELECT notes FROM public.group_places WHERE group_id='15810000-0000-4000-8000-000000000002' AND place_id='15820000-0000-4000-8000-000000000002'),'Archived private note','identity-only copy preserves archived notes');
SELECT throws_ok($$UPDATE public.group_places SET notes='unapproved edit' WHERE group_id='15810000-0000-4000-8000-000000000002' AND place_id='15820000-0000-4000-8000-000000000002'$$,'P0001','Gruppen är arkiverad och kan bara läsas','capability cannot authorize a different content write');
SELECT ok(NOT has_table_privilege('authenticated','private.prototype_merge_caps','INSERT'),'browser cannot create a capability');
INSERT INTO private.prototype_merge_caps SELECT txid_current(),'visits','UPDATE',to_jsonb(v),to_jsonb(v)||jsonb_build_object('place_id','15820000-0000-4000-8000-000000000002') FROM public.visits v WHERE place_id='15820000-0000-4000-8000-000000000001';
UPDATE public.visits SET place_id='15820000-0000-4000-8000-000000000002' WHERE place_id='15820000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*) FROM public.visits WHERE id::text LIKE '15830000%' AND place_id='15820000-0000-4000-8000-000000000002'),2::bigint,'two real same-day visits retain separate IDs');
SELECT is((SELECT to_jsonb(r) FROM public.reviews r WHERE id='15840000-0000-4000-8000-000000000001'),(SELECT row FROM prototype_originals WHERE kind='review'),'review remains exactly unchanged');
SELECT ok(NOT EXISTS(SELECT row FROM prototype_originals WHERE kind='participant' EXCEPT SELECT to_jsonb(p) FROM public.visit_participants p),'participants remain unchanged');
SELECT ok(NOT EXISTS(SELECT row FROM prototype_originals WHERE kind='link' EXCEPT SELECT to_jsonb(l) FROM public.visit_group_links l),'sharing and source-group links remain unchanged');

INSERT INTO private.prototype_merge_caps SELECT txid_current(),'favorites','UPDATE',to_jsonb(f),to_jsonb(f)||jsonb_build_object('place_id','15820000-0000-4000-8000-000000000002') FROM public.favorites f WHERE group_id='15810000-0000-4000-8000-000000000002';
UPDATE public.favorites SET place_id='15820000-0000-4000-8000-000000000002' WHERE group_id='15810000-0000-4000-8000-000000000002';
DELETE FROM public.favorites WHERE group_id='15810000-0000-4000-8000-000000000001' AND place_id='15820000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*) FROM public.favorites WHERE user_id='15800000-0000-4000-8000-000000000001' AND place_id='15820000-0000-4000-8000-000000000002'),2::bigint,'favorites union retains each group, including archived group');

-- Keep earliest queue proposal and union supporters before deleting the duplicate.
INSERT INTO public.next_stop_place_supports(proposal_id,member_id) SELECT '15850000-0000-4000-8000-000000000001',member_id FROM public.next_stop_place_supports WHERE proposal_id='15850000-0000-4000-8000-000000000002' ON CONFLICT DO NOTHING;
DELETE FROM public.next_stop_place_proposals WHERE id='15850000-0000-4000-8000-000000000002';
UPDATE public.next_stop_place_proposals SET place_id='15820000-0000-4000-8000-000000000002' WHERE id='15850000-0000-4000-8000-000000000001';
INSERT INTO private.prototype_merge_caps SELECT txid_current(),'group_next_place','UPDATE',to_jsonb(n),to_jsonb(n)||jsonb_build_object('place_id','15820000-0000-4000-8000-000000000002') FROM public.group_next_place n WHERE group_id='15810000-0000-4000-8000-000000000001';
UPDATE public.group_next_place SET place_id='15820000-0000-4000-8000-000000000002' WHERE group_id='15810000-0000-4000-8000-000000000001';
INSERT INTO private.prototype_merge_caps SELECT txid_current(),'next_stop_date_proposals','UPDATE',to_jsonb(n),to_jsonb(n)||jsonb_build_object('place_id','15820000-0000-4000-8000-000000000002') FROM public.next_stop_date_proposals n WHERE id='15860000-0000-4000-8000-000000000001';
UPDATE public.next_stop_date_proposals SET place_id='15820000-0000-4000-8000-000000000002' WHERE id='15860000-0000-4000-8000-000000000001';
SELECT is((SELECT status FROM public.next_stop_date_proposals WHERE id='15860000-0000-4000-8000-000000000001'),'active','planned date is not cancelled');
SELECT ok(NOT EXISTS(SELECT row FROM prototype_originals WHERE kind='plan' EXCEPT SELECT to_jsonb(p) FROM public.next_stop_plans p),'queue plan/date/revision remain exactly unchanged');
SELECT is((SELECT created_at::date FROM public.next_stop_place_proposals WHERE id='15850000-0000-4000-8000-000000000001'),'2026-09-01'::date,'queue retains earliest position');
SELECT is((SELECT count(*) FROM public.next_stop_place_supports WHERE proposal_id='15850000-0000-4000-8000-000000000001'),1::bigint,'overlapping support is counted once');
SELECT is((SELECT count(*) FROM public.places WHERE id::text LIKE '15820000%'),2::bigint,'prototype does not cascade-delete original place');
SELECT ok(NOT EXISTS(SELECT row FROM prototype_originals WHERE kind='media' EXCEPT SELECT to_jsonb(m) FROM public.visit_media m),'media ID, ownership and storage path remain unchanged');
SELECT ok(NOT EXISTS(SELECT row FROM prototype_originals WHERE kind='visibility' EXCEPT SELECT to_jsonb(m) FROM public.visit_media_group_visibility m),'photo delivery tokens and explicit group visibility remain unchanged');
SELECT ok(NOT EXISTS(SELECT row FROM prototype_originals WHERE kind='activity' EXCEPT SELECT to_jsonb(a) FROM public.activity a),'immutable activities retain historical place and visit IDs');
SELECT ok(NOT EXISTS(SELECT row-'place_id' FROM prototype_originals WHERE kind='visit' EXCEPT SELECT to_jsonb(v)-'place_id' FROM public.visits v),'visit timestamps and all non-identity fields remain unchanged');

-- Resolver/retired-write experiment; no public product API is installed.
CREATE TABLE private.prototype_place_redirects(
 from_id uuid PRIMARY KEY REFERENCES public.places(id),
 to_id uuid NOT NULL REFERENCES public.places(id),
 CHECK(from_id<>to_id)
);
REVOKE ALL ON private.prototype_place_redirects FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.prototype_resolve(_id uuid) RETURNS uuid
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE _next uuid; _seen uuid[]:=ARRAY[]::uuid[]; BEGIN
 LOOP
  IF _id=ANY(_seen) OR cardinality(_seen)>=32 THEN RAISE EXCEPTION 'PLACE_IDENTITY_CYCLE'; END IF;
  _seen:=array_append(_seen,_id);
  SELECT to_id INTO _next FROM private.prototype_place_redirects WHERE from_id=_id;
  IF NOT FOUND THEN RETURN _id; END IF;
  _id:=_next;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.prototype_resolve(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.prototype_check_redirect() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM private.lock_place_identity_v1();
 IF private.prototype_resolve(NEW.to_id)=NEW.from_id THEN RAISE EXCEPTION 'PLACE_IDENTITY_CYCLE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.prototype_check_redirect() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER prototype_redirect_guard BEFORE INSERT OR UPDATE ON private.prototype_place_redirects
 FOR EACH ROW EXECUTE FUNCTION private.prototype_check_redirect();
CREATE FUNCTION public.prototype_resolve_group_place(_group uuid,_place uuid) RETURNS uuid
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE _resolved uuid; BEGIN
 IF auth.uid() IS NULL OR NOT public.has_membership(_group,auth.uid()) THEN RETURN NULL; END IF;
 _resolved:=private.prototype_resolve(_place);
 IF NOT EXISTS(SELECT 1 FROM public.group_places WHERE group_id=_group AND place_id=_resolved) THEN RETURN NULL; END IF;
 RETURN _resolved;
END $$;
REVOKE ALL ON FUNCTION public.prototype_resolve_group_place(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prototype_resolve_group_place(uuid,uuid) TO authenticated;
INSERT INTO private.prototype_place_redirects VALUES('15820000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000002');
SELECT set_config('request.jwt.claim.sub','15800000-0000-4000-8000-000000000001',true);
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001'),'15820000-0000-4000-8000-000000000002'::uuid,'old group link resolves to the surviving identity');
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000002','15820000-0000-4000-8000-000000000001'),'15820000-0000-4000-8000-000000000002'::uuid,'archived group link resolves without reopening the group');
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000099','15820000-0000-4000-8000-000000000001'),NULL::uuid,'unknown or unauthorized group gets no identity projection');
SELECT set_config('request.jwt.claim.sub','15800000-0000-4000-8000-000000000099',true);
SET LOCAL ROLE authenticated;
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001'),NULL::uuid,'outsider cannot read a known old place link');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001'),NULL::uuid,'missing authentication never gains access through an alias');
SELECT ok(NOT has_table_privilege('authenticated','private.prototype_place_redirects','SELECT'),'private redirect graph is not a public catalogue');
SELECT throws_ok($$INSERT INTO private.prototype_place_redirects VALUES('15820000-0000-4000-8000-000000000002','15820000-0000-4000-8000-000000000001')$$,'P0001','PLACE_IDENTITY_CYCLE','inverse redirect is rejected');

CREATE FUNCTION private.prototype_reject_retired_write() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.prototype_place_redirects WHERE from_id=NEW.place_id) THEN RAISE EXCEPTION 'PLACE_IDENTITY_RETIRED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.prototype_reject_retired_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER prototype_retired_visit BEFORE INSERT OR UPDATE OF place_id ON public.visits
 FOR EACH ROW EXECUTE FUNCTION private.prototype_reject_retired_write();
CREATE TRIGGER prototype_retired_group_place BEFORE INSERT OR UPDATE ON public.group_places
 FOR EACH ROW EXECUTE FUNCTION private.prototype_reject_retired_write();
SELECT throws_ok($$INSERT INTO public.visits(place_id,visited_on,meal_type,created_by) VALUES('15820000-0000-4000-8000-000000000001','2026-10-01','fika','15800000-0000-4000-8000-000000000001')$$,'P0001','PLACE_IDENTITY_RETIRED','new visits cannot resurrect the retired identity');
SELECT throws_ok($$UPDATE public.visits SET place_id='15820000-0000-4000-8000-000000000001' WHERE id='15830000-0000-4000-8000-000000000001'$$,'P0001','PLACE_IDENTITY_RETIRED','existing visits cannot move back to a tombstone');
SELECT throws_ok($$INSERT INTO public.group_places(group_id,place_id,added_by) VALUES('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001','15800000-0000-4000-8000-000000000001')$$,'P0001','PLACE_IDENTITY_RETIRED','new group relations cannot resurrect a tombstone');
SELECT is((SELECT count(*) FROM public.visits WHERE id::text LIKE '15830000%'),2::bigint,'rejected retired-ID writes do not alter visit count');
SELECT throws_ok($$UPDATE public.group_places SET notes='resurrect private content' WHERE group_id='15810000-0000-4000-8000-000000000001' AND place_id='15820000-0000-4000-8000-000000000001'$$,'P0001','PLACE_IDENTITY_RETIRED','technical historical group row cannot be edited as a separate current place');

-- Refuse to assume a permanently complete table inventory. An unseen FK is a blocker.
CREATE FUNCTION private.prototype_assert_reference_inventory() RETURNS void
 LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c
   JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
   WHERE c.contype='f' AND c.confrelid='public.places'::regclass AND n.nspname='public'
   AND t.relname<>ALL(ARRAY['visits','group_places','favorites','group_next_place','activity',
    'place_sources','place_data_reports','place_data_signal_confirmations',
    'group_place_practical_info_history','place_external_info_snapshots',
    'place_improvement_candidates','place_maintenance_events'])) THEN
   RAISE EXCEPTION 'PLACE_REFERENCE_INVENTORY_CHANGED';
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.prototype_assert_reference_inventory() FROM PUBLIC,anon,authenticated;
SELECT lives_ok('SELECT private.prototype_assert_reference_inventory()','all current direct place references have an explicit inventory entry');
CREATE TABLE public.prototype_unseen_reference(place_id uuid REFERENCES public.places(id));
SELECT throws_ok('SELECT private.prototype_assert_reference_inventory()','P0001','PLACE_REFERENCE_INVENTORY_CHANGED','future unseen place FK blocks merge until reviewed');
DROP TABLE public.prototype_unseen_reference;

CREATE FUNCTION private.prototype_statement_lock() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM private.lock_place_identity_v1(); RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.prototype_statement_lock() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE _table text; BEGIN
 FOREACH _table IN ARRAY ARRAY['visits','group_places','favorites','group_next_place','activity',
 'place_sources','place_data_reports','place_data_signal_confirmations',
 'group_place_practical_info_history','place_external_info_snapshots',
 'place_improvement_candidates','place_maintenance_events'] LOOP
  EXECUTE format('CREATE TRIGGER prototype_identity_statement_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.prototype_statement_lock()',_table);
  IF _table NOT IN ('visits','group_places') THEN
   EXECUTE format('CREATE TRIGGER prototype_retired_reference BEFORE INSERT OR UPDATE OF place_id ON public.%I FOR EACH ROW EXECUTE FUNCTION private.prototype_reject_retired_write()',_table);
  END IF;
 END LOOP;
END $$;
SELECT is((SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgname='prototype_identity_statement_lock'),12::bigint,'all twelve direct reference tables enter common identity lock before row locks');
SELECT throws_ok($$INSERT INTO public.place_sources(place_id,provider,provider_place_id,status) VALUES('15820000-0000-4000-8000-000000000001','geoapify','prototype-retired-source','active')$$,'P0001','PLACE_IDENTITY_RETIRED','provider sources cannot resurrect an old identity');
SELECT throws_ok($$INSERT INTO public.favorites(user_id,group_id,place_id) VALUES('15800000-0000-4000-8000-000000000001','15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001')$$,'P0001','PLACE_IDENTITY_RETIRED','favorites cannot be created on a retired identity');
SELECT ok(NOT has_function_privilege('authenticated','private.prototype_resolve(uuid)','EXECUTE'),'browser cannot use private resolver to enumerate identity graph');
SELECT set_config('request.jwt.claim.sub','15800000-0000-4000-8000-000000000002',true);
UPDATE public.memberships SET status='left' WHERE group_id='15810000-0000-4000-8000-000000000001' AND user_id=auth.uid();
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001'),NULL::uuid,'removed membership loses alias access immediately');
UPDATE public.memberships SET status='active' WHERE group_id='15810000-0000-4000-8000-000000000001' AND user_id=auth.uid();
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000099'),NULL::uuid,'unknown place does not become readable through group membership');

INSERT INTO public.places(id,name,category,added_by) VALUES('15820000-0000-4000-8000-000000000003','Third canonical','café','15800000-0000-4000-8000-000000000001');
INSERT INTO public.group_places(group_id,place_id,added_by) VALUES('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000003','15800000-0000-4000-8000-000000000001');
INSERT INTO private.prototype_place_redirects VALUES('15820000-0000-4000-8000-000000000002','15820000-0000-4000-8000-000000000003');
SELECT set_config('request.jwt.claim.sub','15800000-0000-4000-8000-000000000001',true);
SELECT is(public.prototype_resolve_group_place('15810000-0000-4000-8000-000000000001','15820000-0000-4000-8000-000000000001'),'15820000-0000-4000-8000-000000000003'::uuid,'later redirect chains resolve to the current canonical identity');
SELECT throws_ok($$INSERT INTO private.prototype_place_redirects VALUES('15820000-0000-4000-8000-000000000003','15820000-0000-4000-8000-000000000001')$$,'P0001','PLACE_IDENTITY_CYCLE','longer redirect cycles are rejected');
SELECT * FROM finish();
ROLLBACK;
