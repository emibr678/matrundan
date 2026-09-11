#!/usr/bin/env bash
set -euo pipefail

umask 077

if [[ $# -ne 1 ]]; then
  echo "Användning: bash scripts/restore-supabase-local.sh <backup-katalog>" >&2
  exit 2
fi

: "${LOCAL_SUPABASE_DB_URL:?LOCAL_SUPABASE_DB_URL krävs}"
: "${TARGET_SUPABASE_URL:?TARGET_SUPABASE_URL krävs}"
: "${TARGET_SUPABASE_SERVICE_ROLE_KEY:?TARGET_SUPABASE_SERVICE_ROLE_KEY krävs}"

for command in psql bun; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Saknat kommando: $command" >&2
    exit 1
  fi
done

root="$(cd "$1" && pwd)"
actual_inventory="$(mktemp)"
preflight_output="$(mktemp)"
local_auth_schema="$(mktemp)"
cleanup() {
  rm -f "$actual_inventory" "$preflight_output" "$local_auth_schema"
}
trap cleanup EXIT

bun scripts/backup-manifest.mjs verify "$root"

if [[ ! -f "$root/auth-schema.json" ]]; then
  echo "Backupen saknar auth-schema.json." >&2
  exit 1
fi

# Restoreövningen ska börja från repoets migrationer i en tom lokal Supabase-stack.
# Avbryt hellre än att råka lägga backupdata ovanpå ett återanvänt lokalt mål.
initial_counts="$({
  psql "$LOCAL_SUPABASE_DB_URL" \
    -X \
    --no-psqlrc \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 <<'SQL'
select
  (select count(*) from auth.users)::text || '|' ||
  (select count(*) from public.groups)::text || '|' ||
  (select count(*) from public.visit_media)::text;
SQL
} | tr -d '[:space:]')"

if [[ "$initial_counts" != "0|0|0" ]]; then
  echo "Det lokala restoremålet är inte tomt (auth.users|groups|visit_media=$initial_counts)." >&2
  exit 1
fi

psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --tuples-only \
  --no-align \
  --set ON_ERROR_STOP=1 \
  > "$local_auth_schema" <<'SQL'
select json_build_object(
  'format', 'matrundan-auth-schema-v1',
  'tables', coalesce(
    json_agg(table_shape order by table_name),
    '[]'::json
  )
)::text
from (
  select
    t.table_name,
    json_build_object(
      'name', t.table_name,
      'columns', (
        select json_agg(
          json_build_object(
            'name', c.column_name,
            'udt_name', c.udt_name,
            'nullable', c.is_nullable = 'YES',
            'default', c.column_default
          )
          order by c.ordinal_position
        )
        from information_schema.columns c
        where c.table_schema = 'auth'
          and c.table_name = t.table_name
      )
    ) as table_shape
  from information_schema.tables t
  where t.table_schema = 'auth'
    and t.table_name in ('users', 'identities', 'mfa_factors')
) snapshot;
SQL

node - "$root/auth-schema.json" "$local_auth_schema" <<'NODE'
const fs = require("node:fs");

const expected = JSON.parse(fs.readFileSync(process.argv[2], "utf8").trim());
const actual = JSON.parse(fs.readFileSync(process.argv[3], "utf8").trim());

if (expected.format !== "matrundan-auth-schema-v1" || actual.format !== expected.format) {
  console.error("Auth-schemakontrollen fick ett okänt format.");
  process.exit(1);
}

const actualTables = new Map(actual.tables.map((table) => [table.name, table]));
const problems = [];

for (const sourceTable of expected.tables) {
  const targetTable = actualTables.get(sourceTable.name);
  if (!targetTable) {
    problems.push(`auth.${sourceTable.name} saknas lokalt`);
    continue;
  }

  const sourceColumns = new Map(sourceTable.columns.map((column) => [column.name, column]));
  const targetColumns = new Map(targetTable.columns.map((column) => [column.name, column]));

  for (const sourceColumn of sourceTable.columns) {
    const targetColumn = targetColumns.get(sourceColumn.name);
    if (!targetColumn) {
      problems.push(`auth.${sourceTable.name}.${sourceColumn.name} saknas lokalt`);
      continue;
    }
    if (targetColumn.udt_name !== sourceColumn.udt_name) {
      problems.push(
        `auth.${sourceTable.name}.${sourceColumn.name} har typen ${targetColumn.udt_name}, förväntat ${sourceColumn.udt_name}`,
      );
    }
  }

  for (const targetColumn of targetTable.columns) {
    if (
      !sourceColumns.has(targetColumn.name) &&
      targetColumn.nullable !== true &&
      targetColumn.default == null
    ) {
      problems.push(
        `auth.${sourceTable.name}.${targetColumn.name} är ny, obligatorisk och saknar default`,
      );
    }
  }
}

for (const requiredTable of ["users", "identities"]) {
  if (!expected.tables.some((table) => table.name === requiredTable)) {
    problems.push(`backupens auth-schema saknar auth.${requiredTable}`);
  }
}

if (problems.length > 0) {
  console.error(`Auth-schemat är inte restorekompatibelt: ${problems.join("; ")}`);
  process.exit(1);
}

console.log("Auth-schemakompatibilitet verifierad före import.");
NODE

# Auth och applikationsdata återställs efter att migrationerna redan byggt schemat.
# Triggers stängs av under importen för att undvika dubbla bieffekter.
{
  printf '%s\n' 'SET session_replication_role = replica;'
  cat "$root/auth.sql" "$root/data.sql"
} | psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  >/dev/null

bun scripts/visit-photo-backup.mjs restore "$root"

psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --tuples-only \
  --no-align \
  --set ON_ERROR_STOP=1 \
  > "$actual_inventory" <<'SQL'
select json_build_object(
  'public_tables', (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'),
  'schema_migrations', (select count(*) from supabase_migrations.schema_migrations),
  'auth_users', (select count(*) from auth.users),
  'auth_identities', (select count(*) from auth.identities),
  'groups', (select count(*) from public.groups),
  'memberships', (select count(*) from public.memberships),
  'places', (select count(*) from public.places),
  'visits', (select count(*) from public.visits),
  'reviews', (select count(*) from public.reviews),
  'activity', (select count(*) from public.activity),
  'place_external_info_snapshots', (select count(*) from public.place_external_info_snapshots),
  'visit_media', (select count(*) from public.visit_media),
  'visit_photo_storage_objects', (
    select count(*)
    from storage.objects o
    join public.visit_media vm on vm.storage_path = o.name
    where o.bucket_id = 'visit-photos'
  )
)::text;
SQL

node - "$root/inventory.json" "$actual_inventory" <<'NODE'
const fs = require('node:fs');
const expected = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).counts;
const actual = JSON.parse(fs.readFileSync(process.argv[3], 'utf8').trim());
const keys = [
  'public_tables',
  'schema_migrations',
  'auth_users',
  'auth_identities',
  'groups',
  'memberships',
  'places',
  'visits',
  'reviews',
  'activity',
  'place_external_info_snapshots',
  'visit_media',
  'visit_photo_storage_objects',
];
const mismatches = keys.filter((key) => Number(expected[key]) !== Number(actual[key]));
if (mismatches.length > 0) {
  console.error(`Restoreinventeringen avviker för: ${mismatches.join(', ')}`);
  process.exit(1);
}
console.log(`Restoreinventering verifierad: ${keys.length} räknare matchar backupen.`);
NODE

# Den samlade produktionspreflighten är skrivskyddad. Visa endast namn på eventuella
# falska kontroller, inte hela SQL-outputen, så restorejobbet inte blir en extra loggkanal.
psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --tuples-only \
  --no-align \
  --field-separator='|' \
  --set ON_ERROR_STOP=1 \
  < supabase/production-preflight-all.sql \
  > "$preflight_output"

mapfile -t failed_preflight < <(awk -F'|' '$NF == "f" { print $1 }' "$preflight_output")
if (( ${#failed_preflight[@]} > 0 )); then
  printf 'Produktionspreflight under restore misslyckades: %s\n' "${failed_preflight[*]}" >&2
  exit 1
fi

# Autentiserad smoke utan lösenord: simulera en återställd användares JWT-claims i samma
# databasroll som PostgREST använder och läs aktuell verklig gruppstate. Inga UUID:n loggas.
psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --quiet \
  --set ON_ERROR_STOP=1 \
  > /dev/null <<'SQL'
BEGIN;
select m.user_id::text as smoke_user_id, m.group_id::text as smoke_group_id
from public.memberships m
join auth.users u on u.id = m.user_id
order by m.joined_at, m.user_id, m.group_id
limit 1
\gset

select set_config('request.jwt.claim.sub', :'smoke_user_id', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'smoke_user_id', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
select public.get_group_app_state_v5l(:'smoke_group_id'::uuid);
ROLLBACK;
SQL

echo "Lokal restoreövning verifierad: Auth, data, privat media, inventory, samlad preflight och autentiserad current group read."
