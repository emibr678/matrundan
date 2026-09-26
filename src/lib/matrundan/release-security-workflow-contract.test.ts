import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const publicReadinessWorkflow = ".github/workflows/public-readiness.yml";
const ciWorkflow = ".github/workflows/ci.yml";
const prodPreflightWorkflow = ".github/workflows/cloudflare-prod-preflight.yml";

describe("release-security gate", () => {
  test("Public readiness can be reused by production preflight for an exact main SHA", () => {
    const workflow = readFileSync(resolve(process.cwd(), publicReadinessWorkflow), "utf8");

    expect(workflow).toContain("workflow_call:");
    expect(workflow).toContain("Exact current main SHA for a calling release-security gate");
    expect(workflow).toContain("ref: ${{ inputs.expected_sha || github.sha }}");
    expect(workflow).toContain("Full-history secret scan");
    expect(workflow).toContain("GITHUB_TOKEN: ${{ github.token }}");
  });

  test("production credentials remain behind public-readiness and exact-main CI", () => {
    const workflow = readFileSync(resolve(process.cwd(), prodPreflightWorkflow), "utf8");
    const publicReadinessIndex = workflow.indexOf("Release security / public readiness");
    const exactCiIndex = workflow.indexOf("Release security / exact main CI");
    const environmentIndex = workflow.indexOf("environment: production");

    expect(publicReadinessIndex).toBeGreaterThan(-1);
    expect(exactCiIndex).toBeGreaterThan(publicReadinessIndex);
    expect(environmentIndex).toBeGreaterThan(exactCiIndex);
    expect(workflow).toContain("uses: ./.github/workflows/public-readiness.yml");
    expect(workflow).toContain("checks: read");
    expect(workflow).toContain("CI / required");
    expect(workflow).toContain("needs: main_ci");
    expect(workflow).toContain("Verify production artifact contains no server secrets");
    expect(workflow).toContain("cloudflare-secret-leak-check.mjs");
    expect(workflow).not.toContain("supabase db push");
  });

  test("dependency review is limited to dependency-changing pull requests and merge-critical when relevant", () => {
    const workflow = readFileSync(resolve(process.cwd(), ciWorkflow), "utf8");

    expect(workflow).toContain("has_dependencies: ${{ steps.changes.outputs.has_dependencies }}");
    expect(workflow).toContain(
      "if: github.event_name == 'pull_request' && needs.classify.outputs.has_dependencies == 'true'",
    );
    expect(workflow).toContain(
      "actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0",
    );
    expect(workflow).toContain("fail-on-severity: high");
    expect(workflow).toContain("- dependency_review");
    expect(workflow).toContain("DEPENDENCY_REVIEW_RESULT");
  });
});
