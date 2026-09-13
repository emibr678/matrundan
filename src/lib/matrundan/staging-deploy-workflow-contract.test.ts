import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = ".github/workflows/cloudflare-staging-deploy.yml";
const workflow = readFileSync(resolve(process.cwd(), workflowPath), "utf8");

describe("staging-deployens kontrakt", () => {
  test("deployar endast verifierad current main efter grön CI", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("workflows: [CI]");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("git rev-parse origin/main");
    expect(workflow).toContain("Skipping superseded staging candidate");
    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toContain("environment: staging");
  });

  test("kräver type drift endast när samma main-ändring är databasrelevant", () => {
    expect(workflow).toContain("Detect whether Supabase type drift is relevant");
    expect(workflow).toContain('git diff --name-only "$parent" "$TARGET_SHA"');
    expect(workflow).toContain("supabase/migrations/*");
    expect(workflow).toContain("supabase/config.toml");
    expect(workflow).toContain("src/integrations/supabase/types.ts");
    expect(workflow).toContain("scripts/supabase-types.sh");
    expect(workflow).toContain(".github/workflows/supabase-types.yml");
    expect(workflow).toContain("steps.db_scope.outputs.db_relevant == 'true'");
    expect(workflow).toContain("Supabase type drift");
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("not required for this merge (no database/type files changed)");
  });

  test("kör inline-node explicit som ESM med top-level await", () => {
    expect(workflow.match(/node --input-type=module/g)?.length).toBe(4);
    expect(workflow).not.toContain("node --input-type=commonjs");
    expect(workflow).not.toContain("require('node:fs')");
    expect(workflow).not.toContain("require('node:path')");
    expect(workflow).toContain("import fs from 'node:fs';");
    expect(workflow).toContain("import path from 'node:path';");
  });

  test("kräver kompatibel stagingdatabas utan DB-lösenord och utan att applicera migrationer", () => {
    expect(workflow).toContain("STAGING_SUPABASE_ACCESS_TOKEN");
    expect(workflow).not.toContain("STAGING_SUPABASE_DB_URL");
    expect(workflow).toContain("https://api.supabase.com/v1/projects/${projectId}/database/query");
    expect(workflow).toContain("select name from supabase_migrations.schema_migrations");
    expect(workflow).toContain("read_only: true");
    expect(workflow).toContain("stem.replaceAll('-', '_')");
    expect(workflow).toContain("suffix.replaceAll('-', '_')");
    expect(workflow).toContain(
      "Apply database migrations only after separate explicit database-deployment approval",
    );
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase migration up");
    expect(workflow).not.toContain("apply_migration");
    expect(workflow).not.toContain('psql "$STAGING_SUPABASE_DB_URL"');
  });

  test("bygger och deployar staging med exakt releaseidentitet", () => {
    expect(workflow).toContain("WORKERS_CI_COMMIT_SHA: ${{ env.TARGET_SHA }}");
    expect(workflow).toContain("MATRUNDAN_RELEASE_SHA: ${{ env.TARGET_SHA }}");
    expect(workflow).toContain("bun run cloudflare:build");
    expect(workflow).toContain('"wrangler@$WRANGLER_VERSION" deploy');
    expect(workflow).toContain("--env staging");
    expect(workflow).toContain("--keep-vars=true");
    expect(workflow).toContain("/api/health");
    expect(workflow).toContain("payload?.release === expectedRelease");
  });

  test("kan inte råka deploya production", () => {
    expect(workflow).not.toContain("environment: production");
    expect(workflow).not.toContain("--env prod");
    expect(workflow).not.toContain("app.matrundan.workers.dev");
    expect(workflow).toContain("Production Worker/database: untouched");
  });
});
