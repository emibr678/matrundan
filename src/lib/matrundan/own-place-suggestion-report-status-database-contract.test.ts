import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260802110000_own_place_suggestion_report_status.sql",
  ),
  "utf8",
);

describe("egen status för providerträffsrapporter", () => {
  test("returnerar bara den inloggade användarens aktiva rapportnycklar", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.list_own_open_place_suggestion_report_keys_v1",
    );
    expect(migration).toContain("_uid uuid := auth.uid()");
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
    expect(migration).toContain("r.created_by = _uid");
    expect(migration).toContain("r.status IN ('open', 'ready_for_osm')");
    expect(migration).toContain("r.place_id IS NULL");
    expect(migration).not.toContain("jsonb_build_object");
  });

  test("har låst SECURITY DEFINER-gräns och inga anonyma grants", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path TO 'public'");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.list_own_open_place_suggestion_report_keys_v1\(uuid\)\s+FROM PUBLIC, anon;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.list_own_open_place_suggestion_report_keys_v1\(uuid\)\s+TO authenticated;/,
    );
  });
});
