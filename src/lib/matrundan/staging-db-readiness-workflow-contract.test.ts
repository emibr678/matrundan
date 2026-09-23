import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const stagingApply = readFileSync(resolve(root, ".github/workflows/staging-db-apply.yml"), "utf8");
const stagingDeploy = readFileSync(
  resolve(root, ".github/workflows/cloudflare-staging-deploy.yml"),
  "utf8",
);

describe("stagingdatabasens merge-readiness", () => {
  test("readiness är en read-only del av kandidat-DAG:en", () => {
    expect(ci).toContain("name: Staging DB readiness");
    expect(ci).toContain("environment: staging");
    expect(ci).toContain("git diff --name-status");
    expect(ci).toContain("Existing migrations are append-only");
    expect(ci).toContain("method: 'GET'");
    expect(ci).not.toContain("method: 'POST'");
  });

  test("godkänd staging-apply tillåts bara när readiness är enda CI-blockeraren", () => {
    expect(stagingApply).toContain("actions: write");
    expect(stagingApply).toContain("staging DB readiness is the only CI blocker");
    expect(stagingApply).toContain("Staging DB readiness");
    expect(stagingApply).toContain("allowedFailures");
    expect(stagingApply).toContain("/rerun-failed-jobs");
    expect(stagingApply).toContain("CI_RUN_ID");
  });

  test("post-merge stagingdeploy behåller migrationspärren", () => {
    expect(stagingDeploy).toContain(
      "Staging database is missing migration(s) required by current main:",
    );
    expect(stagingDeploy).toContain(
      "Apply database migrations only after separate explicit database-deployment approval",
    );
  });
});
