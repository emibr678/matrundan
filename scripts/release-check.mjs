#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const base = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? null;
const changelogPath = resolve(root, "CHANGELOG.md");
const versionPath = resolve(root, "src/lib/matrundan/version.ts");
const errors = [];

function git(args, allowFailure = false) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.status === 0 ? result.stdout.trim() : "";
}

function parseSemver(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match ? match.slice(1).map(Number) : null;
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return Number.NaN;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function markdownReleases(markdown) {
  const entries = [];
  const pattern = /^## \[(\d+\.\d+\.\d+)\]\s+[–-]\s+(\d{4}-\d{2}-\d{2})$/gm;
  for (const match of markdown.matchAll(pattern)) {
    entries.push({ version: match[1], date: match[2] });
  }
  return entries;
}

function changedFiles(baseSha) {
  if (!baseSha) return [];
  const output = git(["diff", "--name-only", "--diff-filter=ACMR", baseSha, "HEAD"], true);
  return output ? output.split("\n").filter(Boolean) : [];
}

function isUserFacing(file) {
  if (/\.test\.[cm]?[jt]sx?$/.test(file)) return false;
  if (file === "src/lib/matrundan/version.ts") return false;
  return (
    file.startsWith("src/components/matrundan/") ||
    file.startsWith("src/routes/") ||
    file.startsWith("src/lib/matrundan/") ||
    file.startsWith("supabase/migrations/")
  );
}

function versionFromSource(source) {
  const legacy = /export const APP_VERSION = "(\d+\.\d+\.\d+)"/.exec(source)?.[1];
  if (legacy) return legacy;
  return /version:\s*"(\d+\.\d+\.\d+)"/.exec(source)?.[1] ?? null;
}

const { APP_VERSION, APP_VERSION_DATE, CHANGELOG } = await import(
  `${pathToFileURL(versionPath).href}?release-check=${Date.now()}`
);
const markdown = readFileSync(changelogPath, "utf8");
const markdownEntries = markdownReleases(markdown);

if (!markdown.includes("## [Unreleased]")) {
  errors.push("CHANGELOG.md måste innehålla sektionen [Unreleased].");
}
if (CHANGELOG.length === 0) {
  errors.push("Versionshistoriken får inte vara tom.");
}
if (CHANGELOG[0]?.version !== APP_VERSION || CHANGELOG[0]?.date !== APP_VERSION_DATE) {
  errors.push("APP_VERSION och APP_VERSION_DATE måste härledas från första versionsposten.");
}

const seen = new Set();
for (let index = 0; index < CHANGELOG.length; index += 1) {
  const entry = CHANGELOG[index];
  if (!parseSemver(entry.version)) {
    errors.push(`Ogiltig semver: ${entry.version}.`);
  }
  if (!validDate(entry.date)) {
    errors.push(`Ogiltigt datum för ${entry.version}: ${entry.date}.`);
  }
  if (seen.has(entry.version)) {
    errors.push(`Dubblerad version i apphistoriken: ${entry.version}.`);
  }
  seen.add(entry.version);

  const previous = CHANGELOG[index - 1];
  if (previous && compareSemver(previous.version, entry.version) <= 0) {
    errors.push(
      `Versionshistoriken är inte strikt fallande: ${previous.version}, ${entry.version}.`,
    );
  }
  if (previous && previous.date < entry.date) {
    errors.push(
      `Datumordningen är fel: ${entry.version} (${entry.date}) ligger efter ${previous.version}.`,
    );
  }
}

const latestMarkdown = markdownEntries[0];
if (!latestMarkdown) {
  errors.push("CHANGELOG.md saknar daterade releaseposter.");
} else if (latestMarkdown.version !== APP_VERSION || latestMarkdown.date !== APP_VERSION_DATE) {
  errors.push(
    `Senaste release i CHANGELOG.md (${latestMarkdown.version}, ${latestMarkdown.date}) ` +
      `matchar inte appen (${APP_VERSION}, ${APP_VERSION_DATE}).`,
  );
}

const markdownByVersion = new Map(markdownEntries.map((entry) => [entry.version, entry.date]));
for (const entry of CHANGELOG) {
  if (compareSemver(entry.version, "0.15.0") < 0) break;
  const markdownDate = markdownByVersion.get(entry.version);
  if (!markdownDate) {
    errors.push(`CHANGELOG.md saknar release ${entry.version}.`);
  } else if (markdownDate !== entry.date) {
    errors.push(
      `Datumet för ${entry.version} skiljer sig: appen ${entry.date}, CHANGELOG.md ${markdownDate}.`,
    );
  }
}

if (base) {
  const files = changedFiles(base);
  const changelogChanged = files.includes("CHANGELOG.md");
  const userFacingChanged = files.some(isUserFacing);
  const exempt = process.env.MATRUNDAN_CHANGELOG_EXEMPT === "1";

  if (userFacingChanged && !changelogChanged && !exempt) {
    errors.push(
      "Användarsynlig kod eller migration har ändrats utan CHANGELOG.md. " +
        "Uppdatera Unreleased eller markera det uttryckliga PR-undantaget.",
    );
  }

  const baseSource = git(["show", `${base}:src/lib/matrundan/version.ts`], true);
  const baseVersion = versionFromSource(baseSource);
  if (baseVersion && baseVersion !== APP_VERSION) {
    if (compareSemver(APP_VERSION, baseVersion) <= 0) {
      errors.push(`Ny appversion ${APP_VERSION} måste vara högre än ${baseVersion}.`);
    }
    if (!changelogChanged) {
      errors.push("En versionshöjning kräver en samtidig uppdatering av CHANGELOG.md.");
    }
  }
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Fel: ${error}`));
  process.exit(1);
}

console.log(`Releasekontroll godkänd: Matrundan ${APP_VERSION} · ${APP_VERSION_DATE}.`);
