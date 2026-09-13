import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260912170500_derived_review_model_v1.sql"),
  "utf8",
);
const archivedCompletionMigration = readFileSync(
  resolve(root, "supabase/migrations/20260912171000_derived_review_model_archived_completion.sql"),
  "utf8",
);

describe("Issue #307 — härledd reviewmodell i databasen", () => {
  test("bevarar legacy och lagrar explicit fryst modell för nya reviews", () => {
    expect(migration).toContain("ALTER COLUMN overall TYPE numeric(4,2)");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS atmosphere smallint");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS review_model text");
    expect(migration).toContain("Reviewmodellen är historiskt låst");
    expect(migration).toContain("WHERE review_model IS NOT NULL");
    expect(migration).toContain("Migrationen får inte backfilla review_model");
  });

  test("servern härleder tre- och fyrdimensionella betyg utan dold viktning", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.derive_review_overall_v1");
    expect(migration).toContain("_sum := _taste + _value + _service");
    expect(migration).toContain("_count := 3");
    expect(migration).toContain("_sum := _sum + _atmosphere");
    expect(migration).toContain("_count := 4");
    expect(migration).toContain("RETURN round(_sum / _count, 2)");
  });

  test("Hämtmat och Passar för avgör modellen server-side", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.resolve_new_review_model_v1");
    expect(migration).toContain("RETURN 'food_v1_takeaway'");
    expect(migration).toContain("'avslappnat' = ANY(_occasions)");
    expect(migration).toContain("'middag' = ANY(_occasions)");
    expect(migration).toContain("RETURN 'food_v1_atmosphere'");
    expect(migration).toContain("RETURN 'food_v1_quick'");
  });

  test("Hämtmat kan spara frivilligt Passar för utan att kräva klassificering", () => {
    expect(archivedCompletionMigration).toContain("SET occasions = _provided");
    expect(archivedCompletionMigration).toContain(
      "IF cardinality(COALESCE(_review_occasions, '{}'::text[])) > 0 THEN",
    );
    expect(archivedCompletionMigration.match(/RETURN 'food_v1_takeaway'/g)?.length).toBe(2);
  });

  test("nya write-RPC:er tar dimensioner men inget manuellt helhetsbetyg", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_visit_with_review_v5");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_own_review_for_visit_v2");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_own_review_v2");
    expect(migration).toContain("Helhetsbetyget härleds automatiskt för det här omdömet");
    expect(migration).toContain("Sätt alla relevanta betyg innan en kommentar sparas med omdömet");
  });

  test("nya read-modellen enrichar bara redan auktoriserade v5l-reviews", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5m");
    expect(migration).toContain("_result := public.get_group_app_state_v5l(_group_id)");
    expect(migration).toContain("'{atmosphere}'");
    expect(migration).toContain("'{reviewModel}'");
  });

  test("historiska besök kan kompletteras även om matstället senare arkiverats", () => {
    expect(archivedCompletionMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.resolve_new_review_model_v1",
    );
    expect(archivedCompletionMigration).not.toContain("gp.collection_status = 'active'");
    expect(archivedCompletionMigration).toContain("Matstället finns inte i gruppen");
    expect(migration).toContain("AND collection_status = 'active'");
  });
});
