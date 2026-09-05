import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STAGING_PROJECT_ID = "wpihfmwbubvdiaavtpia";
const PROD_PROJECT_ID = "wsikirbxqejjwtgxcvjl";
const LEGACY_LOVABLE_CLOUD_PROJECT_ID = "bkyzxkfrenbbkgiymofk";

describe("repoets Supabase-projektkontrakt", () => {
  test("supabase/config.toml pekar på staging och aldrig prod eller gamla Lovable Cloud", () => {
    const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

    expect(config).toContain(`project_id = "${STAGING_PROJECT_ID}"`);
    expect(config).not.toContain(PROD_PROJECT_ID);
    expect(config).not.toContain(LEGACY_LOVABLE_CLOUD_PROJECT_ID);
  });
});
