import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260731114000_search_area_admin_guard.sql";
const sql = await Bun.file(migrationPath).text();

describe("sökområdenas databaskontrakt", () => {
  test("nya kommun-, läns- och regionval blockeras", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.search_area_label_is_broad");
    expect(sql).toContain("kommun|län|region|municipality|county|state|country");
    expect(sql).toContain("IF public.search_area_label_is_broad(_label)");
    expect(sql).toContain(
      "RAISE EXCEPTION 'Välj en ort, stadsdel eller adress i stället för kommun, län eller region'",
    );
  });

  test("befintliga breda områden kan ligga kvar tills användaren byter dem", () => {
    expect(sql).toContain("FROM public.group_search_areas existing");
    expect(sql).toContain("existing.group_id = _group_id");
    expect(sql).toContain("existing.provider_place_id = _place_id");
    expect(sql).toContain("existing.label = _label");
  });

  test("skrivfunktionen förblir rollskyddad och endast autentiserad", () => {
    expect(sql).toContain("public.has_group_role(_group_id, _uid, ARRAY['owner','admin'])");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.replace_group_search_settings(uuid, jsonb, integer)",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.replace_group_search_settings(uuid, jsonb, integer)",
    );
    expect(sql).toContain("TO authenticated");
  });
});
