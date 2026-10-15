import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const temporaryDirectories: string[] = [];
const releaseCheckPath = resolve(process.cwd(), "scripts/release-check.mjs");
const releaseNoteBody = `<!-- MATRUNDAN_RELEASE_NOTE_BEGIN -->
- En kort användarsynlig releasepunkt.
<!-- MATRUNDAN_RELEASE_NOTE_END -->`;

function run(cwd: string, command: string, args: string[] = []) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

function runReleaseCheck(
  cwd: string,
  base: string,
  options: {
    eventName?: string;
    prBody?: string;
    versionExempt?: boolean;
  } = {},
) {
  const env = { ...process.env };
  delete env.MATRUNDAN_CI_EVENT_NAME;
  delete env.MATRUNDAN_PR_BODY;
  delete env.MATRUNDAN_VERSION_EXEMPT;

  if (options.eventName) env.MATRUNDAN_CI_EVENT_NAME = options.eventName;
  if (options.prBody !== undefined) env.MATRUNDAN_PR_BODY = options.prBody;
  if (options.versionExempt !== undefined) {
    env.MATRUNDAN_VERSION_EXEMPT = options.versionExempt ? "1" : "0";
  }

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

function commitAll(root: string, message: string) {
  expect(run(root, "git", ["add", "."]).status).toBe(0);
  expect(run(root, "git", ["commit", "-m", message]).status).toBe(0);
}

// En materialiserad kandidat har samma struktur som appens riktiga releasehistorik.
function createUnpublishedCandidateFixture() {
  const { root } = createReleaseFixture();
  writeFixtureFile(
    root,
    "src/lib/matrundan/version.ts",
    `const VERSION_1_0_0_CHANGELOG = {
  version: "1.0.0",
  date: "2026-07-31",
  summary: "Aktuell kandidat",
  sections: [],
};
const VERSION_0_9_0_CHANGELOG = {
  version: "0.9.0",
  date: "2026-07-20",
  summary: "Historisk release",
  sections: [],
};
export const CHANGELOG = [VERSION_1_0_0_CHANGELOG, VERSION_0_9_0_CHANGELOG];
export const APP_VERSION = CHANGELOG[0].version;
export const APP_VERSION_DATE = CHANGELOG[0].date;
`,
  );
  writeFixtureFile(
    root,
    "CHANGELOG.md",
    `# Changelog

## [Unreleased]

Inga ändringar ännu.

## [1.0.0] – 2026-07-31

## [0.9.0] – 2026-07-20
`,
  );
  commitAll(root, "materialized candidate");
  const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
  return { root, base };
}

function editCandidate(root: string) {
  const sourcePath = join(root, "src/lib/matrundan/version.ts");
  const changelogPath = join(root, "CHANGELOG.md");
  writeFixtureFile(
    root,
    "src/lib/matrundan/version.ts",
    readFileSync(sourcePath, "utf8")
      .replace('date: "2026-07-31"', 'date: "2026-08-01"')
      .replace('summary: "Aktuell kandidat"', 'summary: "Kompletterad kandidat"'),
  );
  writeFixtureFile(
    root,
    "CHANGELOG.md",
    readFileSync(changelogPath, "utf8").replace(
      "## [1.0.0] – 2026-07-31",
      "## [1.0.0] – 2026-08-01\n\n- Ny releasepunkt.",
    ),
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("releasekontrollens staging-first-kontrakt", () => {
  test("tillåter komplettering av senaste otaggade kandidat utan versionshöjning", () => {
    const { root, base } = createUnpublishedCandidateFixture();
    editCandidate(root);
    commitAll(root, "complete untagged release notes");

    const result = runReleaseCheck(root, base, { eventName: "pull_request" });
    expect(result.status).toBe(0);
  }, 15_000);

  test("blockerar komplettering om kandidatversionen redan är taggad", () => {
    const { root, base } = createUnpublishedCandidateFixture();
    expect(run(root, "git", ["tag", "v1.0.0"]).status).toBe(0);
    editCandidate(root);
    commitAll(root, "attempt to rewrite tagged candidate");

    const result = runReleaseCheck(root, base, { eventName: "pull_request" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("redan taggad");
  }, 15_000);

  test("skyddar äldre versionshistorik även när aktuell kandidat är otaggad", () => {
    const { root, base } = createUnpublishedCandidateFixture();
    editCandidate(root);
    const path = join(root, "src/lib/matrundan/version.ts");
    writeFixtureFile(
      root,
      "src/lib/matrundan/version.ts",
      readFileSync(path, "utf8").replace("Historisk release", "Ändrad historisk release"),
    );
    commitAll(root, "attempt to rewrite older history");

    const result = runReleaseCheck(root, base, { eventName: "pull_request" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ändring av äldre historik");
  }, 15_000);

  test("samma kandidatversion får inte kombineras med ny användarsynlig kod", () => {
    const { root, base } = createUnpublishedCandidateFixture();
    editCandidate(root);
    writeFixtureFile(
      root,
      "src/components/matrundan/TestView.tsx",
      "export function TestView() { return <div>Ny funktion</div>; }\n",
    );
    commitAll(root, "attempt to bundle feature in same-version release");

    const result = runReleaseCheck(root, base, {
      eventName: "pull_request",
      prBody: releaseNoteBody,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("utan annan användarsynlig kod");
  }, 15_000);

  test("godkänner feature-PR med releaseunderlag utan versionshöjning", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(
      root,
      "src/components/matrundan/TestView.tsx",
      "export function TestView() { return <div>Ändrad vy</div>; }\n",
    );
    commitAll(root, "feature with release note");

    const pullRequestResult = runReleaseCheck(root, base, {
      eventName: "pull_request",
      prBody: releaseNoteBody,
    });
    expect(pullRequestResult.status).toBe(0);

    const pushResult = runReleaseCheck(root, base, { eventName: "push" });
    expect(pushResult.status).toBe(0);
  }, 15_000);

  test("stoppar feature-PR som saknar både releaseunderlag och versionshöjning", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(
      root,
      "src/components/matrundan/TestView.tsx",
      "export function TestView() { return <div>Ändrad vy</div>; }\n",
    );
    commitAll(root, "feature without release note");

    const pullRequestResult = runReleaseCheck(root, base, {
      eventName: "pull_request",
      prBody: "Ingen releasecopy här.",
    });

    expect(pullRequestResult.status).toBe(1);
    expect(pullRequestResult.stderr).toContain("kräver releaseunderlag i PR:n");

    const localResult = runReleaseCheck(root, base);
    expect(localResult.status).toBe(0);
  }, 15_000);

  test("räknar inte mallkommentar som releaseunderlag", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(
      root,
      "src/components/matrundan/TestView.tsx",
      "export function TestView() { return <div>Ändrad vy</div>; }\n",
    );
    commitAll(root, "feature with placeholder only");

    const result = runReleaseCheck(root, base, {
      eventName: "pull_request",
      prBody: `<!-- MATRUNDAN_RELEASE_NOTE_BEGIN -->
<!-- Skriv 1–3 korta punkter här. -->
<!-- MATRUNDAN_RELEASE_NOTE_END -->`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("kräver releaseunderlag i PR:n");
  }, 15_000);

  test("behåller stöd för redan versionerad feature-PR under övergången", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(
      root,
      "src/components/matrundan/TestView.tsx",
      "export function TestView() { return <div>Versionerad vy</div>; }\n",
    );
    writeFixtureFile(
      root,
      "src/lib/matrundan/version.ts",
      `export const APP_VERSION = "1.0.1";
export const APP_VERSION_DATE = "2026-08-01";
export const CHANGELOG = [
  {
    version: APP_VERSION,
    date: APP_VERSION_DATE,
    summary: "Versionerad ändring",
    sections: [],
  },
  {
    version: "1.0.0",
    date: "2026-07-31",
    summary: "Testrelease",
    sections: [],
  },
];
`,
    );
    writeFixtureFile(
      root,
      "CHANGELOG.md",
      `# Changelog

## [Unreleased]

Inga ändringar ännu.

## [1.0.1] – 2026-08-01

## [1.0.0] – 2026-07-31
`,
    );
    commitAll(root, "legacy versioned ui change");

    const pullRequestResult = runReleaseCheck(root, base, {
      eventName: "pull_request",
      prBody: "Äldre kandidat utan releaseunderlagsmarkörer.",
    });
    expect(pullRequestResult.status).toBe(0);

    const pushResult = runReleaseCheck(root, base, { eventName: "push" });
    expect(pushResult.status).toBe(0);
  }, 15_000);

  test("versionshöjning kräver fortfarande samtidig changelog", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(
      root,
      "src/lib/matrundan/version.ts",
      `export const APP_VERSION = "1.0.1";
export const APP_VERSION_DATE = "2026-08-01";
export const CHANGELOG = [
  {
    version: APP_VERSION,
    date: APP_VERSION_DATE,
    summary: "Releasekandidat",
    sections: [],
  },
  {
    version: "1.0.0",
    date: "2026-07-31",
    summary: "Testrelease",
    sections: [],
  },
];
`,
    );
    commitAll(root, "version without changelog");

    const result = runReleaseCheck(root, base, { eventName: "pull_request" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "versionshistorik kräver en samtidig uppdatering av CHANGELOG.md",
    );
  }, 15_000);

  test("kräver fortsatt Version inte relevant för maintenance-PR", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(root, "docs/maintenance.md", "# Underhåll\n");
    commitAll(root, "maintenance only");

    const missingDecision = runReleaseCheck(root, base, {
      eventName: "pull_request",
      versionExempt: false,
    });
    expect(missingDecision.status).toBe(1);
    expect(missingDecision.stderr).toContain("Markera Version: inte relevant i PR:n");

    const explicitDecision = runReleaseCheck(root, base, {
      eventName: "pull_request",
      versionExempt: true,
    });
    expect(explicitDecision.status).toBe(0);

    const pushResult = runReleaseCheck(root, base, { eventName: "push" });
    expect(pushResult.status).toBe(0);
  }, 15_000);

  test("Version inte relevant får inte användas för feature-PR", () => {
    const { root, base } = createReleaseFixture();
    writeFixtureFile(
      root,
      "src/components/matrundan/TestView.tsx",
      "export function TestView() { return <div>Ändrad vy</div>; }\n",
    );
    commitAll(root, "feature marked exempt");

    const result = runReleaseCheck(root, base, {
      eventName: "pull_request",
      prBody: releaseNoteBody,
      versionExempt: true,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Version: inte relevant får endast användas");
  }, 15_000);
});
