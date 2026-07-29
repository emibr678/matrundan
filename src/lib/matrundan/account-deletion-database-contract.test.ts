import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260729190000_v1_account_deletion.sql";
const sql = await Bun.file(migrationPath).text();

describe("kontoraderingens databaskontrakt", () => {
  test("användaren härleds från den autentiserade sessionen", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.prepare_own_account_deletion");
    expect(sql).toContain("_uid uuid := auth.uid()");
    expect(sql).toContain("IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'");
    expect(sql).not.toContain("_user_id uuid DEFAULT");
  });

  test("kräver efterträdare eller uttrycklig radering av ensamgrupp", () => {
    expect(sql).toContain("Välj en ny ägare för gruppen");
    expect(sql).toContain("_confirm_solo_group_deletion");
    expect(sql).toContain("DELETE FROM public.groups");
    expect(sql).toContain("DELETE FROM public.visits");
  });

  test("rensar personligt innehåll men bevarar numeriska omdömen", () => {
    expect(sql).toContain("SET comment = NULL");
    expect(sql).toContain("DELETE FROM public.favorites");
    expect(sql).toContain("DELETE FROM public.next_stop_date_responses");
    expect(sql).toContain("SET display_name = 'Tidigare medlem'");
    expect(sql).not.toContain("DELETE FROM public.reviews WHERE user_id");
    expect(sql).not.toContain("DELETE FROM public.visit_participants WHERE user_id");
  });

  test("RPC:erna har låst search path och minsta möjliga grants", () => {
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/SET search_path TO 'public'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.prepare_own_account_deletion(jsonb, boolean)",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.prepare_own_account_deletion(jsonb, boolean)",
    );
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("TO service_role");
  });
});
