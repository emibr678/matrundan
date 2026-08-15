#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migrationPath = resolve(
  root,
  "supabase/migrations/20260815082500_visit_photo_ownership_guard_v1.sql",
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
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_manage_visit_photo\s*\([\s\S]*?_user_id\s+uuid[\s\S]*?\)[\s\S]*?vm\.uploaded_by\s*=\s*_user_id/i,
  "Fotoägarskapsmigrationen måste hindra ersättning när uploaded_by är en annan användare.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_delete_visit_photo\s*\([\s\S]*?_user_id\s+uuid[\s\S]*?vm\.uploaded_by\s*=\s*_user_id[\s\S]*?has_group_role[\s\S]*?owner[\s\S]*?admin/i,
  "Fotoägarskapsmigrationen måste separera radering och tillåta uppladdare samt owner/admin.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_manage_own_visit_photo\s*\(\s*_group_id\s+uuid\s*,\s*_visit_id\s+uuid\s*\)[\s\S]*?auth\.uid\(\)/i,
  "Migrationen saknar current-user-wrappern för fotoersättning.",
);
requirePattern(
  migration,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_delete_own_visit_photo\s*\(\s*_group_id\s+uuid\s*,\s*_visit_id\s+uuid\s*\)[\s\S]*?auth\.uid\(\)/i,
  "Migrationen saknar current-user-wrappern för fotoradering.",
);
requirePattern(
  migration,
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.can_manage_visit_photo\s*\(uuid\s*,\s*uuid\s*,\s*uuid\)[\s\S]*?authenticated/i,
  "Den interna manage-hjälparen måste vara spärrad för authenticated.",
);
requirePattern(
  migration,
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.can_delete_visit_photo\s*\(uuid\s*,\s*uuid\s*,\s*uuid\)[\s\S]*?authenticated/i,
  "Den interna delete-hjälparen måste vara spärrad för authenticated.",
);
requirePattern(
  migration,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.can_manage_own_visit_photo\s*\(uuid\s*,\s*uuid\)\s+TO\s+authenticated\s*,\s*service_role/i,
  "Authenticated måste kunna köra self-wrappern för fotoersättning.",
);
requirePattern(
  migration,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.can_delete_own_visit_photo\s*\(uuid\s*,\s*uuid\)\s+TO\s+authenticated\s*,\s*service_role/i,
  "Authenticated måste kunna köra self-wrappern för fotoradering.",
);

const uploadPolicy = migration.match(
  /CREATE\s+POLICY\s+"visit photos allowed upload"[\s\S]*?;\s*(?=\n\n|DROP\s+POLICY|CREATE\s+OR\s+REPLACE|COMMIT)/i,
)?.[0];
const deletePolicy = migration.match(
  /CREATE\s+POLICY\s+"visit photos allowed delete"[\s\S]*?;\s*(?=\n\n|CREATE\s+OR\s+REPLACE|COMMIT)/i,
)?.[0];

if (!uploadPolicy) {
  errors.push("Migrationen saknar upload-policyn för visit-photos.");
} else {
  requirePattern(
    uploadPolicy,
    /can_manage_own_visit_photo\s*\(/i,
    "Upload-policyn måste använda den ägarskapsmedvetna current-user-wrappern.",
  );
}

if (!deletePolicy) {
  errors.push("Migrationen saknar delete-policyn för visit-photos.");
} else {
  requirePattern(
    deletePolicy,
    /can_delete_own_visit_photo\s*\(/i,
    "Delete-policyn måste använda den separata current-user-delete-wrappern.",
  );
  requirePattern(
    deletePolicy,
    /can_delete_original_visit\s*\(/i,
    "Delete-policyn måste bevara städning vid tillåten originalbesöksradering.",
  );
  requirePattern(
    deletePolicy,
    /owner\s*=\s*auth\.uid\(\)[\s\S]*?NOT\s+EXISTS[\s\S]*?visit_media/i,
    "Delete-policyn måste låta användaren städa en egen orefererad race-/feluppladdning.",
  );
}

const upsertFunction = migration.match(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.upsert_visit_photo[\s\S]*?\$function\$;/i,
)?.[0];
if (!upsertFunction) {
  errors.push("Migrationen saknar upsert_visit_photo.");
} else {
  requirePattern(
    upsertFunction,
    /pg_advisory_xact_lock/i,
    "upsert_visit_photo måste serialisera samtidiga första uppladdningar.",
  );
  requirePattern(
    upsertFunction,
    /_previous_uploader\s+IS\s+NOT\s+NULL\s+AND\s+_previous_uploader\s*<>\s*_uid/i,
    "upsert_visit_photo måste avvisa en annan uppladdare före ersättning.",
  );
  requirePattern(
    upsertFunction,
    /owner\s*=\s*_uid/i,
    "upsert_visit_photo måste verifiera att den nya Storage-filen ägs av current user.",
  );
  requirePattern(
    upsertFunction,
    /WHERE\s+public\.visit_media\.uploaded_by\s*=\s*EXCLUDED\.uploaded_by/i,
    "Conflict-update får bara ersätta foto för samma uploader.",
  );
  if (/uploaded_by\s*=\s*EXCLUDED\.uploaded_by/i.test(upsertFunction)) {
    errors.push("Fotoersättning får inte byta uploaded_by på det befintliga mediaobjektet.");
  }
}

for (const marker of [
  "visit-photo:authenticated-can-call-current-user-guard",
  "visit-photo:authenticated-can-call-current-user-delete-guard",
  "visit-photo:authenticated-cannot-call-internal-user-helper",
  "visit-photo:authenticated-cannot-call-internal-delete-helper",
  "visit-photo:upload-policy-uses-current-user-guard",
  "visit-photo:delete-policy-uses-current-user-delete-guard",
  "visit-photo:upsert-preserves-uploader-ownership",
  "visit-photo:upsert-serializes-concurrent-first-photo",
]) {
  if (!preflight.includes(marker)) {
    errors.push(`Besöksfoto-preflight saknar ${marker}.`);
  }
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Fel: ${error}`));
  process.exit(1);
}

console.log("Besöksfotots ägarskap, Storage-policy och RPC-kontrakt är säkert kopplade.");
