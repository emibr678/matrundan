import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260916173000_group_description_v1.sql"),
  "utf8",
);

describe("Issue #318 — kort privat gruppbeskrivning", () => {
  test("lagrar en valfri beskrivning additivt med en hård längdgräns", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS description text");
    expect(migration).toContain("groups_description_length_check");
    expect(migration).toContain("char_length(description) <= 160");
  });

  test("gruppidentitet skrivs server-side av ägare eller admin", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_group_identity_v1");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path TO 'public'");
    expect(migration).toContain("public.group_is_active(_group_id)");
    expect(migration).toContain("ARRAY['owner','admin']");
    expect(migration).toContain("description = _normalized_description");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.update_group_identity_v1(uuid, text, text, text)",
    );
  });

  test("nya grupper kan få beskrivning utan att duplicera befintlig skapandelogik", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_group_with_owner_v3");
    expect(migration).toContain("public.create_group_with_owner_v2(");
    expect(migration).toContain("SET description = _normalized_description");
  });

  test("beskrivning och medlemsfallback exponeras bara i den medlemsscopade grupplistan", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.list_user_groups_v4b");
    expect(migration).toContain("'description', g.description");
    expect(migration).toContain("'memberPreviewNames'");
    expect(migration).toContain("'otherMemberCount'");
    expect(migration).toContain("candidate.group_id = g.id");
    expect(migration).toContain("candidate.status = 'active'");
    expect(migration).toContain("candidate.user_id <> auth.uid()");
    expect(migration).toContain("LIMIT 2");
    expect(migration).toContain("m.user_id = auth.uid()");
    expect(migration).toContain("m.status = 'active'");
    expect(migration).not.toContain("get_invitation_preview");
    expect(migration).not.toContain("share_visit");
  });
});
