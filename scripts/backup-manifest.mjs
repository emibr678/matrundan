import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_FILE = "backup-manifest.json";
const REQUIRED_FILES = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "auth.sql",
  "auth-schema.json",
  "inventory.json",
];

function usage() {
  console.error("Användning: bun scripts/backup-manifest.mjs <create|verify> <backup-katalog>");
  process.exit(2);
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

async function collectFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const fullPath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Backupen får inte innehålla symlänkar: ${relativePath(root, fullPath)}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, fullPath)));
      continue;
    }
    if (entry.isFile() && relativePath(root, fullPath) !== MANIFEST_FILE) files.push(fullPath);
  }
  return files.sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function validateBackupShape(root, inventory) {
  for (const fileName of REQUIRED_FILES) {
    const filePath = path.join(root, fileName);
    const info = await lstat(filePath).catch(() => null);
    if (!info?.isFile()) throw new Error(`Backupen saknar ${fileName}.`);
  }

  const visitMediaCount = Number(inventory?.counts?.visit_media);
  if (!Number.isInteger(visitMediaCount) || visitMediaCount < 0) {
    throw new Error("inventory.json saknar ett giltigt counts.visit_media.");
  }

  const mediaManifestPath = path.join(root, "media", "manifest.json");
  const mediaInfo = await lstat(mediaManifestPath).catch(() => null);
  if (visitMediaCount > 0 && !mediaInfo?.isFile()) {
    throw new Error("Backupen innehåller visit_media men saknar media/manifest.json.");
  }
  if (mediaInfo?.isFile()) {
    const mediaManifest = await readJson(mediaManifestPath);
    if (!Array.isArray(mediaManifest.entries) || mediaManifest.entries.length !== visitMediaCount) {
      throw new Error("Antalet poster i media/manifest.json matchar inte inventory.json.");
    }
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Miljövariabeln ${name} krävs för att skapa manifestet.`);
  return value;
}

async function createManifest(root) {
  const inventory = await readJson(path.join(root, "inventory.json"));
  await validateBackupShape(root, inventory);

  const files = [];
  for (const filePath of await collectFiles(root)) {
    const info = await stat(filePath);
    files.push({
      path: relativePath(root, filePath),
      bytes: info.size,
      sha256: await hashFile(filePath),
    });
  }

  const rpoHours = Number(process.env.MATRUNDAN_BACKUP_RPO_HOURS ?? "24");
  const rtoHours = Number(process.env.MATRUNDAN_BACKUP_RTO_HOURS ?? "24");
  if (!(rpoHours > 0) || !(rtoHours > 0)) {
    throw new Error("RPO/RTO måste vara positiva timvärden.");
  }

  const manifest = {
    format: "matrundan-backup-v1",
    created_at: new Date().toISOString(),
    source_project_ref: requiredEnvironment("MATRUNDAN_BACKUP_SOURCE_REF"),
    app_version: requiredEnvironment("MATRUNDAN_BACKUP_APP_VERSION"),
    release_sha: requiredEnvironment("MATRUNDAN_BACKUP_RELEASE_SHA"),
    recovery: { rpo_hours: rpoHours, rto_hours: rtoHours },
    inventory,
    files,
  };

  await writeFile(path.join(root, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(`Backupmanifest skapat och ${files.length} filer checksummade.`);
}

function safeManifestPath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    path.isAbsolute(value) ||
    value.split("/").some((part) => part === ".." || part === "." || !part)
  ) {
    throw new Error("Backupmanifestet innehåller en ogiltig filsökväg.");
  }
  return value;
}

async function verifyManifest(root) {
  const manifest = await readJson(path.join(root, MANIFEST_FILE));
  if (manifest.format !== "matrundan-backup-v1" || !Array.isArray(manifest.files)) {
    throw new Error("Okänt eller ofullständigt backupmanifest.");
  }

  await validateBackupShape(root, manifest.inventory);

  const actualFiles = (await collectFiles(root)).map((filePath) => relativePath(root, filePath));
  const expectedFiles = manifest.files.map((file) => safeManifestPath(file.path)).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error("Backupens filuppsättning matchar inte manifestet.");
  }

  for (const entry of manifest.files) {
    const filePath = path.join(root, ...safeManifestPath(entry.path).split("/"));
    const info = await stat(filePath);
    if (info.size !== entry.bytes) throw new Error(`Fel filstorlek i backupen: ${entry.path}`);
    if ((await hashFile(filePath)) !== entry.sha256) {
      throw new Error(`Checksumma matchar inte: ${entry.path}`);
    }
  }

  console.log(`Backup verifierad: ${manifest.files.length} filer med giltiga SHA-256-checksummor.`);
}

const [command, directory] = process.argv.slice(2);
if (!["create", "verify"].includes(command) || !directory) usage();

const root = path.resolve(directory);
if (command === "create") await createManifest(root);
else await verifyManifest(root);
