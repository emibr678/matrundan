import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const baseMigration = readFileSync(
  resolve(root, "supabase/migrations/20260912170500_derived_review_model_v1.sql"),
  "utf8",
);
const archivedCompletionMigration = readFileSync(
  resolve(root, "supabase/migrations/20260912171000_derived_review_model_archived_completion.sql"),
  "utf8",
);

describe("Issue #307 — historiska besök på arkiverade ställen", () => {
  test("nya besök kräver fortfarande ett aktivt matställe", () => {
    expect(baseMigration).toContain("CREATE OR REPLACE FUNCTION public.create_visit_with_review_v5");
    expect(baseMigration).toContain("AND collection_status = 'active'");
    expect(baseMigration).toContain("Matstället finns inte i gruppens aktiva lista");
  });

  test("reviewmodellen kan lösas för ett redan synligt historiskt besök även efter arkivering", () => {
    expect(archivedCompletionMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.resolve_new_review_model_v1",
    );
    expect(archivedCompletionMigration).toContain("WHERE gp.group_id = _group_id");
    expect(archivedCompletionMigration).toContain("AND gp.place_id = _place_id;");
    expect(archivedCompletionMigration).not.toContain("gp.collection_status = 'active'");
    expect(archivedCompletionMigration).toContain("Matstället finns inte i gruppen");
  });
});
