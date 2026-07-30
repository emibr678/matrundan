import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260730173500_v1_5_sharing_repair.sql";
const sql = await Bun.file(migrationPath).text();

describe("v1.5.0:s delningskontrakt", () => {
  test("tidigare besök läses bara för aktiva grupper och faktiska deltagare", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.list_own_visits_for_place_on_add");
    expect(sql).toContain("public.group_is_active(_target_group_id)");
    expect(sql).toContain("g.lifecycle_status = 'active'");
    expect(sql).toContain("vp.user_id = _uid");
    expect(sql).toContain("mm.status = 'active'");
  });

  test("delning kräver aktiv målgrupp och deltagande", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.share_visit_to_group");
    expect(sql).toContain("RAISE EXCEPTION 'Målgruppen är arkiverad och kan bara läsas'");
    expect(sql).toContain("RAISE EXCEPTION 'Du deltog inte i besöket'");
    expect(sql).toContain("RAISE EXCEPTION 'Besöket är redan tillagt i denna grupp'");
  });

  test("matstället återaktiveras och aktivitet loggas i målgruppen", () => {
    expect(sql).toContain("ON CONFLICT (group_id, place_id) DO UPDATE");
    expect(sql).toContain("collection_status = 'active'");
    expect(sql).toContain("archived_at = NULL");
    expect(sql).toContain("INSERT INTO public.activity");
    expect(sql).toContain("'shared',");
  });

  test("RPC:erna är låsta till autentiserade användare", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.list_own_visits_for_place_on_add(uuid, uuid) FROM PUBLIC, anon",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.list_own_visits_for_place_on_add(uuid, uuid) TO authenticated",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.share_visit_to_group(uuid, uuid, boolean) FROM PUBLIC, anon",
    );
  });
});
