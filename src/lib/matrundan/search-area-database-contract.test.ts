import { describe, expect, test } from "bun:test";

const migrationPath = "supabase/migrations/20260806175500_restore_production_guards.sql";
const sql = (await Bun.file(migrationPath).text()).replace(/\r\n/g, "\n");

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
    expect(sql).toContain("public.group_is_active(_group_id)");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.replace_group_search_settings(uuid, jsonb, integer)",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.replace_group_search_settings(uuid, jsonb, integer)",
    );
    expect(sql).toContain("TO authenticated");
  });

  test("hjälpfunktionen är intern och migrationen verifierar slutläget", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.search_area_label_is_broad(text)");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("search-area settings RPC is missing required guards");
    expect(sql).toContain("search-area settings RPC has incorrect execute grants");
  });
});

describe("besöksfotons Storage-kontrakt", () => {
  test("visit-photos förblir privat och accepterar endast begränsade JPEG-filer", () => {
    expect(sql).toContain("INSERT INTO storage.buckets");
    expect(sql).toContain("'visit-photos'");
    expect(sql).toContain("false,\n  1500000,\n  ARRAY['image/jpeg']::text[]");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE SET");
    expect(sql).toContain("file_size_limit = EXCLUDED.file_size_limit");
    expect(sql).toContain("allowed_mime_types = EXCLUDED.allowed_mime_types");
    expect(sql).toContain("visit-photos bucket configuration could not be restored");
  });
});
