import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const readiness = readFileSync(
  resolve(root, ".github/workflows/staging-db-readiness.yml"),
  "utf8",
);
const stagingApply = readFileSync(
  resolve(root, ".github/workflows/staging-db-apply.yml"),
  "utf8",
);
const stagingDeploy = readFileSync(
  resolve(root, ".github/workflows/cloudflare-staging-deploy.yml"),
  "utf8",
);

describe("stagingdatabasens merge-readiness", () => {
  test("PR-checken är read-only och kräver append-only migrationshistorik", () => {
    expect(readiness).toContain("name: Staging DB readiness");
    expect(readiness).toContain("environment: staging");
    expect(readiness).toContain("git diff --name-status");
    expect(readiness).toContain("Existing migrations are append-only");
    expect(readiness).toContain("method: 'GET'");
    expect(readiness).not.toContain("method: 'POST'");
  });

  test("godkänd staging-apply triggar om readiness för exakt PR-head", () => {
    expect(stagingApply).toContain("actions: write");
    expect(stagingApply).toContain("run?.name === 'Staging DB readiness'");
    expect(stagingApply).toContain("/rerun-failed-jobs");
    expect(stagingApply).toContain("head_sha=");
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
