import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260921160000_historical_review_model_v1.sql"),
  "utf8",
);
const predeploy = readFileSync(
  resolve(root, "supabase/predeploy-historical-review-model.sql"),
  "utf8",
);
const productionPreflight = readFileSync(
  resolve(root, "supabase/production-preflight-historical-reviews.sql"),
  "utf8",
);
const aggregatePreflight = readFileSync(
  resolve(root, "supabase/production-preflight-all.sql"),
  "utf8",
);

describe("Issue #365 — stabil historisk reviewmodell", () => {
  test("preflight redovisar omfattning och stoppar oväntade datashapes utan skrivning", () => {
    expect(predeploy).toContain("BEGIN TRANSACTION READ ONLY");
    expect(predeploy).toContain("review_model_null_total");
    expect(predeploy).toContain("legacy_food_reviews");
    expect(predeploy).toContain("legacy_food_3d_reviews");
    expect(predeploy).toContain("legacy_food_overall_only_reviews");
    expect(predeploy).toContain("rows_whose_overall_changes");
    expect(predeploy).toContain("Preflight stoppad: oväntade historiska omdömen");
    expect(predeploy).toContain("ROLLBACK");
  });

  test("migrationen klassificerar verifierad legacydata som 3D eller overall-only", () => {
    expect(migration).toContain("'food_v0_3d'");
    expect(migration).toContain("'food_v0_overall'");
    expect(migration).toContain("visit.meal_type <> 'dryck'");
    expect(migration).toContain("review_row.review_model IS NULL");
    expect(migration).toContain("SET review_model = CASE");
    expect(migration).toContain("THEN 'food_v0_3d'");
    expect(migration).toContain("ELSE 'food_v0_overall'");
    expect(migration).toContain("DISABLE TRIGGER trg_reviews_updated_at");
    expect(migration).toContain("ENABLE TRIGGER trg_reviews_updated_at");
    expect(migration).toContain("Migrationen lämnade scorebara omdömen utan review_model");
  });

  test("3D-matematiken är låst medan endast uttrycklig Atmosfär-uppgradering tillåts", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.derive_review_overall_v1");
    expect(migration).toContain(
      "OLD.review_model IN ('food_v0_3d', 'food_v1_quick', 'food_v1_takeaway')",
    );
    expect(migration).toContain("NEW.review_model = 'food_v1_atmosphere'");
    expect(migration).toContain("Reviewmodellen är historiskt låst");
    expect(migration).toContain("Omdömets betygsmodell saknas");
  });

  test("overall-only behåller manuellt helhetsbetyg och kan bara ändra kommentar", () => {
    expect(migration).toContain("NEW.review_model = 'food_v0_overall'");
    expect(migration).toContain("Historiskt helhetsbetyg är låst");
    expect(migration).toContain("_review_model = 'food_v0_overall'");
    expect(migration).toContain(
      "Historiskt helhetsbetyg kan inte skrivas om utan en ny uttrycklig modell",
    );
  });

  test("separat upgrade-RPC kräver ägarskap, deltagande, gruppsynlighet och relevant modell", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.upgrade_own_review_model_v1");
    expect(migration).toContain("_author_id <> _uid");
    expect(migration).toContain("public.visit_group_links");
    expect(migration).toContain("public.visit_participants");
    expect(migration).toContain(
      "_stored_model NOT IN ('food_v0_3d', 'food_v1_quick', 'food_v1_takeaway')",
    );
    expect(migration).toContain("_target_model <> 'food_v1_atmosphere'");
    expect(migration).toContain("review_model = _stored_model");
    expect(migration).toContain("FOR UPDATE OF review_row");
    expect(migration).toContain("TO authenticated");
  });

  test("production-preflight verifierar data, RPC och negativa grants", () => {
    expect(productionPreflight).toContain("historical-review:no-scoreable-null-model");
    expect(productionPreflight).toContain("historical-review:stable-3d-score");
    expect(productionPreflight).toContain("historical-review:stable-overall-only-score");
    expect(productionPreflight).toContain("historical-review:no-anon-upgrade-grant");
    expect(aggregatePreflight).toContain("\\ir production-preflight-historical-reviews.sql");
  });
});
