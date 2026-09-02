import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const FORMAT = "matrundan-backup-v1";
const ROOT_PREFIX = `${FORMAT}/generations/`;
const MANIFEST_FILE = "backup-manifest.json";
const DEFAULT_RPO_HOURS = 24;
const STALE_PARTIAL_HOURS = 48;

function fail(message) {
  throw new Error(message);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Miljövariabeln ${name} krävs.`);
  return value;
}

function config() {
  const bucket = requiredEnv("MATRUNDAN_BACKUP_R2_BUCKET");
  const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  requiredEnv("AWS_ACCESS_KEY_ID");
  requiredEnv("AWS_SECRET_ACCESS_KEY");
  return {
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    expectedSourceRef: process.env.MATRUNDAN_BACKUP_EXPECTED_SOURCE_REF?.trim() || null,
  };
}

function aws(args, { capture = false } = {}) {
  const { endpoint } = config();
  const result = spawnSync("aws", [...args, "--endpoint-url", endpoint], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: {
      ...process.env,
      AWS_REGION: "auto",
      AWS_DEFAULT_REGION: "auto",
      AWS_EC2_METADATA_DISABLED: "true",
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`Kunde inte starta AWS CLI: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = capture ? result.stderr.trim() : "";
    fail(`AWS CLI misslyckades${detail ? `: ${detail}` : "."}`);
  }
  return capture ? result.stdout : "";
}

function normalizeRelative(value) {
  if (
    typeof value !== "string" ||
    !value ||
    path.posix.isAbsolute(value) ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    fail("Backupmanifestet innehåller en ogiltig filsökväg.");
  }
  return value;
}

async function readManifest(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, MANIFEST_FILE), "utf8"));
  if (manifest.format !== FORMAT || !Array.isArray(manifest.files) || !manifest.created_at) {
    fail("Okänt eller ofullständigt backupmanifest.");
  }
  const createdAt = new Date(manifest.created_at);
  if (Number.isNaN(createdAt.getTime())) fail("Backupmanifestet har ogiltig created_at.");
  if (!/^[0-9a-f]{40}$/.test(manifest.release_sha ?? "")) {
    fail("Backupmanifestet saknar giltig release_sha.");
  }
  for (const entry of manifest.files) normalizeRelative(entry.path);
  const { expectedSourceRef } = config();
  if (expectedSourceRef && manifest.source_project_ref !== expectedSourceRef) {
    fail("Backupmanifestets source_project_ref matchar inte den låsta produktionskällan.");
  }
  return manifest;
}

function generationId(manifest) {
  return new Date(manifest.created_at).toISOString();
}

function generationPrefix(id) {
  const parsed = new Date(id);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== id) {
    fail("Ogiltigt backup-generation-id.");
  }
  return `${ROOT_PREFIX}${id}/`;
}

async function collectLocalFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const fullPath = path.join(current, entry.name);
    const info = await lstat(fullPath);
    if (info.isSymbolicLink()) fail("Off-site-backup får inte innehålla symlänkar.");
    if (info.isDirectory()) {
      files.push(...(await collectLocalFiles(root, fullPath)));
    } else if (info.isFile()) {
      files.push(path.relative(root, fullPath).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

function remoteUri(bucket, key) {
  return `s3://${bucket}/${key}`;
}

function listObjects() {
  const { bucket } = config();
  const output = aws(
    [
      "s3api",
      "list-objects-v2",
      "--bucket",
      bucket,
      "--prefix",
      ROOT_PREFIX,
      "--output",
      "json",
      "--no-cli-pager",
    ],
    { capture: true },
  );
  const parsed = JSON.parse(output || "{}");
  return Array.isArray(parsed.Contents) ? parsed.Contents : [];
}

function parseGenerationFromKey(key) {
  if (typeof key !== "string" || !key.startsWith(ROOT_PREFIX)) return null;
  const remainder = key.slice(ROOT_PREFIX.length);
  const slash = remainder.indexOf("/");
  if (slash <= 0) return null;
  const id = remainder.slice(0, slash);
  const date = new Date(id);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== id) return null;
  return { id, keyWithinGeneration: remainder.slice(slash + 1) };
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function selectRetentionIds(generations, dailyCount = 7, weeklyCount = 4) {
  const sorted = [...generations].sort((a, b) => b.createdAt - a.createdAt);
  const keep = new Set(sorted.slice(0, dailyCount).map((item) => item.id));
  const weeklySeen = new Set(sorted.slice(0, dailyCount).map((item) => isoWeekKey(item.createdAt)));
  let weeklyAdded = 0;

  for (const item of sorted.slice(dailyCount)) {
    const week = isoWeekKey(item.createdAt);
    if (weeklySeen.has(week)) continue;
    keep.add(item.id);
    weeklySeen.add(week);
    weeklyAdded += 1;
    if (weeklyAdded >= weeklyCount) break;
  }
  return keep;
}

function completeGenerationsFromObjects(objects) {
  const manifests = objects
    .map((object) => ({ object, parsed: parseGenerationFromKey(object.Key) }))
    .filter(({ parsed }) => parsed?.keyWithinGeneration === MANIFEST_FILE);
  return manifests.map(({ parsed }) => ({ id: parsed.id, createdAt: new Date(parsed.id) }));
}

async function upload(directory) {
  const root = path.resolve(directory);
  const manifest = await readManifest(root);
  const id = generationId(manifest);
  const prefix = generationPrefix(id);
  const { bucket } = config();
  const manifestKey = `${prefix}${MANIFEST_FILE}`;

  const existing = JSON.parse(
    aws(
      [
        "s3api",
        "list-objects-v2",
        "--bucket",
        bucket,
        "--prefix",
        manifestKey,
        "--max-items",
        "1",
        "--output",
        "json",
        "--no-cli-pager",
      ],
      { capture: true },
    ) || "{}",
  );
  if ((existing.Contents ?? []).some((item) => item.Key === manifestKey)) {
    fail("Backupgenerationen finns redan off-site; en generation får aldrig skrivas över.");
  }

  const localFiles = await collectLocalFiles(root);
  const expected = [...manifest.files.map((entry) => normalizeRelative(entry.path)), MANIFEST_FILE].sort();
  if (JSON.stringify(localFiles) !== JSON.stringify(expected)) {
    fail("Lokal backup matchar inte manifestets filuppsättning före off-site-upload.");
  }

  for (const relative of localFiles.filter((file) => file !== MANIFEST_FILE)) {
    aws([
      "s3",
      "cp",
      path.join(root, ...relative.split("/")),
      remoteUri(bucket, `${prefix}${relative}`),
      "--only-show-errors",
      "--no-progress",
    ]);
  }

  // Manifestet laddas upp sist och fungerar som generationens commit-markör.
  aws([
    "s3",
    "cp",
    path.join(root, MANIFEST_FILE),
    remoteUri(bucket, manifestKey),
    "--only-show-errors",
    "--no-progress",
    "--content-type",
    "application/json",
  ]);

  console.log(id);
}

async function downloadGeneration(id, targetDirectory) {
  const prefix = generationPrefix(id);
  const { bucket } = config();
  const target = path.resolve(targetDirectory);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true, mode: 0o700 });

  const manifestPath = path.join(target, MANIFEST_FILE);
  aws(["s3", "cp", remoteUri(bucket, `${prefix}${MANIFEST_FILE}`), manifestPath, "--only-show-errors", "--no-progress"]);
  const manifest = await readManifest(target);
  if (generationId(manifest) !== id) fail("Off-site-manifestets created_at matchar inte generationens nyckel.");

  for (const entry of manifest.files) {
    const relative = normalizeRelative(entry.path);
    const localPath = path.join(target, ...relative.split("/"));
    await mkdir(path.dirname(localPath), { recursive: true, mode: 0o700 });
    aws(["s3", "cp", remoteUri(bucket, `${prefix}${relative}`), localPath, "--only-show-errors", "--no-progress"]);
  }

  const verify = spawnSync("bun", ["scripts/backup-manifest.mjs", "verify", target], {
    stdio: "inherit",
    env: process.env,
  });
  if (verify.error || verify.status !== 0) fail("Nedladdad off-site-generation klarade inte manifestverifieringen.");
  console.log(`Off-site-generation verifierad: ${id}`);
}

function deleteGeneration(id) {
  const { bucket } = config();
  aws(["s3", "rm", remoteUri(bucket, generationPrefix(id)), "--recursive", "--only-show-errors"]);
}

function applyRetention() {
  const objects = listObjects();
  const complete = completeGenerationsFromObjects(objects);
  if (complete.length === 0) fail("Ingen komplett off-site-backup hittades; retention avbryts.");

  const keep = selectRetentionIds(complete);
  const allIds = new Set(objects.map((object) => parseGenerationFromKey(object.Key)?.id).filter(Boolean));
  const completeIds = new Set(complete.map((item) => item.id));
  const newestComplete = Math.max(...complete.map((item) => item.createdAt.getTime()));
  const stalePartialBefore = Date.now() - STALE_PARTIAL_HOURS * 3600_000;
  let deleted = 0;

  for (const id of allIds) {
    if (completeIds.has(id)) {
      if (!keep.has(id)) {
        deleteGeneration(id);
        deleted += 1;
      }
      continue;
    }

    const generationObjects = objects.filter((object) => parseGenerationFromKey(object.Key)?.id === id);
    const newestObjectTime = Math.max(
      ...generationObjects.map((object) => new Date(object.LastModified ?? 0).getTime()).filter(Number.isFinite),
      0,
    );
    if (newestObjectTime > 0 && newestObjectTime < stalePartialBefore && new Date(id).getTime() < newestComplete) {
      deleteGeneration(id);
      deleted += 1;
    }
  }

  console.log(`Retention klar: ${keep.size} kompletta generationer behålls, ${deleted} generationer raderades.`);
}

function checkRpo(hours = DEFAULT_RPO_HOURS) {
  if (!(hours > 0)) fail("RPO måste vara ett positivt timvärde.");
  const complete = completeGenerationsFromObjects(listObjects());
  if (complete.length === 0) fail("Ingen komplett off-site-backup hittades.");
  const latest = complete.sort((a, b) => b.createdAt - a.createdAt)[0];
  const ageHours = (Date.now() - latest.createdAt.getTime()) / 3600_000;
  if (ageHours < 0) fail("Senaste backupgenerationen ligger i framtiden.");
  if (ageHours > hours) {
    fail(`Senaste kompletta off-site-backup är ${ageHours.toFixed(1)} timmar gammal och överskrider RPO ${hours}h.`);
  }
  console.log(`RPO OK: senaste kompletta off-site-backup är ${ageHours.toFixed(1)} timmar gammal (${latest.id}).`);
}

function selfTest() {
  const start = new Date("2026-09-02T02:17:00.000Z");
  const generations = Array.from({ length: 35 }, (_, index) => {
    const createdAt = new Date(start.getTime() - index * 86400_000);
    return { id: createdAt.toISOString(), createdAt };
  });
  const keep = selectRetentionIds(generations);
  assert.equal(keep.size, 11);
  for (const item of generations.slice(0, 7)) assert.ok(keep.has(item.id));
  const weekly = generations.slice(7).filter((item) => keep.has(item.id));
  assert.equal(new Set(weekly.map((item) => isoWeekKey(item.createdAt))).size, 4);
  assert.equal(weekly.length, 4);
  console.log("Off-site retention self-test OK.");
}

function usage() {
  console.error(
    "Användning: bun scripts/offsite-backup-r2.mjs <upload DIR|download GENERATION DIR|retention|check-rpo [HOURS]|self-test>",
  );
  process.exit(2);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "self-test" && args.length === 0) selfTest();
  else if (command === "upload" && args.length === 1) await upload(args[0]);
  else if (command === "download" && args.length === 2) await downloadGeneration(args[0], args[1]);
  else if (command === "retention" && args.length === 0) applyRetention();
  else if (command === "check-rpo" && args.length <= 1) checkRpo(args[0] ? Number(args[0]) : DEFAULT_RPO_HOURS);
  else usage();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
