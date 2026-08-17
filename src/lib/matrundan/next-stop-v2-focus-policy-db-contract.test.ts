import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260817071000_next_stop_v2_focus_model.sql",
).text();
const archiveSync = await Bun.file(
  "supabase/migrations/20260817071500_next_stop_v2_archive_focus_sync.sql",
).text();
const hybrid = await Bun.file(
  "supabase/migrations/20260817131000_next_stop_v2_hybrid_day_responses.sql",
).text();
const preferences = await Bun.file(
  "supabase/migrations/20260817132000_next_stop_v2_place_preferences.sql",
).text();

describe("fokusmodell för Nästa stopp v2", () => {
  test("första förslaget får momentum utan att senare förslag skriver över", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.propose_next_stop_place_v2(");
    expect(migration).toContain("IF _current_place_id IS NULL THEN");
    expect(migration).toContain("PERFORM public.set_next_place(_group_id, _place_id)");
    expect(migration).toContain("IF _proposal_count >= 5 THEN");
  });

  test("v2 är dag-only och avvisar klockslag server-side", () => {
    expect(migration).toContain("next_stop_plans_no_time CHECK (planned_time IS NULL)");
    expect(hybrid).toContain("IF _planned_time IS NOT NULL THEN");
    expect(hybrid).toContain("Nästa stopp använder bara dag, inte klockslag");
    expect(hybrid).toContain("planned_time = NULL");
  });

  test("dagen finns bara när gruppen har ett nästa stopp", () => {
    expect(hybrid).toContain("Välj nästa stopp innan ni lägger till en dag");
    expect(hybrid).toContain("IF _place_id IS NULL THEN");
    expect(hybrid).toContain("_planned_date := NULL");
  });

  test("dagsvar och platsintresse har separata slutkontrakt", () => {
    expect(hybrid).toContain("DROP TABLE IF EXISTS public.next_stop_place_supports CASCADE");
    expect(hybrid).toContain("CREATE OR REPLACE FUNCTION public.set_next_stop_day_response_v2(");
    expect(hybrid).toContain("_response NOT IN ('can', 'cannot')");
    expect(preferences).toContain("CREATE TABLE public.next_stop_place_supports");
    expect(preferences).toContain("CREATE OR REPLACE FUNCTION public.set_next_stop_place_support_v2(");
    expect(preferences).toContain("Flera ställen får stödjas samtidigt");
    expect(preferences).toContain("Inga signaler påverkar selectedPlaceId");
  });

  test("det separata öppna val-läget är fortsatt borttaget", () => {
    expect(migration).toContain(
      "DROP FUNCTION IF EXISTS public.clear_next_stop_selection_v2(uuid, bigint)",
    );
  });

  test("borttaget fokuserat förslag flyttar fokus deterministiskt", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.withdraw_next_stop_place_v2(");
    expect(migration).toContain("_replacement_place_id uuid");
    expect(migration).toContain("ORDER BY p.created_at, p.id");
    expect(migration).toContain("PERFORM public.set_next_place(_group_id, _replacement_place_id)");
  });

  test("arkivering flyttar fokus och behåller samma dag/svar när alternativ finns", () => {
    expect(archiveSync).toContain(
      "CREATE OR REPLACE FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()",
    );
    expect(hybrid).toContain("_was_selected boolean := false");
    expect(hybrid).toContain("_replacement_place_id uuid");
    expect(hybrid).toContain("ORDER BY p.created_at, p.id");
    expect(hybrid).toContain("PERFORM public.next_stop_v2_sync_legacy_date(");
    expect(hybrid).toContain("IF _replacement_place_id IS NULL THEN");
  });
});
