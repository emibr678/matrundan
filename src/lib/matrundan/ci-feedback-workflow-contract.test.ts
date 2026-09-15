import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const visualWorkflowPath = ".github/workflows/visual-review.yml";
const ciWorkflowPath = ".github/workflows/ci.yml";
const playwrightConfigPath = "playwright.config.ts";
const visualPlaywrightConfigPath = "playwright.visual.config.ts";

describe("PR-verifieringens feedbackkontrakt", () => {
  test("visual review använder GitHub-hostad runner med portabel testmiljö", () => {
    const workflow = readFileSync(resolve(process.cwd(), visualWorkflowPath), "utf8");
    const config = readFileSync(resolve(process.cwd(), visualPlaywrightConfigPath), "utf8");

    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).not.toContain("MATRUNDAN_CI_RUNNER");
    expect(workflow).toContain("- [x] Skapa visuella granskningsbilder");
    expect(config).toContain("VITE_SUPABASE_URL: e2eSupabaseUrl");
    expect(config).toContain("VITE_SUPABASE_PUBLISHABLE_KEY: e2eSupabasePublishableKey");
  });

  test("visual review låser bara screenshot-jobbet mot samtidiga körningar", () => {
    const workflow = readFileSync(resolve(process.cwd(), visualWorkflowPath), "utf8");

    expect(workflow).not.toContain("\nconcurrency:\n");
    expect(workflow).toContain("\n    concurrency:\n");
    expect(workflow).toContain("group: visual-review-screenshots-v2-${{ github.ref }}");
    expect(workflow).toContain("cancel-in-progress: true");
  });

  test("redo-CI kör två Playwright-workers och samlar högst tre fel", () => {
    const config = readFileSync(resolve(process.cwd(), playwrightConfigPath), "utf8");
    const workflow = readFileSync(resolve(process.cwd(), ciWorkflowPath), "utf8");

    expect(config).toContain("workers: process.env.CI ? 2 : undefined");
    expect(workflow).toContain("bun run test:mobile -- --max-failures=3 --retries=0");
    expect(workflow).toContain("Mobile Chromium tests discovered:");
  });
});
