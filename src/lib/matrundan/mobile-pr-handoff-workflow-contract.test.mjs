import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildReceipt,
  extractCommitPreviewUrl,
  isUiFile,
} from "../../../scripts/mobile-pr-handoff.mjs";

const workflowPath = ".github/workflows/mobile-pr-handoff.yml";
const workflow = readFileSync(resolve(process.cwd(), workflowPath), "utf8");

describe("det mobila PR-kvittots workflow-kontrakt", () => {
  test("kör först efter grön ordinarie PR-CI med betrodd main-kod", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("workflows: [CI]");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).not.toContain("issues: write");
    expect(workflow).toContain("actions/checkout@v7");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).toContain("node scripts/mobile-pr-handoff.mjs");
  });

  test("binder kvittot till en exakt öppen same-repository-PR mot main", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/mobile-pr-handoff.mjs"), "utf8");

    expect(script).toContain('pull?.state !== "open"');
    expect(script).toContain("pull?.draft === true");
    expect(script).toContain('pull?.base?.ref !== "main"');
    expect(script).toContain("pull?.head?.sha !== targetSha");
    expect(script).toContain("pull?.head?.repo?.full_name !== repository");
  });

  test("kräver exakt Cloudflare commit-preview och release-health för GUI", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/mobile-pr-handoff.mjs"), "utf8");
    const commitUrl = "https://d050f4e7-staging.matrundan.workers.dev";
    const branchUrl = "https://feature-staging.matrundan.workers.dev";
    const comment = `<a href='${commitUrl}'>Commit Preview URL</a><a href='${branchUrl}'>Branch Preview URL</a>`;

    expect(extractCommitPreviewUrl(comment)).toBe(commitUrl);
    expect(extractCommitPreviewUrl(`[Commit Preview URL](${commitUrl})`)).toBe(commitUrl);
    expect(extractCommitPreviewUrl("https://attacker.example/preview")).toBeNull();
    expect(script).toContain('previewUrl + "/api/health"');
    expect(script).toContain('payload?.status === "ok"');
    expect(script).toContain("payload?.release === targetSha");
    expect(script).toContain("throw new Error(lastFailure)");
  });

  test("upsertar ett enda tydligt kvitto med explicit previewstatus", () => {
    const context = {
      repository: "emibr678/matrundan",
      prNumber: 123,
      ciRunUrl: "https://github.com/emibr678/matrundan/actions/runs/456",
      shortSha: "01234567",
    };
    const ready = buildReceipt({
      ...context,
      state: "ready",
      previewUrl: "https://preview-staging.matrundan.workers.dev",
    });
    const nonUi = buildReceipt({ ...context, state: "non-ui" });
    const pending = buildReceipt({ ...context, state: "pending", failure: "Inte klar." });

    expect(ready).toContain("<!-- matrundan-mobile-handoff -->");
    expect(ready).toContain("## ✅ Redo att testa");
    expect(ready).toContain("Öppna verifierad preview →");
    expect(nonUi).toContain("## ✅ Teknisk kandidat verifierad");
    expect(nonUi).toContain("Preview | ➖ Inte relevant – inga GUI-filer ändrades");
    expect(pending).toContain("## ⏳ Preview väntar");
    expect(pending).toContain("**Blockerare:** Inte klar.");
  });

  test("klassificerar GUI enligt repots CI-kontrakt", () => {
    expect(isUiFile("src/components/matrundan/Card.tsx")).toBeTrue();
    expect(isUiFile("src/routes/index.tsx")).toBeTrue();
    expect(isUiFile("tests/e2e/mobile.spec.ts")).toBeTrue();
    expect(isUiFile("playwright.config.ts")).toBeTrue();
    expect(isUiFile("src/styles.css")).toBeTrue();
    expect(isUiFile("docs/development-workflow.md")).toBeFalse();
  });
});
