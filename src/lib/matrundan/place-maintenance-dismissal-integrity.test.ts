import { describe, expect, test } from "bun:test";

const migrationPath =
  "supabase/migrations/20260808150500_place_maintenance_dismissal_integrity.sql";
const sql = await Bun.file(migrationPath).text();

describe("Platsunderhålls avfärdandeintegritet", () => {
  test("dismissed kräver en strukturerad orsak och övriga statusar saknar den", () => {
    expect(sql).toContain("status = 'dismissed'");
    expect(sql).toContain("status <> 'dismissed'");
    expect(sql).toContain("dismissal_reason IS NULL");
    for (const reason of [
      "not_relevant",
      "insufficient_evidence",
      "not_food_place",
      "already_handled",
    ]) {
      expect(sql).toContain(`'${reason}'`);
    }
  });

  test("RPC:n avvisar även explicit NULL som orsak", () => {
    expect(sql).toContain("IF _reason IS NULL");
    expect(sql).toContain("OR _reason NOT IN");
    expect(sql).toContain("RAISE EXCEPTION 'Ogiltig avfärdandeorsak'");
  });
});
