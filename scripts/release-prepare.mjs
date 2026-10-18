#!/usr/bin/env bun

// Portabel och medvetet icke-publicerande releaseförberedelse.
// Kör från en ren branch skapad från main. Ingen GitHub Actions-skrivning krävs.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const NOTE_START = "<!-- MATRUNDAN_RELEASE_NOTE_BEGIN -->";
const NOTE_END = "<!-- MATRUNDAN_RELEASE_NOTE_END -->";
const KINDS = ["Nytt", "Förbättrat", "Rättat"];

function fail(message) {
  throw new Error(message);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function parseOptions(argv) {
  const allowed = new Set(["--summary", "--version", "--date", "--kind", "--repo", "--write"]);
  const result = { write: false, kind: "Förbättrat" };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!allowed.has(name)) fail("Okänt argument: " + name);
    if (name === "--write") {
      result.write = true;
      continue;
    }
    const value = argv[++index];
    if (!value || value.startsWith("--")) fail("Saknat värde för " + name);
    result[name.slice(2)] = value;
  }
  if (!result.summary || result.summary.trim().length < 8) {
    fail("Ange en svensk releasesammanfattning med --summary.");
  }
  if (!KINDS.includes(result.kind)) fail("--kind måste vara Nytt, Förbättrat eller Rättat.");
  if (result.date && !validDate(result.date)) fail("--date måste vara giltigt ÅÅÅÅ-MM-DD.");
  if (result.version && !/^\d+\.\d+\.\d+$/.test(result.version)) {
    fail("--version måste vara giltig semver utan suffix.");
  }
  if (result.repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(result.repo)) {
    fail("--repo måste vara owner/repo.");
  }
  return result;
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function nextPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) fail("Ogiltig befintlig appversion.");
  return match[1] + "." + match[2] + "." + (Number(match[3]) + 1);
}

export function newerThan(next, previous) {
  const parts = (value) => value.split(".").map(Number);
  const a = parts(next);
  const b = parts(previous);
  return a.some((n, index) => n > b[index] && a.slice(0, index).every((v, i) => v === b[i]));
}

export function mergesFromLog(log) {
  const lines = log.trim() ? log.trim().split("\n") : [];
  if (lines.length === 0) fail("Inga nya commits efter senaste publicerade versionen.");
  const numbers = new Set();
  return lines.map((line) => {
    const [sha, ...subjectParts] = line.split("\t");
    const subject = subjectParts.join("\t");
    const match = /^Merge (?:PR|pull request) #(\d+)\b/i.exec(subject) ||
      /\(#(\d+)\)\s*$/.exec(subject);
    if (!/^[0-9a-f]{40}$/.test(sha) || !match) {
      fail("Commit saknar identifierbar mergad PR: " + subject + ". Granska releasens scope manuellt.");
    }
    const number = Number(match[1]);
    if (numbers.has(number)) fail("Samma PR förekommer flera gånger: #" + number);
    numbers.add(number);
    return { sha, number };
  }).reverse();
}

export function notesFromPr(pr, merge) {
  if (!pr || pr.number !== merge.number || !pr.merged_at || pr.base?.ref !== "main" ||
      pr.merge_commit_sha !== merge.sha) {
    fail("PR #" + merge.number + " är inte verifierat mergad på förväntad commit/main.");
  }
  const body = pr.body || "";
  const start = body.indexOf(NOTE_START);
  const end = body.indexOf(NOTE_END);
  if (start < 0 || end <= start) {
    if (/Version:\s*inte relevant/i.test(body)) return [];
    fail("PR #" + merge.number + " saknar releaseunderlag.");
  }
  const raw = body.slice(start + NOTE_START.length, end)
    .replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!raw) {
    if (/Version:\s*inte relevant/i.test(body)) return [];
    fail("PR #" + merge.number + " har tomt releaseunderlag.");
  }
  const notes = raw.split("\n").map((line) => {
    const match = /^\s*-\s+(.+?)\s*$/.exec(line);
    if (!match || !match[1]) fail("PR #" + merge.number + " har ogiltig releasepunkt.");
    return match[1];
  });
  return notes;
}

export function materializeRelease(source, markdown, next, date, summary, kind, notes) {
  if (!KINDS.includes(kind) || !validDate(date) || !/^\d+\.\d+\.\d+$/.test(next)) {
    fail("Ogiltiga releaseuppgifter.");
  }
  if (notes.length === 0 || notes.some((note) => !note || typeof note !== "string")) {
    fail("Releasen saknar användarsynliga releasepunkter.");
  }
  const current = /version:\s*"(\d+\.\d+\.\d+)"/.exec(source)?.[1];
  const oldDate = /date:\s*"(\d{4}-\d{2}-\d{2})"/.exec(source)?.[1];
  if (!current || !oldDate || !newerThan(next, current) || date < oldDate) {
    fail("Ny version/datum måste ligga efter aktuell versionshistorik.");
  }
  if (source.includes('version: "' + next + '"') ||
      markdown.includes("## [" + next + "]")) {
    fail("Den föreslagna versionen finns redan.");
  }
  const constant = "VERSION_" + next.replaceAll(".", "_") + "_CHANGELOG";
  const itemLines = notes.map((item) => "        " + JSON.stringify(item) + ",").join("\n");
  const newEntry =
    "const " + constant + ": ChangelogEntry = {\n" +
    '  version: "' + next + '",\n' +
    '  date: "' + date + '",\n' +
    "  summary: " + JSON.stringify(summary.trim()) + ",\n" +
    "  sections: [\n    {\n" +
    "      kind: " + JSON.stringify(kind) + ",\n" +
    "      items: [\n" + itemLines + "\n      ],\n" +
    "    },\n  ],\n};\n\n";
  const anchor = "export type { ChangelogEntry };\n\n";
  const arrayAnchor = "export const CHANGELOG: ChangelogEntry[] = [\n";
  if (source.indexOf(anchor) < 0 || source.indexOf(arrayAnchor) < 0 ||
      markdown.indexOf("## [Unreleased]") < 0) {
    fail("Versionsfilernas förväntade struktur har ändrats. Uppdatera verktyget först.");
  }
  const version = source.replace(anchor, anchor + newEntry)
    .replace(arrayAnchor, arrayAnchor + "  " + constant + ",\n");
  const section = "## [" + next + "] – " + date + "\n\n### " + kind + "\n\n" +
    notes.map((item) => "- " + item).join("\n") + "\n\n";
  const first = markdown.match(/^## \[\d+\.\d+\.\d+\]/m);
  if (!first) fail("CHANGELOG saknar historiska versionsposter.");
  const changelog = markdown.slice(0, first.index) + section + markdown.slice(first.index);
  return { version, changelog };
}

async function githubPr(repo, number) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const url = "https://api.github.com/repos/" + repo + "/pulls/" + number;
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: "Bearer " + token } : {}),
  };
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!response.ok) fail("Kunde inte läsa PR #" + number + " (HTTP " + response.status + ").");
  return response.json();
}

async function run() {
  const opts = parseOptions(process.argv.slice(2));
  if (git("status", "--porcelain")) fail("Arbetskatalogen måste vara ren före releaseförberedelse.");
  if (opts.write && git("symbolic-ref", "--quiet", "--short", "HEAD") === "main") {
    fail("Skriv inte releasefiler direkt på main. Skapa en separat releasebranch.");
  }
  const versionPath = "src/lib/matrundan/version.ts";
  const changelogPath = "CHANGELOG.md";
  const source = readFileSync(versionPath, "utf8");
  const markdown = readFileSync(changelogPath, "utf8");
  const current = /version:\s*"(\d+\.\d+\.\d+)"/.exec(source)?.[1];
  if (!current) fail("Kunde inte identifiera befintlig appversion.");

  const tag = "v" + current;
  if (git("tag", "--list", tag) !== tag) {
    fail("Nuvarande version " + current + " är inte publiceringstaggad. Utred pågående releasekandidat.");
  }
  if (spawnSync("git", ["merge-base", "--is-ancestor", tag, "HEAD"]).status !== 0) {
    fail(tag + " är inte förfader till HEAD.");
  }
  const mergeLog = git("log", "--first-parent", "--format=%H%x09%s", tag + "..HEAD");
  const merges = mergesFromLog(mergeLog);
  const repo = opts.repo || process.env.GITHUB_REPOSITORY ||
    git("config", "--get", "remote.origin.url")
      .replace(/^.*(?:github\.com[:/])/, "").replace(/\.git$/, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    fail("Kunde inte identifiera GitHub-repo. Ange --repo owner/repo.");
  }

  const releases = [];
  for (const merge of merges) {
    const pr = await githubPr(repo, merge.number);
    releases.push({ number: merge.number, notes: notesFromPr(pr, merge) });
  }
  const notes = releases.flatMap((r) => r.notes);
  const next = opts.version || nextPatch(current);
  if (git("tag", "--list", "v" + next) === "v" + next) {
    fail("Version v" + next + " är redan publicerad.");
  }
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const files = materializeRelease(source, markdown, next, date, opts.summary, opts.kind, notes);
  console.log("Release " + current + " → " + next + " (" + date + ")");
  console.log("Mergade PR:er: " + releases.map((r) => "#" + r.number).join(", "));
  console.log("Releasepunkter: " + notes.length + ", kategori: " + opts.kind);
  if (!opts.write) {
    console.log("DRY RUN – inga filer ändrade. Kör med --write för att materialisera på releasebranchen.");
    return;
  }
  writeFileSync(versionPath, files.version);
  writeFileSync(changelogPath, files.changelog);
  const verify = spawnSync("bun", ["scripts/release-check.mjs"], { stdio: "inherit" });
  if (verify.status !== 0) {
    writeFileSync(versionPath, source);
    writeFileSync(changelogPath, markdown);
    fail("Releasekontrollen misslyckades. Ursprungliga filer återställda.");
  }
  console.log("Releasefiler skrivna och releasekontrakt kontrollerat. Skapa separat PR.");
}

if (import.meta.main) {
  run().catch((error) => {
    console.error("Releaseförberedelse stoppad: " + error.message);
    process.exitCode = 1;
  });
}
