import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const productionWorkflows = [
  ".github/workflows/cloudflare-prod-preflight.yml",
  ".github/workflows/cloudflare-prod-publish.yml",
];

const preflightDispatcherWorkflow = ".github/workflows/agent-prod-preflight-dispatch.yml";
const publishDispatcherWorkflow = ".github/workflows/agent-prod-publish-dispatch.yml";

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
    },
  );

  test("prod-preflight binder kandidaten till current main och preflight-runnen utan inklistrad SHA", () => {
    const workflow = readFileSync(resolve(process.cwd(), productionWorkflows[0]), "utf8");

    expect(workflow).not.toContain("expected_sha:");
    expect(workflow).toContain("default: true");
    expect(workflow).toContain("git rev-parse origin/main");
    expect(workflow).toContain('--tag "preflight-$GITHUB_RUN_ID"');
    expect(workflow).toContain("preflight=$GITHUB_RUN_ID");
    expect(workflow).toContain("Guard unreleased app version");
  });

  test("prod-publish löser exakt lyckad preflight själv och skapar release metadata", () => {
    const workflow = readFileSync(resolve(process.cwd(), productionWorkflows[1]), "utf8");

    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("contents: write");
    expect(workflow).not.toContain("expected_sha:");
    expect(workflow).not.toContain("candidate_version_id:");
    expect(workflow).toContain("cloudflare-prod-preflight.yml/runs");
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

  test("prod-preflight-dispatchern kräver bara exakt owner-kommando och löser main själv", () => {
    const workflow = readFileSync(resolve(process.cwd(), preflightDispatcherWorkflow), "utf8");

    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("github.event.issue.number == 207");
    expect(workflow).toContain("body !== '/prod-preflight'");
    expect(workflow).toContain("cloudflare-prod-preflight.yml/dispatches");
    expect(workflow).toContain("inputs: { upload_version: true }");
    expect(workflow).not.toContain("expected_sha");
    expect(workflow).not.toContain("MATRUNDAN_PROD_PREFLIGHT_RUNNER");
    expect(workflow).not.toContain("MATRUNDAN_CI_RUNNER");
  });

  test("prod-publish-dispatchern behåller separat explicit approval utan kandidatkopiering", () => {
    const workflow = readFileSync(resolve(process.cwd(), publishDispatcherWorkflow), "utf8");

    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("github.event.issue.number == 207");
    expect(workflow).toContain("github.event.comment.author_association == 'OWNER'");
    expect(workflow).toContain("github.event.comment.user.login == github.repository_owner");
    expect(workflow).toContain("body !== '/prod-publish PUBLISH_PROD'");
    expect(workflow).toContain("cloudflare-prod-publish.yml/dispatches");
    expect(workflow).toContain("inputs: { confirmation: 'PUBLISH_PROD' }");
    expect(workflow).not.toContain("candidate_version_id");
    expect(workflow).not.toContain("expected_sha");
    expect(workflow).not.toContain("MATRUNDAN_PROD_PREFLIGHT_RUNNER");
    expect(workflow).not.toContain("MATRUNDAN_CI_RUNNER");
  });
});
