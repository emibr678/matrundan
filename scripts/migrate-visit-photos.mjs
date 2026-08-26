import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "visit-photos";
const execute = process.argv.includes("--execute");

const required = [
  "SOURCE_SUPABASE_URL",
  "SOURCE_SUPABASE_SERVICE_ROLE_KEY",
  "TARGET_SUPABASE_URL",
  "TARGET_SUPABASE_SERVICE_ROLE_KEY",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Saknade migrationsvariabler: ${missing.join(", ")}`);
  process.exit(1);
}

const source = createClient(
  process.env.SOURCE_SUPABASE_URL,
  process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const target = createClient(
  process.env.TARGET_SUPABASE_URL,
  process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function fail(stage, error) {
  const message = error instanceof Error ? error.message : String(error ?? "okänt fel");
  throw new Error(`${stage} misslyckades: ${message}`);
}

async function sha256(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex");
}

const { data: sourceRows, error: sourceRowsError } = await source
  .from("visit_media")
  .select(
    "id,visit_id,group_id,storage_path,mime_type,byte_size,width,height,uploaded_by,created_at,updated_at",
  )
  .order("id");
if (sourceRowsError) fail("Läsning av källmetadata", sourceRowsError);

const rows = sourceRows ?? [];
const uniquePaths = new Set(rows.map((row) => row.storage_path));
if (uniquePaths.size !== rows.length) {
  throw new Error("Källan innehåller duplicerade aktiva storage paths.");
}
if (rows.some((row) => row.mime_type !== "image/jpeg" || row.byte_size > 1_500_000)) {
  throw new Error("Källan innehåller media som bryter mot visit-photos-kontraktet.");
}

const { data: targetRows, error: targetRowsError } = await target
  .from("visit_media")
  .select("id,storage_path")
  .order("id");
if (targetRowsError) fail("Läsning av målmetadata", targetRowsError);
if ((targetRows ?? []).length > 0) {
  throw new Error(
    "Målet innehåller redan visit_media. Avbryter för att undvika en destruktiv merge.",
  );
}

console.log(`Aktiva privata besöksfoton att migrera: ${rows.length}.`);
if (!execute) {
  console.log("Dry-run klar. Kör igen med --execute för att kopiera och verifiera filerna.");
  process.exit(0);
}

const uploadedPaths = [];
try {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const { data: sourceBlob, error: downloadError } = await source.storage
      .from(BUCKET)
      .download(row.storage_path);
    if (downloadError || !sourceBlob) fail(`Nedladdning av foto ${index + 1}`, downloadError);
    if (sourceBlob.size !== row.byte_size) {
      throw new Error(`Foto ${index + 1} har annan byte-storlek än metadata.`);
    }

    const sourceHash = await sha256(sourceBlob);
    const { error: uploadError } = await target.storage
      .from(BUCKET)
      .upload(row.storage_path, sourceBlob, {
        cacheControl: "3600",
        contentType: row.mime_type,
        upsert: false,
      });
    if (uploadError) fail(`Uppladdning av foto ${index + 1}`, uploadError);
    uploadedPaths.push(row.storage_path);

    const { data: targetBlob, error: verifyDownloadError } = await target.storage
      .from(BUCKET)
      .download(row.storage_path);
    if (verifyDownloadError || !targetBlob) {
      fail(`Verifieringsnedladdning av foto ${index + 1}`, verifyDownloadError);
    }
    const targetHash = await sha256(targetBlob);
    if (targetBlob.size !== sourceBlob.size || targetHash !== sourceHash) {
      throw new Error(`Foto ${index + 1} matchar inte källans bytes efter uppladdning.`);
    }
    console.log(`Foto ${index + 1}/${rows.length} verifierat.`);
  }

  const { error: metadataError } = await target.from("visit_media").insert(rows);
  if (metadataError) fail("Skrivning av målmetadata", metadataError);
} catch (error) {
  if (uploadedPaths.length > 0) {
    const { error: cleanupError } = await target.storage.from(BUCKET).remove(uploadedPaths);
    if (cleanupError) {
      console.error(
        "Automatisk städning av målobjekt misslyckades; kontrollera mål-bucket manuellt.",
      );
    }
  }
  throw error;
}

const { data: finalRows, error: finalRowsError } = await target
  .from("visit_media")
  .select("id,storage_path,byte_size")
  .order("id");
if (finalRowsError) fail("Slutverifiering av målmetadata", finalRowsError);
if ((finalRows ?? []).length !== rows.length) {
  throw new Error("Målmetadata har fel radantal efter migrering.");
}

console.log(
  `Migrering klar: ${rows.length} privata besöksfoton med verifierade bytes och metadata.`,
);
