#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migrationPath = resolve(
  root,
  "supabase/migrations/20260919164000_visit_photo_gallery_v1.sql",
);
const preflightPath = resolve(root, "supabase/production-preflight-visit-photo.sql");
const migration = readFileSync(migrationPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const errors = [];

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

requirePattern(
  migration,
  /DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+visit_media_visit_group_unique/i,
  "Flerfotomigrationen måste ta bort den gamla singelfotonyckeln.",
);
requirePattern(
  migration,
  /UNIQUE\s*\(\s*visit_id\s*,\s*group_id\s*,\s*uploaded_by\s*\)/i,
  "Flerfotomigrationen måste tillåta högst en bild per deltagare och besök.",
);
requirePattern(
  migration,
  /can_manage_visit_photo[\s\S]*?visit_participants[\s\S]*?vp\.user_id\s*=\s*_user_id/i,
  "Foto-uppladdning måste kräva faktisk deltagarstatus server-side.",
);

const manageFunction = migration.match(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_manage_visit_photo[\s\S]*?\$function\$;/i,
)?.[0];
if (!manageFunction) {
  errors.push("Migrationen saknar can_manage_visit_photo.");
} else if (/has_group_role/i.test(manageFunction)) {
  errors.push("Owner/admin får inte få uppladdningsrätt utan faktisk deltagarstatus.");
}

requirePattern(
  migration,
  /can_delete_visit_photo\s*\([\s\S]*?_uploaded_by\s+uuid[\s\S]*?_user_id\s+uuid[\s\S]*?has_group_role[\s\S]*?owner[\s\S]*?admin/i,
  "Targeted delete måste bevara individuell ägare och separat owner/admin-moderation.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.delete_visit_photo_v2/i,
  "Migrationen saknar målbildsmedveten delete-RPC.",
);
requirePattern(
  migration,
  /ON\s+CONFLICT\s*\(\s*visit_id\s*,\s*group_id\s*,\s*uploaded_by\s*\)/i,
  "Foto-upsert måste konflikthanteras per deltagarplats.",
);
requirePattern(
  migration,
  /pg_advisory_xact_lock/i,
  "Foto-upsert/delete måste serialisera deltagarens bildplats.",
);
requirePattern(
  migration,
  /storage\.objects[\s\S]*?owner\s*=\s*_uid/i,
  "Foto-upsert måste verifiera att den nya Storage-filen ägs av current user.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_group_app_state_v5c[\s\S]*?ORDER\s+BY\s+vm\.created_at\s*,\s*vm\.id[\s\S]*?LIMIT\s+1/i,
  "Legacy-readmodellen måste fortsätta välja exakt en stabil representativ bild.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_group_app_state_v5m[\s\S]*?'\{photos\}'[\s\S]*?public\.visit_media/i,
  "Aktuell read-model måste exponera gruppens deltagarbilder som photos[].",
);

for (const marker of [
  "visit-photo:one-active-photo-per-participant",
  "visit-photo:actual-participant-required-for-upload",
  "visit-photo:targeted-delete-supports-owner-admin-moderation",
  "visit-photo:authenticated-cannot-call-internal-manage-helper",
  "visit-photo:authenticated-cannot-call-internal-delete-helper",
  "visit-photo:authenticated-can-call-targeted-delete",
  "visit-photo:upload-policy-uses-current-user-guard",
  "visit-photo:delete-policy-uses-target-aware-path-guard",
  "visit-photo:upsert-conflicts-per-uploader",
  "visit-photo:legacy-read-model-keeps-one-representative",
  "visit-photo:current-read-model-exposes-photo-array",
]) {
  if (!preflight.includes(marker)) errors.push(`Besöksfoto-preflight saknar ${marker}.`);
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Fel: ${error}`));
  process.exit(1);
}

console.log("Besöksbildernas deltagarägarskap, galleri-read-model och Storage-policy hänger ihop.");
