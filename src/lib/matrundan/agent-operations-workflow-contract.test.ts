import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const agentOperationsWorkflow = ".github/workflows/agent-operations.yml";
const fastVerifyWorkflow = ".github/workflows/agent-fast-verify.yml";
const publicReadinessWorkflow = ".github/workflows/public-readiness.yml";

describe("Agent Operations workflow-kontrakt", () => {
  test("dispatchern är owner-only och har en smal allowlist", () => {
    const workflow = readFileSync(resolve(process.cwd(), agentOperationsWorkflow), "utf8");

    expect(workflow).toContain("github.event.comment.author_association == 'OWNER'");
    expect(workflow).toContain("github.event.comment.user.login == github.repository_owner");
    expect(workflow).toContain("!github.event.issue.pull_request");
    expect(workflow).toContain("startsWith(github.event.comment.body, '/agent ')");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("agent-fast-verify.yml");
    expect(workflow).toContain("public-readiness.yml");
    expect(workflow).not.toContain("cloudflare-prod-preflight.yml/dispatches");
    expect(workflow).not.toContain("cloudflare-prod-publish.yml/dispatches");
    expect(workflow).not.toContain("recovery-offsite-restore.yml/dispatches");
  });

  test("fast verify binds till exakt branch/SHA och saknar write-permission", () => {
    const workflow = readFileSync(resolve(process.cwd(), fastVerifyWorkflow), "utf8");

    expect(workflow).toContain("ref: ${{ inputs.expected_sha }}");
    expect(workflow).toContain("branches/${encodeURIComponent(branch)}");
    expect(workflow).toContain("Branch advanced to");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("actions: write");
    expect(workflow).toContain("bun run verify:changed");
    expect(workflow).toContain("bun run test:mobile:changed -- --only-changed=");
    expect(workflow).toContain('bun run test:visual-smoke -- "$VISUAL_PATH"');
  });

  test("public readiness kan bindas till exakt aktuell main-SHA", () => {
    const workflow = readFileSync(resolve(process.cwd(), publicReadinessWorkflow), "utf8");

    expect(workflow).toContain("expected_sha:");
    expect(workflow).toContain("ref: ${{ inputs.expected_sha || github.sha }}");
    expect(workflow).toContain("branches/main");
    expect(workflow).toContain("refusing stale public-readiness run");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("actions: write");
  });
});
