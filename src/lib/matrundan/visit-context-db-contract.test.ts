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
const restoreScript = readFileSync(resolve(root, "scripts/restore-supabase-local.sh"), "utf8");

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

  test("Något att dricka är genuint scorelöst men kan bära kommentar och reaktion", () => {
    expect(migration).toContain("ALTER COLUMN overall DROP NOT NULL");
    expect(migration).toContain("_scoreless boolean := _meal_type = 'dryck'");
    expect(migration).toContain("Något att dricka ska inte ha stjärnbetyg");
    expect(migration).toContain("CASE WHEN _scoreless THEN NULL ELSE _overall END");
    expect(migration).toContain("NOT _scoreless");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_own_review_for_visit_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_own_review");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_visit_review_reactions_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_own_review_reaction_v1");
    expect(migration).toContain("visibility.rating_visible = true OR visit.meal_type = 'dryck'");
  });

  test("dubblettskydd skiljer På plats från Hämtmat och neutraliserar Hämtmat för dryck", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.find_registration_visit_duplicate_v2",
    );
    expect(migration).toContain(
      "v.is_takeaway = CASE WHEN _meal_type = 'dryck' THEN false ELSE COALESCE(_is_takeaway, false) END",
    );
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.find_share_visit_duplicate_v2");
    expect(migration).toContain("candidate.is_takeaway = COALESCE(_is_takeaway, false)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.share_visit_to_group_v3");
    expect(migration).toContain("SET rating_visible = false");
  });

  test("aktuell read-model exponerar besökskontext och scorelösa kommentarer med säker fallback", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5l");
    expect(migration).toContain("public.get_group_app_state_v5k(_group_id)");
    expect(migration).toContain("'{isTakeaway}'");
    expect(migration).toContain("WHEN visit_row.meal_type = 'dryck'");
    expect(migration).toContain("'ratingVisible', false");
    expect(readModelPreflight).toContain("read_rpc_current:get_group_app_state_v5n");
    expect(readModelPreflight).toContain("read_rpc_fallback:get_group_app_state_v5m");
    expect(restoreScript).toContain("public.get_group_app_state_v5n(:'smoke_group_id'::uuid)");
  });
});
