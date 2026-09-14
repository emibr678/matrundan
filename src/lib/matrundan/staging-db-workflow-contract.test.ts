import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = ".github/workflows/staging-db-apply.yml";
const workflow = readFileSync(resolve(process.cwd(), workflowPath), "utf8");

describe("stagingdatabas-workflowets kontrakt", () => {
  test("kräver uttryckligt godkännande och en exakt öppen PR-head med grön CI", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirmation:");
    expect(workflow).toContain("CONFIRMATION: ${{ inputs.confirmation }}");
    expect(workflow).toContain('"APPLY_STAGING_DB"');
    expect(workflow).toContain("ref: ${{ inputs.expected_sha }}");
    expect(workflow).toContain("/branches/' + encodedBranch");
    expect(workflow).toContain("/pulls/' + prNumber");
    expect(workflow).toContain("pullRequest?.state !== 'open'");
    expect(workflow).toContain("pullRequest?.base?.ref !== 'main'");
    expect(workflow).toContain("pullRequest?.head?.sha !== targetSha");
    expect(workflow).toContain("run?.name === 'CI'");
    expect(workflow).toContain("run?.conclusion === 'success'");
  });

  test("använder endast den staging-scopeade migrationsvägen", () => {
    expect(workflow).toContain("environment: staging");
    expect(workflow).toContain("STAGING_SUPABASE_MIGRATIONS_TOKEN");
    expect(workflow).toContain(
      "STAGING_SUPABASE_PROJECT_ID: wpihfmwbubvdiaavtpia",
    );
    expect(workflow).toContain(
      "'https://api.supabase.com/v1/projects/' + projectId + '/database/migrations'",
    );
    expect(workflow).toContain("method: 'GET'");
    expect(workflow).toContain("method: 'POST'");
    expect(workflow).toContain("idempotency-key");
    expect(workflow).not.toContain("environment: production");
    expect(workflow).not.toContain("SUPABASE_PRODUCTION");
    expect(workflow).not.toContain("app.matrundan.workers.dev");
    expect(workflow).not.toContain("--env prod");
  });

  test("applicerar bara saknade migrationer och verifierar historiken efteråt", () => {
    expect(workflow).toContain(".filter((name) => name.endsWith('.sql'))");
    expect(workflow).toContain(".sort()");
    expect(workflow).toContain("stem.replaceAll('-', '_')");
    expect(workflow).toContain("suffix.replaceAll('-', '_')");
    expect(workflow).toContain("const missing = missingFrom(before, local)");
    expect(workflow).toContain("for (const migration of missing)");
    expect(workflow).toContain("const after = await listRemoteNames()");
    expect(workflow).toContain(
      "const stillMissing = missingFrom(after, local)",
    );
  });

  test("verifierar exakt Cloudflare-preview och lämnar ett mobilt PR-kvitto", () => {
    expect(workflow).toContain("cloudflare-workers-and-pages[bot]");
    expect(workflow).toContain("-staging\\.matrundan\\.workers\\.dev");
    expect(workflow).toContain("previewUrl + '/api/health'");
    expect(workflow).toContain("payload?.release === expectedRelease");
    expect(workflow).toContain("Surface verified staging preview on the PR");
    expect(workflow).toContain(
      "Productiondatabas och production-Worker: orörda",
    );
    expect(workflow).toContain("issues: write");
  });
});
