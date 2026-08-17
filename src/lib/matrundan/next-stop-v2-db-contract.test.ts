import { describe, expect, test } from "bun:test";

const migration = await Bun.file("supabase/migrations/20260816183000_next_stop_v2.sql").text();
const focusModel = await Bun.file(
  "supabase/migrations/20260817071000_next_stop_v2_focus_model.sql",
).text();
const hybrid = await Bun.file(
  "supabase/migrations/20260817131000_next_stop_v2_hybrid_day_responses.sql",
).text();
const preferences = await Bun.file(
  "supabase/migrations/20260817132000_next_stop_v2_place_preferences.sql",
).text();
const legacyBridge = await Bun.file(
  "supabase/migrations/20260816183100_next_stop_v2_legacy_selection_bridge.sql",
).text();
const archiveBridge = await Bun.file(
  "supabase/migrations/20260816183200_next_stop_v2_place_archive_bridge.sql",
).text();

describe("databaskontrakt för Nästa stopp v2", () => {
  test("privat gruppstate exponeras bara via validerade RPC:er", () => {
    expect(migration).toContain("CREATE TABLE public.next_stop_plans");
    expect(migration).toContain("CREATE TABLE public.next_stop_place_proposals");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.next_stop_place_proposals FROM PUBLIC, anon, authenticated",
    );
    expect(preferences).toContain(
      "REVOKE ALL ON TABLE public.next_stop_place_supports FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path TO 'public'");
    expect(preferences).toContain("public.has_membership(_group_id, _uid)");
  });

  test("första förslaget får fokus och senare förslag bevaras", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.propose_next_stop_place_v2(");
    expect(focusModel).toContain("IF _proposal_count >= 5 THEN");
    expect(focusModel).toContain("IF _current_place_id IS NULL THEN");
  });

  test("Jag vill hit är separat från fokus och kan sättas på flera förslag", () => {
    expect(preferences).toContain("CREATE TABLE public.next_stop_place_supports");
    expect(preferences).toContain(
      "CREATE OR REPLACE FUNCTION public.set_next_stop_place_support_v2(",
    );
    expect(preferences).toContain("_supported boolean");
    expect(preferences).toContain("ON CONFLICT (proposal_id, member_id) DO UPDATE");
    expect(preferences).not.toContain("set_next_place(_group_id");
  });

  test("slutmodellen är dag-only och dagen kräver ett faktiskt nästa stopp", () => {
    expect(focusModel).toContain("next_stop_plans_no_time CHECK (planned_time IS NULL)");
    expect(hybrid).toContain("Nästa stopp använder bara dag, inte klockslag");
    expect(hybrid).toContain("Välj nästa stopp innan ni lägger till en dag");
    expect(hybrid).toContain("Europe/Stockholm");
  });

  test("dagsvar är binära, privata och återanvänder den etablerade datumresponsen", () => {
    expect(hybrid).toContain("CREATE OR REPLACE FUNCTION public.set_next_stop_day_response_v2(");
    expect(hybrid).toContain("_response NOT IN ('can', 'cannot')");
    expect(hybrid).toContain("public.next_stop_date_responses");
    expect(hybrid).toContain("_response = 'can' THEN 'fits' ELSE 'not_fits'");
    expect(hybrid).toContain(
      "GRANT EXECUTE ON FUNCTION public.set_next_stop_day_response_v2(uuid, text)",
    );
  });

  test("fokusbyte bevarar dagsvar och platsintresse men dagbyte rensar bara dagsvaren", () => {
    expect(hybrid).toContain("SET place_id = _place_id");
    expect(hybrid).toContain("IF _current_date IS DISTINCT FROM _planned_date THEN");
    expect(hybrid).toContain("DELETE FROM public.next_stop_date_responses");
    expect(hybrid).toContain("proposed_date = _planned_date");
    expect(preferences).toContain(
      "REFERENCES public.next_stop_place_proposals(id) ON DELETE CASCADE",
    );
  });

  test("samtidiga byten skyddas av grupp-lås och revision", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("next_stop_v2_assert_revision");
    expect(migration).toContain("Planeringen ändrades nyss av någon annan");
    expect(focusModel).toContain("_expected_revision bigint DEFAULT NULL");
  });

  test("verkligt originalbesök avslutar relevant plan men delat besök gör det inte", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.close_next_stop_v2_on_original_visit()",
    );
    expect(migration).toContain("IF NEW.link_type <> 'original' THEN RETURN NEW; END IF;");
    expect(migration).toContain(
      "DELETE FROM public.next_stop_place_proposals WHERE group_id = NEW.group_id",
    );
    expect(migration).toContain("DELETE FROM public.next_stop_plans WHERE group_id = NEW.group_id");
  });

  test("arkivering kan flytta fokus och behålla samma dagssvar på ersättaren", () => {
    expect(archiveBridge).toContain(
      "CREATE OR REPLACE FUNCTION public.archive_group_place(_group_id uuid, _place_id uuid)",
    );
    expect(hybrid).toContain(
      "CREATE OR REPLACE FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()",
    );
    expect(hybrid).toContain("_replacement_place_id uuid");
    expect(hybrid).toContain("ORDER BY p.created_at, p.id");
    expect(hybrid).toContain("PERFORM public.next_stop_v2_sync_legacy_date(");
  });

  test("v5k är additiv ovanpå v5j och exponerar bara aktiva medlemmars platsintresse", () => {
    expect(preferences).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5k(");
    expect(preferences).toContain("_result := public.get_group_app_state_v5j(_group_id)");
    expect(preferences).toContain("FROM public.next_stop_place_supports s");
    expect(preferences).toContain("AND m.status = 'active'");
    expect(legacyBridge).toContain("bridge_group_next_place_to_v2_proposal");
    expect(legacyBridge).toContain("IF _proposal_count >= 5 THEN");
    expect(legacyBridge).toContain("ON CONFLICT (group_id, place_id) DO NOTHING");
  });
});
