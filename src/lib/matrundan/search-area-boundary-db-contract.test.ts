import { describe, expect, test } from "bun:test";

const boundaryMigration = await Bun.file(
  "supabase/migrations/20260811102000_search_area_boundaries.sql",
).text();
const legacyGuardMigration = await Bun.file(
  "supabase/migrations/20260811103500_search_area_boundary_legacy_read_guard.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-search-boundaries.sql").text();

describe("databaskontrakt för sökområdesgränser", () => {
  test("befintliga områden behåller point som bakåtkompatibelt default", () => {
    expect(boundaryMigration).toContain(
      "ADD COLUMN IF NOT EXISTS search_mode text NOT NULL DEFAULT 'point'",
    );
    expect(boundaryMigration).toContain("CHECK (search_mode IN ('point', 'boundary'))");
  });

  test("v5i exponerar explicit searchMode och resultType", () => {
    expect(boundaryMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_group_app_state_v5i(_group_id uuid)",
    );
    expect(boundaryMigration).toContain("'searchMode', a.search_mode");
    expect(boundaryMigration).toContain("'resultType', a.result_type");
  });

  test("äldre v5h-klienter får bara point-rader efter boundarymigration", () => {
    expect(legacyGuardMigration).toContain(
      "RENAME TO get_group_app_state_v5h_boundary_base",
    );
    expect(legacyGuardMigration).toContain("AND a.search_mode = 'point'");
    expect(legacyGuardMigration).toContain(
      "REVOKE ALL ON FUNCTION public.get_group_app_state_v5h_boundary_base(uuid)",
    );
    expect(legacyGuardMigration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5h_boundary_base(uuid)",
    );
  });

  test("produktions-preflight verifierar legacygrinden", () => {
    expect(preflight).toContain("search-area:legacy-v5h-point-only");
    expect(preflight).toContain("isolation:legacy-v5h-base-not-client-executable");
    expect(preflight).toContain("read_rpc_internal:get_group_app_state_v5h_boundary_base");
  });
});
