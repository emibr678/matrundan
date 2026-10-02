import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20261001210000_generated_profile_avatars_v1.sql"),
  "utf8",
);

describe("Issue #102 — genererade personliga avatarer", () => {
  test("lagrar ett uttryckligt avatarval och en slumpad seed", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS avatar_kind");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS avatar_seed");
    expect(migration).toContain("CHECK (avatar_kind IN ('account', 'generated', 'emoji'))");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_profile_v2");
  });

  test("genererad avatar blir ett lokalt versionsstyrt token och skickar ingen PII", () => {
    expect(migration).toContain("'multiavatar:v1:' || _seed");
    expect(migration).toContain("FROM auth.users");
    expect(migration).not.toContain("http://multiavatar");
    expect(migration).not.toContain("https://multiavatar");
  });

  test("konto- och legacyflödet förblir bakåtkompatibelt", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_profile(");
    expect(migration).toContain("WHEN 'account' THEN _account_avatar");
    expect(migration).toContain(
      "WHEN NULLIF(trim(COALESCE(_avatar_emoji, '')), '') IS NULL THEN 'account'",
    );
  });

  test("kontoradering scrubbar seed och genererad bildreferens", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.scrub_profile_avatar_on_delete()",
    );
    expect(migration).toContain("NEW.avatar_seed := NULL");
    expect(migration).toContain("NEW.avatar_url := NULL");
  });
});
