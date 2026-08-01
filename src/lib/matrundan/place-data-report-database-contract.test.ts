import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260801123000_place_data_reporting.sql";
const sql = await Bun.file(migrationPath).text();

describe("platsdatarapporternas databaskontrakt", () => {
  test("rapporttabellen är gruppprivat utan direkt klientåtkomst", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.place_data_reports");
    expect(sql).toContain("ALTER TABLE public.place_data_reports ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.place_data_reports FROM PUBLIC, anon, authenticated",
    );
  });

  test("medlem får rapportera endast ett ställe som hör till den aktiva gruppen", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.create_place_data_report_v1");
    expect(sql).toContain("public.group_is_active(_group_id)");
    expect(sql).toContain("public.has_membership(_group_id, _uid)");
    expect(sql).toContain("FROM public.group_places gp");
    expect(sql).toContain("gp.group_id = _group_id");
    expect(sql).toContain("gp.place_id = _place_id");
  });

  test("bara ägare och admin får läsa kön och ändra status", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.list_group_place_data_reports_v1");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.review_place_data_report_v1");
    expect(
      sql.match(/public\.has_group_role\(_group_id, _uid, ARRAY\['owner', 'admin'\]\)/g)?.length,
    ).toBe(2);
  });

  test("rå providerdata lämnar aldrig rapportgränsen", () => {
    expect(sql).toContain("'providerPlaceId', ps.provider_place_id");
    expect(sql).toContain("'status', ps.status");
    expect(sql).not.toContain("ps.raw");
  });

  test("kontoradering kan anonymisera rapportören utan kvarvarande namnkopia", () => {
    expect(sql).not.toContain("reporter_name_snapshot");
    expect(sql).toContain("'Tidigare medlem'");
    expect(sql).toContain("LEFT JOIN public.profiles reporter ON reporter.id = r.created_by");
  });

  test("samtliga RPC:er är låsta till autentiserade användare", () => {
    for (const signature of [
      "public.create_place_data_report_v1(uuid, uuid, text, text)",
      "public.list_group_place_data_reports_v1(uuid)",
      "public.review_place_data_report_v1(uuid, uuid, text, text)",
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION ${signature}`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${signature}`);
    }
    expect(sql.match(/TO authenticated;/g)?.length).toBe(3);
  });
});
