import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const temporaryDirectories: string[] = [];
const releaseCheckPath = resolve(process.cwd(), "scripts/release-check.mjs");

function run(cwd: string, command: string, args: string[] = []) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

function runReleaseCheck(cwd: string, base: string, eventName?: string) {
  const env = { ...process.env };
  if (eventName) env.MATRUNDAN_CI_EVENT_NAME = eventName;
  return spawnSync(process.execPath, [releaseCheckPath, base], {
    cwd,
    encoding: "utf8",
    env,
  });
}

function writeFixtureFile(root: string, path: string, content: string) {
  const target = join(root, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  writeFileSync(target, content);
}

function createReleaseFixture() {
  const root = mkdtempSync(join(tmpdir(), "matrundan-release-check-"));
  temporaryDirectories.push(root);

  writeFixtureFile(
    root,
    "src/lib/matrundan/version.ts",
    `export const APP_VERSION = "1.0.0";
export const APP_VERSION_DATE = "2026-07-31";
export const CHANGELOG = [{
  version: APP_VERSION,
  date: APP_VERSION_DATE,
  summary: "Testrelease",
  sections: [],
}];
`,
  );
  writeFixtureFile(
    root,
    "CHANGELOG.md",
    `# Changelog

## [Unreleased]

Inga ändringar ännu.

## [1.0.0] – 2026-07-31
`,
  );
  writeFixtureFile(root, "docs/archive/changelog-v1.16-through-v1.26.1.md", "# Arkiv\n");
  writeFixtureFile(root, "docs/archive/changelog-v1.6.1-through-v1.15.md", "# Arkiv\n");
  writeFixtureFile(root, "docs/archive/changelog-through-v1.6.md", "# Arkiv\n");
  writeFixtureFile(
    root,
    "src/components/matrundan/TestView.tsx",
    "export function TestView() {}\n",
  );

  expect(run(root, "git", ["init"]).status).toBe(0);
  expect(run(root, "git", ["config", "user.email", "ci@example.invalid"]).status).toBe(0);
  expect(run(root, "git", ["config", "user.name", "Matrundan CI"]).status).toBe(0);
  expect(run(root, "git", ["add", "."]).status).toBe(0);
  expect(run(root, "git", ["commit", "-m", "baseline"]).status).toBe(0);
  const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
  return { root, base };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("releasekontrollens versionsskydd", () => {
  test("stoppar en UI-ändring som bara läggs under Unreleased", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(
      root,
      "src/components/matrundan/TestView.tsx",
      "export function TestView() { return <div>Ändrad vy</div>; }\n",
    );
    const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8").replace(
      "Inga ändringar ännu.",
      "- En synlig ändring utan daterad versionshöjning.",
    );
    writeFileSync(join(root, "CHANGELOG.md"), changelog);
    expect(run(root, "git", ["add", "."]).status).toBe(0);
    expect(run(root, "git", ["commit", "-m", "ui without version bump"]).status).toBe(0);

    const result = runReleaseCheck(root, base);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("utan versionshöjning i version.ts");

    const pushResult = runReleaseCheck(root, base, "push");

    expect(pushResult.status).toBe(1);
    expect(pushResult.stderr).toContain(
      "Version: inte relevant får endast användas för ändringar utan användarsynlig kod",
    );
  }, 15_000);

  test("godkänner verktygsändring efter merge till main", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(root, "docs/maintenance.md", "# Underhåll\n");
    expect(run(root, "git", ["add", "."]).status).toBe(0);
    expect(run(root, "git", ["commit", "-m", "maintenance only"]).status).toBe(0);

    const pullRequestResult = runReleaseCheck(root, base);
    expect(pullRequestResult.status).toBe(1);
    expect(pullRequestResult.stderr).toContain("Markera Version: inte relevant i PR:n");

    const pushResult = runReleaseCheck(root, base, "push");
    expect(pushResult.status).toBe(0);
  }, 15_000);
});
