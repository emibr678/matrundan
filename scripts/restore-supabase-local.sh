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
cleanup() {
  rm -f "$actual_inventory" "$preflight_output"
}
trap cleanup EXIT

bun scripts/backup-manifest.mjs verify "$root"

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

# Auth och applikationsdata återställs efter att migrationerna redan byggt schemat.
# Triggers stängs av under importen för att undvika dubbla bieffekter.
psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file "$root/auth.sql" \
  --file "$root/data.sql" \
  >/dev/null

bun scripts/visit-photo-backup.mjs restore "$root"

psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --tuples-only \
  --no-align \
  --set ON_ERROR_STOP=1 \
  --output "$actual_inventory" <<'SQL'
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

# Produktionspreflighten är skrivskyddad. Visa endast namn på eventuella falska kontroller,
# inte hela SQL-outputen, så restorejobbet inte blir en extra loggkanal.
psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --tuples-only \
  --no-align \
  --field-separator='|' \
  --set ON_ERROR_STOP=1 \
  --file supabase/production-preflight.sql \
  --output "$preflight_output"

mapfile -t failed_preflight < <(awk -F'|' '$NF == "f" { print $1 }' "$preflight_output")
if (( ${#failed_preflight[@]} > 0 )); then
  printf 'Produktionspreflight under restore misslyckades: %s\n' "${failed_preflight[*]}" >&2
  exit 1
fi

# Autentiserad smoke utan lösenord: simulera en återställd användares JWT-claims i samma
# databasroll som PostgREST använder och läs verklig återställd gruppstate. Inga UUID:n loggas.
psql "$LOCAL_SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --quiet \
  --set ON_ERROR_STOP=1 \
  --output /dev/null <<'SQL'
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
select public.get_group_app_state_v5h(:'smoke_group_id'::uuid);
ROLLBACK;
SQL

echo "Lokal restoreövning verifierad: Auth, data, privat media, inventory, preflight och autentiserad gruppread."
