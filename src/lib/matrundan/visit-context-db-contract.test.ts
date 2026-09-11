import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260911030000_visit_context_v1.sql"),
  "utf8",
);
const readModelPreflight = readFileSync(
  resolve(root, "supabase/production-preflight-read-model.sql"),
  "utf8",
);
const restoreScript = readFileSync(
  resolve(root, "scripts/restore-supabase-local.sh"),
  "utf8",
);

describe("Issue #197 — besökskontextens databaskontrakt", () => {
  test("lagrar Hämtmat separat och bevarar legacy-Kväll i schemat", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS is_takeaway boolean NOT NULL DEFAULT false",
    );
    expect(migration).toContain(
      "CHECK (meal_type IN ('frukost', 'lunch', 'fika', 'middag', 'dryck', 'kväll'))",
    );
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_visit_with_review_v4");
    expect(migration).toContain(
      "INSERT INTO public.visits (place_id, visited_on, meal_type, is_takeaway, created_by)",
    );
    expect(migration).toContain(
      "IF _meal_type NOT IN ('frukost', 'lunch', 'fika', 'middag', 'dryck') THEN",
    );
  });

  test("dubblettskydd skiljer På plats från Hämtmat", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.find_registration_visit_duplicate_v2",
    );
    expect(migration).toContain("v.is_takeaway = COALESCE(_is_takeaway, false)");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.find_share_visit_duplicate_v2",
    );
    expect(migration).toContain("candidate.is_takeaway = COALESCE(_is_takeaway, false)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.share_visit_to_group_v3");
  });

  test("aktuell read-model exponerar besökskontext med säker fallback", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5l");
    expect(migration).toContain("public.get_group_app_state_v5k(_group_id)");
    expect(migration).toContain("'{isTakeaway}'");
    expect(readModelPreflight).toContain("read_rpc_current:get_group_app_state_v5l");
    expect(readModelPreflight).toContain("read_rpc_fallback:get_group_app_state_v5k");
    expect(restoreScript).toContain("public.get_group_app_state_v5l(:'smoke_group_id'::uuid)");
  });
});
