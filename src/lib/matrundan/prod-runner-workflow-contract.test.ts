import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const productionWorkflows = [
  ".github/workflows/cloudflare-prod-preflight.yml",
  ".github/workflows/cloudflare-prod-publish.yml",
];

const legacyDispatcherWorkflows = [
  ".github/workflows/agent-prod-preflight-dispatch.yml",
  ".github/workflows/agent-prod-publish-dispatch.yml",
];

describe("productionflödets runner-kontrakt", () => {
  test.each(productionWorkflows)(
    "%s använder GitHub-hostad runner utan repository-override",
    (path) => {
      const workflow = readFileSync(resolve(process.cwd(), path), "utf8");

      expect(workflow).toContain("runs-on: ubuntu-24.04");
      expect(workflow).not.toContain("MATRUNDAN_PROD_PREFLIGHT_RUNNER");
      expect(workflow).not.toContain("MATRUNDAN_CI_RUNNER");
      expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
      expect(workflow).toContain("environment: production");
      expect(workflow).toContain("workflow_dispatch:");
    },
  );

  test("prod-preflight binder kandidaten till current main och preflight-runnen utan inklistrad SHA", () => {
    const workflow = readFileSync(resolve(process.cwd(), productionWorkflows[0]), "utf8");

    expect(workflow).toContain("expected_sha: ${{ github.sha }}");
    expect(workflow).not.toMatch(/expected_sha:\\s+[0-9a-f]{40}/);
    expect(workflow).toContain("default: true");
    expect(workflow).toContain("git rev-parse origin/main");
    expect(workflow).toContain('--tag "preflight-$GITHUB_RUN_ID"');
    expect(workflow).toContain("preflight=$GITHUB_RUN_ID");
    expect(workflow).toContain("Guard unreleased app version");
  });

  test("prod-publish löser senaste preflight för exakt SHA via repoets Actions-runs", () => {
    const workflow = readFileSync(resolve(process.cwd(), productionWorkflows[1]), "utf8");

    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("contents: write");
    expect(workflow).not.toContain("expected_sha:");
    expect(workflow).not.toContain("candidate_version_id:");
    expect(workflow).toContain("/actions/runs");
    expect(workflow).toContain("url.searchParams.set('head_sha', process.env.GITHUB_SHA)");
    expect(workflow).toContain("run?.path === preflightPath");
    expect(workflow).toContain(".github/workflows/cloudflare-prod-preflight.yml");
    expect(workflow).toContain("run.status !== 'completed' || run.conclusion !== 'success'");
    expect(workflow).toContain("preflight-${process.env.PREFLIGHT_RUN_ID}");
    expect(workflow).toContain("steps.candidate.outputs.already_active != 'true'");
    expect(workflow).toContain("refs/tags/${tagName}");
    expect(workflow).toContain("'/releases'");
    expect(workflow).toContain("make_latest: 'true'");
    expect(workflow).toContain("const releaseTitle = `Matrundan v${version} — ${releaseSummary}`;");
    expect(workflow).toContain("name: releaseTitle");
    expect(workflow).toContain("missing a usable release summary");
    expect(workflow).toContain("replace(/\\.$/u, '')");
  });

  test("legacy Issue-dispatchers ingår inte längre i produktionsvägen", () => {
    for (const path of legacyDispatcherWorkflows) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(false);
    }

    for (const path of productionWorkflows) {
      const workflow = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(workflow).not.toContain("github.event.issue.number == 207");
      expect(workflow).not.toContain("/prod-preflight");
      expect(workflow).not.toContain("/prod-publish");
    }
  });
});
