#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migrationPath = resolve(
  root,
  "supabase/migrations/20260919164000_visit_photo_gallery_v1.sql",
);
const crossGroupMigrationPath = resolve(
  root,
  "supabase/migrations/20260922193000_visit_photo_cross_group_visibility_v1.sql",
);
const preflightPath = resolve(root, "supabase/production-preflight-visit-photo.sql");
const migration = readFileSync(migrationPath, "utf8");
const crossGroupMigration = readFileSync(crossGroupMigrationPath, "utf8");
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

const deleteGuard = migration.match(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_delete_visit_photo[\s\S]*?\$function\$;/i,
)?.[0];
if (!deleteGuard) {
  errors.push("Migrationen saknar can_delete_visit_photo.");
} else if (/can_delete_original_visit/i.test(deleteGuard)) {
  errors.push("Besöksregistreraren får inte ärva rätt att punktmoderera andra deltagares bilder.");
}
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
  /CREATE\s+POLICY\s+"visit photos allowed delete"[\s\S]*?NOT\s+EXISTS[\s\S]*?visit_media[\s\S]*?has_group_role/i,
  "Storage-delete måste bara städa orefererade media och stödja owner/admin-moderation.",
);
requirePattern(
  migration,
  /CREATE\s+FUNCTION\s+public\.delete_original_visit[\s\S]*?RETURNS\s+text\[\][\s\S]*?array_agg\(vm\.storage_path[\s\S]*?DELETE\s+FROM\s+public\.visits/i,
  "Helbesöksradering måste samla Storage-sökvägar och radera besöket utan punktmoderation.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_group_app_state_v5c[\s\S]*?ORDER\s+BY\s+vm\.created_at\s*,\s*vm\.id[\s\S]*?LIMIT\s+1/i,
  "Legacy-readmodellen måste fortsätta välja exakt en stabil representativ bild.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_group_app_state_v5m[\s\S]*?'\{photos\}'[\s\S]*?public\.visit_media/i,
  "Flerfotomigrationen måste etablera gruppens deltagarbilder som photos[].",
);
requirePattern(
  crossGroupMigration,
  /CREATE\s+TABLE\s+public\.visit_media_group_visibility[\s\S]*?FOREIGN\s+KEY\s*\(media_id,\s*visit_id\)[\s\S]*?ON\s+DELETE\s+CASCADE[\s\S]*?FOREIGN\s+KEY\s*\(visit_id,\s*group_id\)[\s\S]*?ON\s+DELETE\s+CASCADE/i,
  "Cross-group-synligheten måste kaskadera med både mediaobjekt och besökslänk.",
);
requirePattern(
  crossGroupMigration,
  /grant_own_visit_photo_visibility_v1[\s\S]*?uploaded_by\s*=\s*_uid[\s\S]*?visit_participants[\s\S]*?has_membership/i,
  "Endast bildägaren, som faktisk deltagare och målgruppsmedlem, får dela sin bild.",
);
requirePattern(
  crossGroupMigration,
  /resolve_visit_photo_delivery_v1[\s\S]*?REVOKE\s+ALL[\s\S]*?authenticated[\s\S]*?GRANT\s+EXECUTE[\s\S]*?service_role/i,
  "Rå Storage-upplösning måste vara server-only.",
);
requirePattern(
  crossGroupMigration,
  /get_group_app_state_v5n[\s\S]*?deliveryToken[\s\S]*?visit_media_group_visibility/i,
  "Aktuell read-model måste exponera cross-group-media via opaque delivery-token.",
);

for (const marker of [
  "visit-photo:one-active-photo-per-participant",
  "visit-photo:actual-participant-required-for-upload",
  "visit-photo:targeted-delete-supports-owner-admin-moderation",
  "visit-photo:authenticated-cannot-call-internal-manage-helper",
  "visit-photo:authenticated-cannot-call-internal-delete-helper",
  "visit-photo:authenticated-can-call-targeted-delete",
  "visit-photo:upload-policy-uses-current-user-guard",
  "visit-photo:delete-policy-cleans-only-orphaned-media",
  "visit-photo:whole-visit-delete-returns-storage-paths",
  "visit-photo:upsert-conflicts-per-uploader",
  "visit-photo:legacy-read-model-keeps-one-representative",
  "visit-photo:gallery-migration-exposed-photo-array",
  "visit-photo:cross-group-visibility-table",
  "visit-photo:cross-group-table-no-authenticated-read",
  "visit-photo:cross-group-grant-owner-only",
  "visit-photo:delivery-resolver-service-only",
  "visit-photo:current-read-model-uses-opaque-cross-group-token",
  "visit-photo:visibility-cascades-with-media-and-visit-link",
]) {
  if (!preflight.includes(marker)) errors.push(`Besöksfoto-preflight saknar ${marker}.`);
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Fel: ${error}`));
  process.exit(1);
}

console.log("Besöksbildernas ägarskap, cross-group-synlighet och serverleverans hänger ihop.");
