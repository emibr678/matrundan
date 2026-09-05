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

  test("prod-preflight-dispatchern använder samma GitHub-hostade runner-kontrakt", () => {
    const workflow = readFileSync(resolve(process.cwd(), preflightDispatcherWorkflow), "utf8");

    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).not.toContain("MATRUNDAN_PROD_PREFLIGHT_RUNNER");
    expect(workflow).not.toContain("MATRUNDAN_CI_RUNNER");
    expect(workflow).toContain("startsWith(github.event.comment.body, '/prod-preflight ')");
    expect(workflow).toContain("cloudflare-prod-preflight.yml/dispatches");
  });

  test("prod-publish-dispatchern kräver exakt ägarkommando och använder GitHub-hostad runner", () => {
    const workflow = readFileSync(resolve(process.cwd(), publishDispatcherWorkflow), "utf8");

    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("github.event.issue.number == 207");
    expect(workflow).toContain("github.event.comment.author_association == 'OWNER'");
    expect(workflow).toContain("github.event.comment.user.login == github.repository_owner");
    expect(workflow).toContain("startsWith(github.event.comment.body, '/prod-publish ')");
    expect(workflow).toContain("cloudflare-prod-publish.yml/dispatches");
    expect(workflow).toContain("confirmation: 'PUBLISH_PROD'");
    expect(workflow).not.toContain("MATRUNDAN_PROD_PREFLIGHT_RUNNER");
    expect(workflow).not.toContain("MATRUNDAN_CI_RUNNER");
  });
});
