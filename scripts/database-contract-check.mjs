#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  CURRENT_GROUP_STATE_RPC,
  PREVIOUS_GROUP_STATE_RPC,
} from "../src/lib/matrundan/read-model-version";

const root = process.cwd();
const base = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? null;
const migrationRoot = resolve(root, "supabase/migrations");
const preflightPath = resolve(root, "supabase/production-preflight.sql");
const errors = [];

function git(args, allowFailure = false) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.status === 0 ? result.stdout.trim() : "";
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function changedFiles(baseSha) {
  if (!baseSha) return [];
  const output = git(["diff", "--name-only", "--diff-filter=ACMR", baseSha, "HEAD"], true);
  return output ? output.split("\n").filter(Boolean) : [];
}

function functionPattern(name) {
  return new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name}\\s*\\(`, "i");
}

const migrationFiles = walk(migrationRoot).filter((file) => extname(file) === ".sql");
const sql = migrationFiles.map((file) => readFileSync(file, "utf8")).join("\n\n");
const requiredFunctions = [
  PREVIOUS_GROUP_STATE_RPC,
  CURRENT_GROUP_STATE_RPC,
  "replace_group_search_settings",
  "create_group_with_owner_v2",
];

for (const name of requiredFunctions) {
  if (!functionPattern(name).test(sql)) errors.push(`Migrationerna saknar funktionen public.${name}.`);
}
if (!/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.group_search_areas/i.test(sql)) {
  errors.push("Migrationerna saknar tabellen public.group_search_areas.");
}
if (!/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+default_search_radius_km/i.test(sql)) {
  errors.push("Migrationerna saknar groups.default_search_radius_km.");
}

if (!existsSync(preflightPath)) {
  errors.push("supabase/production-preflight.sql saknas.");
} else {
  const preflight = readFileSync(preflightPath, "utf8");
  for (const name of requiredFunctions) {
    if (!preflight.includes(name)) errors.push(`Produktions-preflight saknar ${name}.`);
  }
  for (const object of ["group_search_areas", "default_search_radius_km"]) {
    if (!preflight.includes(object)) errors.push(`Produktions-preflight saknar ${object}.`);
  }
}

if (base) {
  const files = changedFiles(base);
  const changedCode = files.filter(
    (file) =>
      file.startsWith("src/") &&
      [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extname(file)) &&
      existsSync(resolve(root, file)),
  );
  const rpcNames = new Set();
  for (const file of changedCode) {
    const source = readFileSync(resolve(root, file), "utf8");
    for (const match of source.matchAll(/\.rpc\(\s*["']([a-zA-Z0-9_]+)["']/g)) {
      rpcNames.add(match[1]);
    }
  }
  for (const name of rpcNames) {
    if (!functionPattern(name).test(sql)) {
      errors.push(`Ändrad kod anropar RPC:n ${name}, men ingen migration definierar den.`);
    }
  }

  const changedMigrations = files.filter(
    (file) => file.startsWith("supabase/migrations/") && file.endsWith(".sql"),
  );
  for (const file of changedMigrations) {
    const source = readFileSync(resolve(root, file), "utf8");
    const definitions = [...source.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-zA-Z0-9_]+)/gi)];
    if (definitions.length > 0 && /SECURITY\s+DEFINER/i.test(source) && !/SET\s+search_path/i.test(source)) {
      errors.push(`${file} använder SECURITY DEFINER utan låst search_path.`);
    }
    for (const definition of definitions) {
      const name = definition[1];
      const grantsAuthenticated = new RegExp(
        `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}[^;]*TO\\s+authenticated`,
        "i",
      ).test(source);
      if (
        grantsAuthenticated &&
        !new RegExp(
          `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${name}[^;]*FROM\\s+PUBLIC\\s*,\\s*anon`,
          "i",
        ).test(source)
      ) {
        errors.push(`${file}: public.${name} ges till authenticated utan REVOKE från PUBLIC och anon.`);
      }
    }
  }
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Fel: ${error}`));
  process.exit(1);
}

console.log(
  `Databaskontrakt godkänt: ${CURRENT_GROUP_STATE_RPC} med fallback till ${PREVIOUS_GROUP_STATE_RPC}.`,
);
