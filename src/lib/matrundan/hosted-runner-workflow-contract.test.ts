import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowDirectory = resolve(process.cwd(), ".github/workflows");
const workflowFiles = readdirSync(workflowDirectory)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

describe("GitHub Actions runner-kontrakt", () => {
  test.each(workflowFiles)("%s använder endast GitHub-hostad runner", (file) => {
    const workflow = readFileSync(resolve(workflowDirectory, file), "utf8");
    const runnerLines = workflow
      .split("\n")
      .filter((line) => line.trimStart().startsWith("runs-on:"));

    expect(runnerLines.length).toBeGreaterThan(0);
    for (const runnerLine of runnerLines) {
      expect(runnerLine.trim()).toBe("runs-on: ubuntu-24.04");
    }
    expect(workflow).not.toMatch(/MATRUNDAN_[A-Z_]*RUNNER/);
  });
});
