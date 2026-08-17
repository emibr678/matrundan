import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260817071000_next_stop_v2_focus_model.sql",
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
    expect(migration).toContain("IF _planned_time IS NOT NULL THEN");
    expect(migration).toContain("Nästa stopp använder bara dag, inte klockslag");
    expect(migration).toContain("planned_time = NULL");
  });

  test("det separata öppna val-läget tas bort", () => {
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

  test("arkivering av fokuserat ställe kan flytta fokus till ett kvarvarande alternativ", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.cleanup_next_stop_proposal_on_place_archive_v2()",
    );
    expect(migration).toContain("_was_selected boolean := false");
    expect(migration).toContain("_replacement_place_id uuid");
    expect(migration).toContain("ORDER BY p.created_at, p.id");
  });
});
