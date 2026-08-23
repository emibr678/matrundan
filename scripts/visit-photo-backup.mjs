import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "visit-photos";
const MEDIA_MANIFEST = path.join("media", "manifest.json");
const MEDIA_FIELDS =
  "id,visit_id,group_id,storage_path,mime_type,byte_size,width,height,uploaded_by,created_at,updated_at";

function usage() {
  console.error(
    "Användning: bun scripts/visit-photo-backup.mjs <export|restore> <backup-katalog>",
  );
  process.exit(2);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Miljövariabeln ${name} krävs.`);
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function storageFile(root, storagePath) {
  if (
    typeof storagePath !== "string" ||
    !storagePath ||
    path.isAbsolute(storagePath) ||
    storagePath.includes("\\") ||
    storagePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Ogiltig storage path i visit_media.");
  }
  return path.join(root, "media", "objects", ...storagePath.split("/"));
}

function client(urlName, keyName) {
  return createClient(requiredEnvironment(urlName), requiredEnvironment(keyName), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function fail(stage, error) {
  const message = error instanceof Error ? error.message : String(error ?? "okänt fel");
  throw new Error(`${stage} misslyckades: ${message}`);
}

function canonicalRow(row) {
  return {
    id: row.id,
    visit_id: row.visit_id,
    group_id: row.group_id,
    storage_path: row.storage_path,
    mime_type: row.mime_type,
    byte_size: Number(row.byte_size),
    width: Number(row.width),
    height: Number(row.height),
    uploaded_by: row.uploaded_by,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

async function exportMedia(root) {
  const source = client("SOURCE_SUPABASE_URL", "SOURCE_SUPABASE_SERVICE_ROLE_KEY");
  const mediaRoot = path.join(root, "media");
  const existing = await readdir(mediaRoot).catch(() => null);
  if (existing !== null) {
    throw new Error("Backupkatalogen innehåller redan media/. Avbryter utan att skriva över.");
  }

  const { data, error } = await source.from("visit_media").select(MEDIA_FIELDS).order("id");
  if (error) fail("Läsning av visit_media", error);
  const rows = data ?? [];
  if (rows.some((row) => row.mime_type !== "image/jpeg" || row.byte_size > 1_500_000)) {
    throw new Error("visit_media innehåller ett objekt som bryter mot lagringskontraktet.");
  }

  await mkdir(path.join(mediaRoot, "objects"), { recursive: true, mode: 0o700 });
  const entries = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const { data: blob, error: downloadError } = await source.storage
      .from(BUCKET)
      .download(row.storage_path);
    if (downloadError || !blob) fail(`Nedladdning av foto ${index + 1}`, downloadError);

    const bytes = Buffer.from(await blob.arrayBuffer());
    if (bytes.byteLength !== row.byte_size) {
      throw new Error(`Foto ${index + 1} har annan byte-storlek än visit_media.`);
    }

    const filePath = storageFile(root, row.storage_path);
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, bytes, { mode: 0o600 });
    entries.push({ ...canonicalRow(row), sha256: sha256(bytes) });
    console.log(`Foto ${index + 1}/${rows.length} exporterat och checksummat.`);
  }

  await writeFile(
    path.join(root, MEDIA_MANIFEST),
    `${JSON.stringify({ format: "matrundan-visit-media-v1", entries }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(`Privat mediaexport klar: ${rows.length} aktiva besöksfoton.`);
}

async function readMediaManifest(root) {
  const manifest = JSON.parse(await readFile(path.join(root, MEDIA_MANIFEST), "utf8"));
  if (manifest.format !== "matrundan-visit-media-v1" || !Array.isArray(manifest.entries)) {
    throw new Error("Okänt eller ofullständigt mediamanifest.");
  }
  return manifest;
}

async function verifyLocalEntries(root, entries) {
  for (const [index, entry] of entries.entries()) {
    const bytes = await readFile(storageFile(root, entry.storage_path));
    if (bytes.byteLength !== entry.byte_size || sha256(bytes) !== entry.sha256) {
      throw new Error(`Lokalt backupfoto ${index + 1} matchar inte mediamanifestet.`);
    }
  }
}

async function restoreMedia(root) {
  const target = client("TARGET_SUPABASE_URL", "TARGET_SUPABASE_SERVICE_ROLE_KEY");
  const { entries } = await readMediaManifest(root);
  await verifyLocalEntries(root, entries);

  const { data: targetRows, error: targetRowsError } = await target
    .from("visit_media")
    .select(MEDIA_FIELDS)
    .order("id");
  if (targetRowsError) fail("Läsning av målmiljöns visit_media", targetRowsError);

  const expectedRows = entries.map(canonicalRow);
  const actualRows = (targetRows ?? []).map(canonicalRow);
  if (JSON.stringify(actualRows) !== JSON.stringify(expectedRows)) {
    throw new Error(
      "Målmiljöns visit_media matchar inte backupen. Återställ databasen före Storage-bytes.",
    );
  }

  let alreadyCorrect = 0;
  let hydrated = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const localBytes = await readFile(storageFile(root, entry.storage_path));
    const { data: existingBlob, error: existingError } = await target.storage
      .from(BUCKET)
      .download(entry.storage_path);

    if (!existingError && existingBlob) {
      const existingBytes = Buffer.from(await existingBlob.arrayBuffer());
      if (existingBytes.byteLength === entry.byte_size && sha256(existingBytes) === entry.sha256) {
        alreadyCorrect += 1;
        continue;
      }
    }

    const { error: uploadError } = await target.storage
      .from(BUCKET)
      .upload(entry.storage_path, localBytes, {
        cacheControl: "3600",
        contentType: entry.mime_type,
        upsert: true,
      });
    if (uploadError) fail(`Återställning av foto ${index + 1}`, uploadError);

    const { data: verifiedBlob, error: verifyError } = await target.storage
      .from(BUCKET)
      .download(entry.storage_path);
    if (verifyError || !verifiedBlob) fail(`Verifiering av foto ${index + 1}`, verifyError);
    const verifiedBytes = Buffer.from(await verifiedBlob.arrayBuffer());
    if (verifiedBytes.byteLength !== entry.byte_size || sha256(verifiedBytes) !== entry.sha256) {
      throw new Error(`Återställt foto ${index + 1} matchar inte backupens bytes.`);
    }
    hydrated += 1;
  }

  console.log(
    `Mediarestore verifierad: ${entries.length} foton, ${hydrated} hydrerade och ${alreadyCorrect} redan korrekta.`,
  );
}

const [command, directory] = process.argv.slice(2);
if (!["export", "restore"].includes(command) || !directory) usage();
const root = path.resolve(directory);

if (command === "export") await exportMedia(root);
else await restoreMedia(root);
