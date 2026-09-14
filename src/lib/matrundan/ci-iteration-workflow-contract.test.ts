import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ciWorkflowPath = ".github/workflows/ci.yml";
const supabaseTypesWorkflowPath = ".github/workflows/supabase-types.yml";

describe("CI-iterationskontrakt", () => {
  test("Supabase type drift använder inte runner för draft-PR", () => {
    const workflow = readFileSync(resolve(process.cwd(), supabaseTypesWorkflowPath), "utf8");

    expect(workflow).toContain("github.event.pull_request.draft == false");
    expect(workflow).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(workflow).toContain("- ready_for_review");
  });

  test("CI startar separat artifact-cleanup bara efter en misslyckad kandidat", () => {
    const workflow = readFileSync(resolve(process.cwd(), ciWorkflowPath), "utf8");

    expect(workflow).toContain("needs.verify.result == 'failure'");
    expect(workflow).toContain("needs.browser.result == 'failure'");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("scope: 'ci'");
  });
});
