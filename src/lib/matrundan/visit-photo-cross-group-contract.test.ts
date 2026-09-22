import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260922193000_visit_photo_cross_group_visibility_v1.sql"),
  "utf8",
);
const route = readFileSync(resolve(root, "src/routes/api/visit-photo.$deliveryToken.ts"), "utf8");
const server = readFileSync(
  resolve(root, "src/lib/matrundan/visit-photo-delivery.server.ts"),
  "utf8",
);
const repository = readFileSync(resolve(root, "src/lib/matrundan/live-repository.ts"), "utf8");

describe("Issue #179 cross-group-bilder", () => {
  test("synligheten följer kanoniskt media och målgruppens besökslänk", () => {
    expect(migration).toContain("public.visit_media_group_visibility");
    expect(migration).toContain("media.uploaded_by = _uid");
    expect(migration).toContain("public.visit_participants");
    expect(migration).toContain("REFERENCES public.visit_media(id, visit_id)");
    expect(migration).toContain("REFERENCES public.visit_group_links(visit_id, group_id)");
    expect(migration.match(/ON DELETE CASCADE/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("cross-group-read-model lämnar opaque delivery-token till klienten", () => {
    expect(migration).toContain("public.get_group_app_state_v5n");
    expect(migration).toContain("'deliveryToken', visibility.delivery_token");
    expect(migration).not.toContain("'sourceGroupId', media.group_id");
  });

  test("rå Storage-sökväg löses endast server-side efter verifierad bearer-session", () => {
    expect(route).toContain('createFileRoute("/api/visit-photo/$deliveryToken")');
    expect(route).toContain('import("@/lib/matrundan/visit-photo-delivery.server")');
    expect(server).toContain("supabaseAdmin.auth.getUser(token)");
    expect(server).toContain('"resolve_visit_photo_delivery_v1"');
    expect(server).toContain('"cache-control": "private, no-store"');
    expect(repository).toContain("createDeliveredVisitPhotoUrls");
  });
});
