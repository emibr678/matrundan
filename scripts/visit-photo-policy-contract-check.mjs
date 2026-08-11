#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migrationPath = resolve(
  root,
  "supabase/migrations/20260811083000_fix_visit_photo_storage_policy_acl.sql",
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
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_manage_own_visit_photo\s*\(\s*_group_id\s+uuid\s*,\s*_visit_id\s+uuid\s*\)/i,
  "Migrationen saknar current-user-wrappern can_manage_own_visit_photo(uuid, uuid).",
);
requirePattern(
  migration,
  /SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s+TO\s+'public'/i,
  "Besöksfotowrappern måste vara SECURITY DEFINER med låst search_path.",
);
requirePattern(
  migration,
  /can_manage_visit_photo\s*\(\s*_group_id\s*,\s*_visit_id\s*,\s*auth\.uid\(\)\s*\)/i,
  "Besöksfotowrappern måste alltid använda auth.uid() som identitet.",
);
requirePattern(
  migration,
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.can_manage_own_visit_photo\s*\(uuid\s*,\s*uuid\)\s+FROM\s+PUBLIC\s*,\s*anon/i,
  "Current-user-wrappern måste vara återkallad från PUBLIC och anon.",
);
requirePattern(
  migration,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.can_manage_own_visit_photo\s*\(uuid\s*,\s*uuid\)\s+TO\s+authenticated\s*,\s*service_role/i,
  "Current-user-wrappern måste vara körbar för authenticated och service_role.",
);
requirePattern(
  migration,
  /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.can_manage_visit_photo\s*\(uuid\s*,\s*uuid\s*,\s*uuid\)\s+FROM\s+authenticated/i,
  "Den interna user-id-hjälparen måste fortsatt vara spärrad för authenticated.",
);

const uploadPolicy = migration.match(
  /CREATE\s+POLICY\s+"visit photos allowed upload"[\s\S]*?;\s*(?=\n\n|DROP\s+POLICY|COMMIT)/i,
)?.[0];
const deletePolicy = migration.match(
  /CREATE\s+POLICY\s+"visit photos allowed delete"[\s\S]*?;\s*(?=\n\n|COMMIT)/i,
)?.[0];

if (!uploadPolicy) {
  errors.push("Migrationen saknar upload-policyn för visit-photos.");
} else {
  requirePattern(
    uploadPolicy,
    /can_manage_own_visit_photo\s*\(/i,
    "Upload-policyn måste använda current-user-wrappern.",
  );
  if (/public\.can_manage_visit_photo\s*\(/i.test(uploadPolicy)) {
    errors.push("Upload-policyn får inte anropa den interna user-id-hjälparen direkt.");
  }
}

if (!deletePolicy) {
  errors.push("Migrationen saknar delete-policyn för visit-photos.");
} else {
  requirePattern(
    deletePolicy,
    /can_manage_own_visit_photo\s*\(/i,
    "Delete-policyn måste använda current-user-wrappern.",
  );
  requirePattern(
    deletePolicy,
    /can_delete_original_visit\s*\(/i,
    "Delete-policyn måste bevara rätten att städa foto vid tillåten originalbesöksradering.",
  );
  if (/public\.can_manage_visit_photo\s*\(/i.test(deletePolicy)) {
    errors.push("Delete-policyn får inte anropa den interna user-id-hjälparen direkt.");
  }
}

for (const marker of [
  "visit-photo:authenticated-can-call-current-user-guard",
  "visit-photo:authenticated-cannot-call-internal-user-helper",
  "visit-photo:upload-policy-uses-current-user-guard",
  "visit-photo:delete-policy-uses-current-user-guard",
]) {
  if (!preflight.includes(marker)) {
    errors.push(`Besöksfoto-preflight saknar ${marker}.`);
  }
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Fel: ${error}`));
  process.exit(1);
}

console.log("Besöksfotots Storage-policy och ACL-kontrakt är säkert kopplade.");
