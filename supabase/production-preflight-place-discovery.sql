-- Read-only readiness gate for canonical discovery and trusted source writes (#389).
WITH required(signature, client_callable) AS (VALUES
  ('public.get_place_discovery_context_v1(uuid)',true),
  ('public.search_canonical_places_v1(uuid,text,jsonb,text[],text[],integer)',true),
  ('public.match_place_discovery_candidates_v1(uuid,jsonb)',true),
  ('public.link_canonical_place_to_group_v1(uuid,uuid,text[],text)',true),
  ('public.find_reusable_manual_place_candidates_v2(uuid,text,text,text,double precision,double precision,text)',true),
  ('public.create_manual_place_fallback_v2(uuid,jsonb,jsonb)',true),
  ('public.resolve_verified_provider_place_v1(uuid,uuid,jsonb,text,uuid,jsonb,text[],text,text)',false),
  ('public.link_verified_maintenance_source_v1(uuid,uuid,jsonb)',false)
), checks(name,ok) AS (
 SELECT 'place_discovery_rpc:'||signature,to_regprocedure(signature) IS NOT NULL FROM required
 UNION ALL
 SELECT 'place_discovery_acl:'||signature,COALESCE(
   has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE')=client_callable
   AND NOT has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
   AND has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE'),false) FROM required
 UNION ALL
 SELECT 'place_discovery_private:no_client_schema',NOT has_schema_privilege('authenticated','private','USAGE')
 UNION ALL
 SELECT 'place_discovery_lock:places',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.places'::regclass AND tgname='serialize_place_identity_writes' AND tgenabled='O')
 UNION ALL
 SELECT 'place_discovery_lock:sources',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.place_sources'::regclass AND tgname='serialize_source_identity_writes' AND tgenabled='O')
 UNION ALL
 SELECT 'place_discovery_identity:unique_confirmation',
   position('_total<>1' in pg_get_functiondef('public.resolve_verified_provider_place_v1(uuid,uuid,jsonb,text,uuid,jsonb,text[],text,text)'::regprocedure))>0
 UNION ALL
 SELECT 'place_discovery_identity:server_confirmation_flag',
   position('canConfirmSource' in pg_get_functiondef('private.place_identity_candidates_v1(uuid,jsonb)'::regprocedure))>0
)
SELECT name,ok FROM checks ORDER BY name;
