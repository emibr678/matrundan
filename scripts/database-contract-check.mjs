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
const preflightReadModelPath = resolve(root, "supabase/production-preflight-read-model.sql");
const preflightLocationPath = resolve(root, "supabase/production-preflight-place-location.sql");
const preflightBoundaryPath = resolve(root, "supabase/production-preflight-search-boundaries.sql");
const preflightVisitParticipationPath = resolve(
  root,
  "supabase/production-preflight-visit-participation.sql",
);
const preflightReviewReactionsPath = resolve(
  root,
  "supabase/production-preflight-review-reactions.sql",
);
const preflightHistoricalReviewsPath = resolve(
  root,
  "supabase/production-preflight-historical-reviews.sql",
);
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
  "create_visit_with_review_v3",
  "save_own_review_for_visit_v1",
  "set_own_visit_participation_v1",
  "update_visit_v1",
  "update_own_review_v3",
  "upgrade_own_review_model_v1",
  "get_visit_review_reactions_v1",
  "set_own_review_reaction_v1",
  "replace_group_search_settings",
  "search_area_label_is_broad",
  "create_group_with_owner_v2",
  "list_group_hidden_place_suggestions",
  "list_group_hidden_place_suggestions_v2",
  "hide_group_place_suggestion",
  "hide_group_place_suggestion_v2",
  "restore_group_place_suggestion",
  "create_or_link_provider_place_v5f",
  "create_or_link_provider_places_batch_v1",
  "create_place_data_report_v1",
  "create_place_data_report_from_suggestion_v1",
  "list_group_place_data_reports_v1",
  "list_group_place_data_reports_v2",
  "list_group_place_data_reports_v3",
  "review_place_data_report_v1",
  "prepare_place_data_report_osm_submission_v1",
  "complete_place_data_report_osm_submission_v1",
  "fail_place_data_report_osm_submission_v1",
  "get_place_data_report_osm_refresh_v1",
  "update_place_data_report_osm_status_v1",
  "link_provider_source_to_existing_place_v1",
  "resolve_missing_in_osm_reports_for_active_source_v1",
  "get_place_data_signals_v1",
  "confirm_place_data_signal_v1",
  "update_group_place_practical_info_v1",
  "get_group_place_practical_info_v1",
  "list_group_place_practical_info_history_v1",
  "get_place_external_info_context_v2",
  "get_place_external_info_context_v3",
  "save_place_external_info_snapshot_v1",
  "save_place_external_info_snapshot_v2",
  "apply_place_external_location_v1",
  "get_cross_group_practical_info_suggestions_v1",
  "apply_cross_group_practical_info_suggestion_v1",
];

for (const name of requiredFunctions) {
  if (!functionPattern(name).test(sql)) {
    errors.push(`Migrationerna saknar funktionen public.${name}.`);
  }
}
for (const marker of [
  "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
  "clear_private_notifications_on_profile_soft_delete",
]) {
  if (!sql.includes(marker)) {
    errors.push(`Säkerhetsbaslinjen saknar ${marker}.`);
  }
}
for (const table of [
  "group_search_areas",
  "group_hidden_place_suggestions",
  "place_data_reports",
  "place_data_report_osm_submission_attempts",
  "place_data_signal_confirmations",
  "group_place_practical_info_history",
  "place_external_info_snapshots",
  "visit_participation_self_corrections",
]) {
  if (!new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.${table}`, "i").test(sql)) {
    errors.push(`Migrationerna saknar tabellen public.${table}.`);
  }
}
for (const column of [
  "default_search_radius_km",
  "search_mode",
  "result_type",
  "website",
  "website_override",
  "opening_hours_override",
  "practical_info_source_url",
  "practical_info_source_note",
  "practical_info_updated_by",
  "practical_info_updated_at",
  "website_cross_group_proposal_at",
  "opening_hours_cross_group_proposal_at",
  "status",
  "first_seen_at",
  "last_seen_at",
  "valid_from",
  "valid_to",
  "osm_submission_state",
  "osm_public_reference",
  "osm_public_text",
  "osm_note_id",
  "osm_note_url",
  "osm_note_status",
  "osm_note_last_checked_at",
  "osm_submitted_by",
  "target_provider",
  "target_provider_place_id",
  "category",
  "address",
  "area",
  "city",
  "lat",
  "lng",
  "osm_type",
  "osm_id",
]) {
  if (!new RegExp(`ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${column}`, "i").test(sql)) {
    errors.push(`Migrationerna saknar den additiva kolumnen ${column}.`);
  }
}
for (const index of [
  "place_sources_active_provider_identity_uidx",
  "place_sources_active_place_provider_uidx",
  "place_data_reports_active_reporter_issue_uidx",
  "place_data_reports_active_provider_issue_uidx",
  "place_data_reports_osm_note_id_uidx",
  "place_data_reports_osm_public_reference_uidx",
  "place_data_signal_confirmations_user_place_uidx",
  "place_data_signal_confirmations_user_provider_uidx",
]) {
  if (!new RegExp(`CREATE\\s+UNIQUE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${index}`, "i").test(sql)) {
    errors.push(`Migrationerna saknar det partiella unika indexet ${index}.`);
  }
}
for (const index of [
  "place_data_report_osm_attempts_submitter_idx",
  "place_data_report_osm_attempts_group_idx",
  "place_data_report_osm_attempts_report_idx",
  "place_data_signal_confirmations_place_idx",
  "place_data_signal_confirmations_provider_idx",
  "group_place_practical_info_history_lookup_idx",
  "place_external_info_snapshots_provider_idx",
  "group_places_cross_group_practical_info_idx",
]) {
  if (!new RegExp(`CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${index}`, "i").test(sql)) {
    errors.push(`Migrationerna saknar indexet ${index}.`);
  }
}

if (!existsSync(preflightPath)) {
  errors.push("supabase/production-preflight.sql saknas.");
}
if (!existsSync(preflightReadModelPath)) {
  errors.push("supabase/production-preflight-read-model.sql saknas.");
}
if (!existsSync(preflightLocationPath)) {
  errors.push("supabase/production-preflight-place-location.sql saknas.");
}
if (!existsSync(preflightBoundaryPath)) {
  errors.push("supabase/production-preflight-search-boundaries.sql saknas.");
}
if (!existsSync(preflightVisitParticipationPath)) {
  errors.push("supabase/production-preflight-visit-participation.sql saknas.");
}
if (!existsSync(preflightReviewReactionsPath)) {
  errors.push("supabase/production-preflight-review-reactions.sql saknas.");
}
if (!existsSync(preflightHistoricalReviewsPath)) {
  errors.push("supabase/production-preflight-historical-reviews.sql saknas.");
}
if (
  existsSync(preflightPath) &&
  existsSync(preflightReadModelPath) &&
  existsSync(preflightLocationPath) &&
  existsSync(preflightBoundaryPath) &&
  existsSync(preflightVisitParticipationPath) &&
  existsSync(preflightReviewReactionsPath) &&
  existsSync(preflightHistoricalReviewsPath)
) {
  const preflight = `${readFileSync(preflightPath, "utf8")}\n${readFileSync(
    preflightReadModelPath,
    "utf8",
  )}\n${readFileSync(preflightLocationPath, "utf8")}\n${readFileSync(
    preflightBoundaryPath,
    "utf8",
  )}\n${readFileSync(preflightVisitParticipationPath, "utf8")}\n${readFileSync(
    preflightReviewReactionsPath,
    "utf8",
  )}\n${readFileSync(preflightHistoricalReviewsPath, "utf8")}`;
  for (const name of requiredFunctions) {
    if (!preflight.includes(name)) {
      errors.push(`Produktions-preflight saknar ${name}.`);
    }
  }
  for (const object of [
    "search-area:broad-label-guard",
    "search-area:hybrid-mode",
    "search-area:existing-point-default",
    "storage:visit-photo-limit",
    "isolation:no-anon-search-area-helper",
    "isolation:no-authenticated-search-area-helper",
    "group_search_areas",
    "group_search_areas.search_mode",
    "group_search_areas.result_type",
    "group_hidden_place_suggestions",
    "place_data_reports",
    "place_data_report_osm_submission_attempts",
    "place_data_signal_confirmations",
    "group_place_practical_info_history",
    "place_external_info_snapshots",
    "visit_participation_self_corrections",
    "review_group_reactions",
    "read_rpc:participant-review-filter",
    "participation_rpc:restore-needs-own-decline",
    "isolation:no-authenticated-correction-table-read",
    "review_reactions:group-and-comment-guard",
    "review_reactions:no-client-table-read",
    "review_reactions:account-delete-cleanup",
    "review_notifications:first-later-review-only",
    "place_external_info_snapshots.address",
    "place_external_info_snapshots.area",
    "place_external_info_snapshots.city",
    "place_external_info_snapshots.lat",
    "place_external_info_snapshots.lng",
    "place_external_info_snapshots.osm_type",
    "place_external_info_snapshots.osm_id",
    "default_search_radius_km",
    "places.website",
    "group_places.website_override",
    "group_places.opening_hours_override",
    "group_places.practical_info_source_url",
    "group_places.practical_info_source_note",
    "group_places.practical_info_updated_by",
    "group_places.practical_info_updated_at",
    "group_places.website_cross_group_proposal_at",
    "group_places.opening_hours_cross_group_proposal_at",
    "place_sources.status",
    "place_sources_active_provider_identity_uidx",
    "place_sources_active_place_provider_uidx",
    "place_data_reports_active_reporter_issue_uidx",
    "place_data_reports_active_provider_issue_uidx",
    "place_data_reports.target_provider",
    "place_data_reports.target_provider_place_id",
    "group_hidden_place_suggestions.category",
    "group_hidden_place_suggestions.website",
    "place_data_reports.osm_submission_state",
    "place_data_reports.osm_note_id",
    "place_data_reports.osm_note_status",
    "place_data_reports_osm_note_id_uidx",
    "place_data_reports_osm_public_reference_uidx",
    "place_data_report_osm_attempts_submitter_idx",
    "place_data_report_osm_attempts_group_idx",
    "place_data_report_osm_attempts_report_idx",
    "place_data_signal_confirmations_user_place_uidx",
    "place_data_signal_confirmations_user_provider_uidx",
    "group_place_practical_info_history_lookup_idx",
    "place_external_info_snapshots_provider_idx",
    "group_places_cross_group_practical_info_idx",
    "place_sources_resolve_missing_in_osm_reports",
  ]) {
    if (!preflight.includes(object)) {
      errors.push(`Produktions-preflight saknar ${object}.`);
    }
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
    const definitions = [
      ...source.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-zA-Z0-9_]+)/gi),
    ];
    if (
      definitions.length > 0 &&
      /SECURITY\s+DEFINER/i.test(source) &&
      !/SET\s+search_path/i.test(source)
    ) {
      errors.push(`${file} använder SECURITY DEFINER utan låst search_path.`);
    }
    for (const definition of definitions) {
      const name = definition[1];
      const revokesPublic = new RegExp(
        `REVOKE\\s+(?:ALL|EXECUTE)\\s+ON\\s+FUNCTION\\s+public\\.${name}[^;]*FROM[^;]*PUBLIC`,
        "i",
      ).test(source);
      if (!revokesPublic) {
        errors.push(`${file}: public.${name} saknar explicit REVOKE från PUBLIC.`);
      }
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
        errors.push(
          `${file}: public.${name} ges till authenticated utan REVOKE från PUBLIC och anon.`,
        );
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
