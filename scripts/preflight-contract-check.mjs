#!/usr/bin/env bun

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  CURRENT_GROUP_STATE_RPC,
  PREVIOUS_GROUP_STATE_RPC,
} from "../src/lib/matrundan/read-model-version";

const root = process.cwd();
const supabaseRoot = resolve(root, "supabase");
const aggregatePath = resolve(supabaseRoot, "production-preflight-all.sql");
const readModelPath = resolve(supabaseRoot, "production-preflight-read-model.sql");
const restorePath = resolve(root, "scripts/restore-supabase-local.sh");

const aggregate = readFileSync(aggregatePath, "utf8");
const readModel = readFileSync(readModelPath, "utf8");
const restore = readFileSync(restorePath, "utf8");
const errors = [];

const focusedPreflights = readdirSync(supabaseRoot)
  .filter(
    (name) =>
      name.startsWith("production-preflight") &&
      name.endsWith(".sql") &&
      name !== "production-preflight-all.sql",
  )
  .sort((left, right) => left.localeCompare(right));

for (const name of focusedPreflights) {
  if (!aggregate.includes(`\\ir ${name}`)) {
    errors.push(`Aggregate production-preflight saknar ${name}.`);
  }
}

const readModelInclude = "\\ir production-preflight-read-model.sql";
const legacyBaseInclude = "\\ir production-preflight.sql";
if (aggregate.indexOf(readModelInclude) < 0) {
  errors.push("Aggregate production-preflight saknar read-model-grinden.");
} else if (
  aggregate.indexOf(legacyBaseInclude) >= 0 &&
  aggregate.indexOf(readModelInclude) > aggregate.indexOf(legacyBaseInclude)
) {
  errors.push("Aktuell read-model-grind ska köras före den historiska baspreflighten.");
}

for (const [label, rpc] of [
  ["current", CURRENT_GROUP_STATE_RPC],
  ["fallback", PREVIOUS_GROUP_STATE_RPC],
]) {
  if (!readModel.includes(`read_rpc_${label}:${rpc}`)) {
    errors.push(`Read-model-preflight saknar ${label}-etiketten för ${rpc}.`);
  }
  if (!readModel.includes(`public.${rpc}(uuid)`)) {
    errors.push(`Read-model-preflight verifierar inte public.${rpc}(uuid).`);
  }
}

if (!restore.includes("supabase/production-preflight-all.sql")) {
  errors.push("Restore-scriptet kör inte den samlade production-preflighten.");
}
if (!restore.includes(`public.${CURRENT_GROUP_STATE_RPC}(:'smoke_group_id'::uuid)`)) {
  errors.push(`Restore-smoken läser inte aktuell ${CURRENT_GROUP_STATE_RPC}.`);
}
if (restore.includes("public.get_group_app_state_v5h(:'smoke_group_id'::uuid)")) {
  errors.push("Restore-smoken använder fortfarande den gamla v5h-readen.");
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Fel: ${error}`));
  process.exit(1);
}

console.log(
  `Preflightkontrakt godkänt: ${focusedPreflights.length} fokuserade preflights, ${CURRENT_GROUP_STATE_RPC} med fallback ${PREVIOUS_GROUP_STATE_RPC}.`,
);
