import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260802134000_opening_hours_place_info.sql"),
  "utf8",
);

describe("öppettidernas databaskontrakt", () => {
  test("verifierar medlem, gruppställe och aktiv Geoapify-källa", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_place_external_info_context_v1",
    );
    expect(migration).toContain("_uid uuid := auth.uid()");
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
    expect(migration).toContain("FROM public.group_places gp");
    expect(migration).toContain("JOIN public.place_sources ps ON ps.place_id = gp.place_id");
    expect(migration).toContain("ps.provider = 'geoapify'");
    expect(migration).toContain("ps.status = 'active'");
  });

  test("har en låst SECURITY DEFINER-gräns utan anonym åtkomst", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path TO 'public'");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_place_external_info_context_v1(uuid, uuid)",
    );
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain("TO authenticated");
  });

  test("öppettidsfel är en separat rapportkategori", () => {
    expect(migration).toContain("'wrong_opening_hours'");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_place_data_report_v1");
  });
});
