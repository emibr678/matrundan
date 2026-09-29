import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260928211500_personal_journey_read_model_v1.sql"),
  "utf8",
);
const preflight = readFileSync(
  resolve(root, "supabase/production-preflight-personal-journey.sql"),
  "utf8",
);

describe("Min matresa-databaskontrakt", () => {
  test("binder läsningen till auth.uid och aktuella medlemskap", () => {
    expect(migration).toContain("_uid uuid := auth.uid()");
    expect(migration).toContain("membership.user_id = _uid");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).not.toContain("get_personal_journey_overview_v1(_user_id");
  });

  test("deduplicerar kanoniska ställen, besök och synliga omdömen", () => {
    expect(migration).toContain("GROUP BY group_place.place_id");
    expect(migration).toContain("SELECT DISTINCT visit.id, visit.place_id");
    expect(migration).toContain("SELECT DISTINCT\n      review.visit_id,\n      review.id");
  });

  test("bevarar gruppscopade favoriter utan global favoritmutation", () => {
    expect(migration).toContain("PRIMARY KEY (user_id, place_id, group_id)");
    expect(migration).toContain("'isFavorite', favorite.user_id IS NOT NULL");
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.toggle_personal_journey");
  });

  test("lämnar bara opak bildtoken över den personliga gränsen", () => {
    expect(migration).toContain("'photoDeliveryToken', photo_delivery_token");
    expect(migration).toContain("'deliveryToken', visibility.delivery_token");
    expect(migration).not.toContain("'storagePath'");
  });

  test("låser publika RPC:er till autentiserade användare", () => {
    expect(migration).toContain("FROM PUBLIC, anon;");
    expect(migration).toContain("TO authenticated, service_role;");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated;");
  });

  test("har riktad preflight för grants, signaturer och databasobjekt", () => {
    expect(preflight).toContain("get_personal_journey_overview_v1");
    expect(preflight).toContain("PRIMARY KEY (user_id, place_id, group_id)");
    expect(preflight).toContain("trg_visit_media_personal_journey_visibility");
    expect(preflight).toContain("authenticated");
  });
});
