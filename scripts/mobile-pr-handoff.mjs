#!/usr/bin/env node

import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const HANDOFF_MARKER = "<!-- matrundan-mobile-handoff -->";
const CLOUDFLARE_BOT = "cloudflare-workers-and-pages[bot]";
const ACTIONS_BOT = "github-actions[bot]";

export function isUiFile(filename = "") {
  return (
    filename.startsWith("src/components/") ||
    filename.startsWith("src/routes/") ||
    filename.startsWith("tests/e2e/") ||
    filename === "playwright.config.ts" ||
    (filename.startsWith("src/") && (filename.endsWith(".tsx") || filename.endsWith(".css")))
  );
}

export function extractCommitPreviewUrl(body = "") {
  return (
    body.match(
      /<a href=['"](https:\/\/[a-z0-9-]+-staging\.matrundan\.workers\.dev)['"]>Commit Preview URL<\/a>/i,
    )?.[1] ??
    body.match(
      /\[Commit Preview URL\]\((https:\/\/[a-z0-9-]+-staging\.matrundan\.workers\.dev)\)/i,
    )?.[1] ??
    null
  );
}

export function extractWorkersPreviewUrl(summary = "") {
  return (
    summary.match(
      /(?:^|\n)Preview URL:\s*(https:\/\/[a-z0-9-]+-staging\.matrundan\.workers\.dev)(?:\s|$)/i,
    )?.[1] ?? null
  );
}

function footer({ repository, prNumber, ciRunUrl }) {
  return (
    "\n\n---\nAutomatiskt kvitto för [PR #" +
    prNumber +
    "](https://github.com/" +
    repository +
    "/pull/" +
    prNumber +
    ") · [CI-körning](" +
    ciRunUrl +
    ")"
  );
}

export function buildReceipt({
  state,
  repository,
  prNumber,
  ciRunUrl,
  shortSha,
  previewUrl,
  failure,
}) {
  const receiptFooter = footer({ repository, prNumber, ciRunUrl });

  if (state === "non-ui") {
    return (
      HANDOFF_MARKER +
      "\n## ✅ Teknisk kandidat verifierad\n\n" +
      "| Kontroll | Status |\n| --- | --- |\n" +
      "| CI | ✅ Grön |\n" +
      "| Preview | ➖ Inte relevant – inga GUI-filer ändrades |\n\n" +
      "**Nästa steg:** följ PR:ns kvarvarande gransknings- och godkännandegrindar." +
      receiptFooter
    );
  }

  if (state === "pending") {
    return (
      HANDOFF_MARKER +
      "\n## ⏳ Preview väntar\n\n" +
      "| Kontroll | Status |\n| --- | --- |\n" +
      "| CI + mobil browser | ✅ Grön |\n" +
      "| Preview | ⏳ Exakt kandidat ännu inte verifierad |\n\n" +
      "**Blockerare:** " +
      failure +
      "\n\n**Nästa steg:** verifiera eller kör om kvittot innan kandidaten lämnas över för test." +
      receiptFooter
    );
  }

  if (state !== "ready" || !previewUrl || !shortSha) {
    throw new Error("Ett redo-kvitto kräver verifierad preview och short SHA.");
  }

  return (
    HANDOFF_MARKER +
    "\n## ✅ Redo att testa\n\n" +
    "[**Öppna verifierad preview →**](" +
    previewUrl +
    ")\n\n" +
    "| Kontroll | Status |\n| --- | --- |\n" +
    "| CI + mobil browser | ✅ Grön |\n" +
    "| Preview | ✅ Exakt kandidat `" +
    shortSha +
    "` |\n\n" +
    "**Testa främst:** den användarsynliga ändringen som beskrivs i PR:n.\n\n" +
    "**Nästa från dig:** testa previewn på mobilen och lämna feedback eller mergebesked." +
    receiptFooter
  );
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error("Saknad workflowmiljö: " + name + ".");
  return value;
}

export async function main() {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const targetSha = requiredEnvironment("TARGET_SHA");
  const ciRunUrl = requiredEnvironment("CI_RUN_URL");
  const githubToken = requiredEnvironment("GITHUB_API_TOKEN");
  const explicitPrNumber = Number(process.env.PR_NUMBER || "");
  const eventPath = process.env.GITHUB_EVENT_PATH || "";
  if (!/^[0-9a-f]{40}$/.test(targetSha)) throw new Error("Ogiltig kandidat-SHA.");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Ogiltigt repositorynamn.");
  }

  const shortSha = targetSha.slice(0, 8);
  const apiRoot = "https://api.github.com";
  const headers = {
    accept: "application/vnd.github+json",
    authorization: "Bearer " + githubToken,
    "x-github-api-version": "2022-11-28",
  };

  async function request(path, init = {}) {
    return fetch(apiRoot + path, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
  }

  async function getJson(path) {
    const response = await request(path);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error("GitHub API GET " + path + " misslyckades (HTTP " + response.status + ").");
    }
    return payload;
  }

  async function getAll(path) {
    const rows = [];
    for (let page = 1; page <= 30; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const payload = await getJson(path + separator + "per_page=100&page=" + page);
      if (!Array.isArray(payload)) {
        throw new Error("GitHub API skulle returnera en lista för " + path + ".");
      }
      rows.push(...payload);
      if (payload.length < 100) break;
    }
    return rows;
  }

  let prNumber =
    Number.isInteger(explicitPrNumber) && explicitPrNumber > 0
      ? explicitPrNumber
      : null;
  if (!Number.isInteger(prNumber) && eventPath) {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    prNumber =
      event.workflow_run?.pull_requests?.[0]?.number ??
      event.pull_request?.number ??
      null;
  }
  if (!Number.isInteger(prNumber)) {
    const candidates = await getAll("/repos/" + repository + "/commits/" + targetSha + "/pulls");
    prNumber = candidates.find(
      (candidate) =>
        candidate?.state === "open" &&
        candidate?.base?.ref === "main" &&
        candidate?.head?.sha === targetSha,
    )?.number;
  }
  if (!Number.isInteger(prNumber)) {
    console.log("Ingen öppen PR tillhör den färdiga CI-kandidaten; hoppar över kvitto.");
    return;
  }

  const pull = await getJson("/repos/" + repository + "/pulls/" + prNumber);
  if (
    pull?.state !== "open" ||
    pull?.draft === true ||
    pull?.base?.ref !== "main" ||
    pull?.head?.sha !== targetSha ||
    pull?.head?.repo?.full_name !== repository
  ) {
    console.log(
      "PR:n är inte längre exakt aktuell, öppen och same-repository; hoppar över kvitto.",
    );
    return;
  }

  const files = await getAll("/repos/" + repository + "/pulls/" + prNumber + "/files");
  const hasUi = files.some(({ filename }) => isUiFile(filename));

  async function comments() {
    return getAll("/repos/" + repository + "/issues/" + prNumber + "/comments");
  }

  async function workersCheckRuns() {
    const payload = await getJson(
      "/repos/" + repository + "/commits/" + targetSha + "/check-runs?per_page=100",
    );
    if (!Array.isArray(payload?.check_runs)) {
      throw new Error("GitHub API skulle returnera check-runs för kandidat-SHA.");
    }
    return payload.check_runs;
  }

  async function upsert(body, knownComments = null) {
    const existing = (knownComments ?? (await comments())).find(
      (comment) =>
        comment?.user?.login === ACTIONS_BOT &&
        typeof comment?.body === "string" &&
        comment.body.includes(HANDOFF_MARKER),
    );
    const path = existing
      ? "/repos/" + repository + "/issues/comments/" + existing.id
      : "/repos/" + repository + "/issues/" + prNumber + "/comments";
    const response = await request(path, {
      method: existing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const acceptedPermissions = response.headers.get("x-accepted-github-permissions");
      throw new Error(
        "Kunde inte uppdatera det mobila PR-kvittot (HTTP " +
          response.status +
          (acceptedPermissions ? ", kräver " + acceptedPermissions : "") +
          ")." +
          (detail ? " GitHub: " + detail.slice(0, 500) : ""),
      );
    }
  }

  const receiptContext = { repository, prNumber, ciRunUrl, shortSha };
  if (!hasUi) {
    await upsert(buildReceipt({ ...receiptContext, state: "non-ui" }));
    console.log("Skapade ett kanoniskt icke-GUI-kvitto för PR #" + prNumber + ".");
    return;
  }

  let previewUrl = null;
  let lastFailure = "Cloudflare har ännu inte rapporterat en exakt commit-preview.";
  let latestComments = [];
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    latestComments = await comments();
    const cloudflareComment = latestComments
      .filter(
        (comment) =>
          comment?.user?.login === CLOUDFLARE_BOT &&
          typeof comment?.body === "string" &&
          comment.body.includes(shortSha),
      )
      .sort((left, right) =>
        String(right?.updated_at ?? "").localeCompare(String(left?.updated_at ?? "")),
      )[0];
    previewUrl = extractCommitPreviewUrl(cloudflareComment?.body ?? "");

    if (!previewUrl) {
      const cloudflareCheck = (await workersCheckRuns())
        .filter(
          (check) =>
            check?.head_sha === targetSha &&
            check?.name === "Workers Builds: staging" &&
            check?.status === "completed" &&
            check?.conclusion === "success" &&
            check?.app?.slug === "cloudflare-workers-and-pages",
        )
        .sort((left, right) =>
          String(right?.completed_at ?? "").localeCompare(String(left?.completed_at ?? "")),
        )[0];
      previewUrl = extractWorkersPreviewUrl(cloudflareCheck?.output?.summary ?? "");
    }

    if (previewUrl) {
      try {
        const health = await fetch(previewUrl + "/api/health", {
          headers: { accept: "application/json", "cache-control": "no-cache" },
          signal: AbortSignal.timeout(10_000),
        });
        const payload = await health.json().catch(() => null);
        if (health.ok && payload?.status === "ok" && payload?.release === targetSha) {
          lastFailure = "";
          break;
        }
        lastFailure =
          "Preview-health matchade inte kandidaten: HTTP " +
          health.status +
          ", status=" +
          String(payload?.status) +
          ", release=" +
          String(payload?.release) +
          ".";
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
      }
    }

    previewUrl = null;
    if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 10_000));
  }

  if (!previewUrl) {
    await upsert(
      buildReceipt({ ...receiptContext, state: "pending", failure: lastFailure }),
      latestComments,
    );
    throw new Error(lastFailure);
  }

  await upsert(buildReceipt({ ...receiptContext, state: "ready", previewUrl }), latestComments);
  console.log("Visade exakt verifierad preview för PR #" + prNumber + ": " + previewUrl);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
