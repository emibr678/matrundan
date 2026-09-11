import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const visualWorkflowPath = ".github/workflows/visual-review.yml";
const ciWorkflowPath = ".github/workflows/ci.yml";
const playwrightConfigPath = "playwright.config.ts";

describe("PR-verifieringens feedbackkontrakt", () => {
  test("visual review använder GitHub-hostad runner utan self-hosted override", () => {
    const workflow = readFileSync(resolve(process.cwd(), visualWorkflowPath), "utf8");

    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).not.toContain("MATRUNDAN_CI_RUNNER");
    expect(workflow).toContain("- [x] Skapa visuella granskningsbilder");
    expect(workflow).toContain("cancel-in-progress: true");
  });

  test("redo-CI behåller hela mobilregressionen men kör två Playwright-workers", () => {
    const config = readFileSync(resolve(process.cwd(), playwrightConfigPath), "utf8");
    const workflow = readFileSync(resolve(process.cwd(), ciWorkflowPath), "utf8");

    expect(config).toContain("workers: process.env.CI ? 2 : undefined");
    expect(workflow).toContain("bun run test:mobile -- --max-failures=1 --retries=0");
    expect(workflow).toContain("Mobile Chromium tests discovered:");
  });
});
