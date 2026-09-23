import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = ".github/workflows/cloudflare-staging-deploy.yml";
const workflow = readFileSync(resolve(process.cwd(), workflowPath), "utf8");

describe("staging-deployens kontrakt", () => {
  test("anropas direkt av samma CI-DAG och deployar endast current main", () => {
    expect(workflow).toContain("workflow_call:");
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).toContain("TARGET_SHA: ${{ inputs.expected_sha }}");
    expect(workflow).toContain("git rev-parse origin/main");
    expect(workflow).toContain("Skipping superseded staging candidate");
    expect(workflow).toContain("group: cloudflare-staging-deploy");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toContain("environment: staging");
  });

  test("polling av separat type-drift-workflow är borttagen", () => {
    expect(workflow).not.toContain("Detect whether Supabase type drift is relevant");
    expect(workflow).not.toContain("Require successful Supabase type drift for exact SHA");
    expect(workflow).not.toContain("/actions/runs?head_sha=");
    expect(workflow).not.toContain("actions: read");
    expect(workflow).toContain("Candidate gate: `CI / required`");
  });

  test("kräver kompatibel stagingdatabas utan att applicera migrationer", () => {
    expect(workflow).toContain("STAGING_SUPABASE_ACCESS_TOKEN");
    expect(workflow).not.toContain("STAGING_SUPABASE_DB_URL");
    expect(workflow).toContain(
      "https://api.supabase.com/v1/projects/${projectId}/database/migrations",
    );
    expect(workflow).toContain("method: 'GET'");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase migration up");
    expect(workflow).toContain(
      "Apply database migrations only after separate explicit database-deployment approval",
    );
  });

  test("bygger, deployar och health-verifierar exakt release-SHA", () => {
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
