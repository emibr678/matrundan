import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const agentOperationsWorkflow = ".github/workflows/agent-operations.yml";
const fastVerifyWorkflow = ".github/workflows/agent-fast-verify.yml";
const publicReadinessWorkflow = ".github/workflows/public-readiness.yml";
const stagingDbWorkflow = ".github/workflows/staging-db-apply.yml";

describe("Agent Operations workflow-kontrakt", () => {
  test("dispatchern är owner-only och har en smal allowlist", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), agentOperationsWorkflow),
      "utf8",
    );

    expect(workflow).toContain(
      "github.event.comment.author_association == 'OWNER'",
    );
    expect(workflow).toContain(
      "github.event.comment.user.login == github.repository_owner",
    );
    expect(workflow).toContain("!github.event.issue.pull_request");
    expect(workflow).toContain(
      "startsWith(github.event.comment.body, '/agent ')",
    );
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("agent-fast-verify.yml");
    expect(workflow).toContain("public-readiness.yml");
    expect(workflow).toContain("staging-db-apply.yml");
    expect(workflow).toContain("APPLY_STAGING_DB");
    expect(workflow).not.toContain("cloudflare-prod-preflight.yml/dispatches");
    expect(workflow).not.toContain("cloudflare-prod-publish.yml/dispatches");
    expect(workflow).not.toContain("recovery-offsite-restore.yml/dispatches");
  });

  test("fast verify binds till exakt branch/SHA och saknar write-permission", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), fastVerifyWorkflow),
      "utf8",
    );

    expect(workflow).toContain("ref: ${{ inputs.expected_sha }}");
    expect(workflow).toContain("branches/${encodeURIComponent(branch)}");
    expect(workflow).toContain("Branch advanced to");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("actions: write");
    expect(workflow).toContain("bun run verify:changed");
    expect(workflow).toContain(
      "bun run test:mobile:changed -- --only-changed=",
    );
    expect(workflow).toContain('bun run test:visual-smoke -- "$VISUAL_PATH"');
  });

  test("public readiness kan bindas till exakt aktuell main-SHA", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), publicReadinessWorkflow),
      "utf8",
    );

    expect(workflow).toContain("expected_sha:");
    expect(workflow).toContain("ref: ${{ inputs.expected_sha || github.sha }}");
    expect(workflow).toContain("branches/main");
    expect(workflow).toContain("refusing stale public-readiness run");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("actions: write");
  });

  test("stagingdatabas kräver exakt öppen PR-head och explicit bekräftelse", () => {
    const dispatcher = readFileSync(
      resolve(process.cwd(), agentOperationsWorkflow),
      "utf8",
    );
    const workflow = readFileSync(
      resolve(process.cwd(), stagingDbWorkflow),
      "utf8",
    );

    expect(dispatcher).toContain(
      "/agent staging-db <branch> <40-character-sha> <pr-number> APPLY_STAGING_DB",
    );
    expect(dispatcher).toContain("pullRequest?.state !== 'open'");
    expect(dispatcher).toContain("pullRequest?.head?.sha !== expectedSha");
    expect(workflow).toContain("CONFIRMATION: ${{ inputs.confirmation }}");
    expect(workflow).toContain('"APPLY_STAGING_DB"');
    expect(workflow).toContain("environment: staging");
    expect(workflow).not.toContain("environment: production");
  });
});
