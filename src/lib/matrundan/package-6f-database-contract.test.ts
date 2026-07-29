import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260729170000_package_6f_finish_product_list.sql";
const sql = await Bun.file(migrationPath).text();

describe("Paket 6F:s databaskontrakt", () => {
  test("radering av originalbesök är gruppskyddad och atomär", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.can_delete_original_visit");
    expect(sql).toContain("public.has_membership(_group_id, _user_id)");
    expect(sql).toContain("_user_id = auth.uid()");
    expect(sql).toContain("vgl.link_type = 'original'");
    expect(sql).toContain("v.created_by = _user_id");
    expect(sql).toContain("ARRAY['owner','admin']");
    expect(sql).toContain("DELETE FROM public.activity WHERE visit_id = _visit_id");
    expect(sql).toContain("DELETE FROM public.visits WHERE id = _visit_id");
  });

  test("datumändring kräver rätt behörighet och nollställer svar", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.update_next_stop_date_proposal");
    expect(sql).toContain("_proposal.created_by <> _uid");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("confirmed_at = NULL");
    expect(sql).toContain("DELETE FROM public.next_stop_date_responses");
  });

  test("nya RPC:er är låsta till autentiserade användare", () => {
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql.match(/SET search_path TO 'public'/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.delete_original_visit(uuid, uuid) FROM PUBLIC, anon",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.delete_original_visit(uuid, uuid) TO authenticated",
    );
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.update_next_stop_date_proposal");
  });
});
