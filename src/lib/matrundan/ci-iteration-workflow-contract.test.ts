import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");

describe("CI-iterationskontrakt", () => {
  test("draft-PR startar inga kandidatjobb", () => {
    expect(workflow).toContain("github.event.pull_request.draft == false");
    expect(workflow).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(workflow).toContain("- ready_for_review");
    expect(workflow).toContain("needs: classify");
  });

  test("redo-CI separerar oberoende kandidatkontroller och samlar dem i stabil slutgate", () => {
    expect(workflow).toContain("  quality:");
    expect(workflow).toContain("  unit:");
    expect(workflow).toContain("  typecheck:");
    expect(workflow).toContain("  build:");
    expect(workflow).toContain("  supabase_types:");
    expect(workflow).toContain("  staging_db_readiness:");
    expect(workflow).toContain("  required:");
    expect(workflow).toContain("    name: CI / required");
    expect(workflow).toContain("if: always() && needs.classify.result == 'success'");
  });

  test("main och PR-handoff ligger i samma CI-DAG utan workflow_run", () => {
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).toContain("uses: ./.github/workflows/mobile-pr-handoff.yml");
    expect(workflow).toContain("uses: ./.github/workflows/cloudflare-staging-deploy.yml");
    expect(workflow).toContain(
      "always() && github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.required.result == 'success'",
    );
    expect(workflow).toContain(
      "always() && github.event_name == 'pull_request' && needs.required.result == 'success'",
    );
  });

  test("artifact-cleanup kör bara efter en misslyckad kandidat", () => {
    expect(workflow).toContain("needs.quality.result == 'failure'");
    expect(workflow).toContain("needs.browser.result == 'failure'");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("scope: 'ci'");
  });
});
