import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260802190000_group_practical_info_sync.sql"),
  "utf8",
);
const readMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260802190500_group_practical_info_read.sql"),
  "utf8",
);

describe("praktisk information och källsynk", () => {
  test("lagrar gruppöverstyrningar, källa och revisionshistorik separat", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS opening_hours_override jsonb");
    expect(migration).toContain("practical_info_source_url text");
    expect(migration).toContain("practical_info_updated_by uuid");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.group_place_practical_info_history");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.group_place_practical_info_history");
  });

  test("låter aktiva medlemmar uppdatera gruppen utan att skriva global sanning", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.update_group_place_practical_info_v1",
    );
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
    expect(migration).toContain("UPDATE public.group_places");
    expect(migration).not.toContain("UPDATE public.places\n  SET opening_hours");
    expect(migration).toContain("Ange en källänk eller en kort observation");
  });

  test("sparar bara normaliserad extern snapshot bakom grupp- och källkontroll", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.place_external_info_snapshots");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_place_external_info_snapshot_v1");
    expect(migration).toContain("ps.provider = 'geoapify'");
    expect(migration).toContain("ps.status = 'active'");
    expect(migration).toContain("public.valid_opening_hours_schedule_v1(_opening_hours)");
    expect(migration).toContain("REVOKE ALL ON TABLE public.place_external_info_snapshots");
  });

  test("läsning och historik kräver medlemskap och saknar anonym åtkomst", () => {
    expect(readMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_group_place_practical_info_v1",
    );
    expect(readMigration).toContain("public.has_membership(_group_id, _uid)");
    expect(readMigration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.list_group_place_practical_info_history_v1",
    );
    expect(migration).toContain("FROM PUBLIC, anon");
  });
});
