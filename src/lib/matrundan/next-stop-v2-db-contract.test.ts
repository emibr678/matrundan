import { describe, expect, test } from "bun:test";

const migration = await Bun.file("supabase/migrations/20260816183000_next_stop_v2.sql").text();
const legacyBridge = await Bun.file(
  "supabase/migrations/20260816183100_next_stop_v2_legacy_selection_bridge.sql",
).text();

describe("databaskontrakt för Nästa stopp v2", () => {
  test("privat gruppstate exponeras bara via validerade RPC:er", () => {
    expect(migration).toContain("CREATE TABLE public.next_stop_plans");
    expect(migration).toContain("CREATE TABLE public.next_stop_place_proposals");
    expect(migration).toContain("CREATE TABLE public.next_stop_place_supports");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.next_stop_place_proposals FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path TO 'public'");
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
  });

  test("förslag och Gärna-signal är separata från det bestämda stoppet", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.propose_next_stop_place_v2(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_next_stop_place_support_v2(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.select_next_stop_place_v2(");
    expect(migration).toContain("IF _proposal_count >= 5 THEN");
    expect(migration).toContain("INSERT INTO public.group_next_place");
  });

  test("dag kan finnas utan ställe men tid kräver dag", () => {
    expect(migration).toContain("next_stop_plans_time_requires_date");
    expect(migration).toContain("_planned_time IS NOT NULL AND _planned_date IS NULL");
    expect(migration).toContain("Europe/Stockholm");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_next_stop_schedule_v2(");
  });

  test("samtidiga beslut skyddas av grupp-lås och revision", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("next_stop_v2_assert_revision");
    expect(migration).toContain("Planeringen ändrades nyss av någon annan");
    expect(migration).toContain("_expected_revision bigint DEFAULT NULL");
  });

  test("verkligt originalbesök avslutar relevant plan men delat besök gör det inte", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.close_next_stop_v2_on_original_visit()");
    expect(migration).toContain("IF NEW.link_type <> 'original' THEN RETURN NEW; END IF;");
    expect(migration).toContain("DELETE FROM public.next_stop_place_proposals WHERE group_id = NEW.group_id");
    expect(migration).toContain("DELETE FROM public.next_stop_plans WHERE group_id = NEW.group_id");
  });

  test("v5k är additiv ovanpå v5j och legacy-val tappar inte diskussion tyst", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(");
    expect(migration).toContain("_result := public.get_group_app_state_v5j(_group_id)");
    expect(legacyBridge).toContain("bridge_group_next_place_to_v2_proposal");
    expect(legacyBridge).toContain("IF _proposal_count >= 5 THEN");
    expect(legacyBridge).toContain("ON CONFLICT (group_id, place_id) DO NOTHING");
  });
});
