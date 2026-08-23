#!/usr/bin/env bash
set -euo pipefail

umask 077

if [[ $# -ne 1 ]]; then
  echo "Användning: bash scripts/backup-supabase.sh <backup-katalog>" >&2
  exit 2
fi

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL krävs}"

for command in supabase psql pg_dump bun; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Saknat kommando: $command" >&2
    exit 1
  fi
done

target="$1"
partial="${target}.partial"
if [[ -e "$target" || -e "$partial" ]]; then
  echo "Backupmålet eller dess .partial-katalog finns redan: $target" >&2
  exit 1
fi

cleanup() {
  rm -rf "$partial"
}
trap cleanup ERR INT TERM
mkdir -p "$partial"

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$partial/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$partial/schema.sql"
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$partial/data.sql" \
  --use-copy \
  --data-only \
  -x "storage.buckets_vectors" \
  -x "storage.vector_indexes"

mapfile -t auth_tables < <(
  psql "$SUPABASE_DB_URL" -X --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 <<'SQL'
select table_schema || '.' || table_name
from information_schema.tables
where table_schema = 'auth'
  and table_name in ('users', 'identities', 'mfa_factors')
order by case table_name
  when 'users' then 1
  when 'identities' then 2
  when 'mfa_factors' then 3
  else 4
end;
SQL
)

if [[ ${#auth_tables[@]} -lt 2 ]]; then
  echo "Auth-backup kräver minst auth.users och auth.identities." >&2
  exit 1
fi

auth_args=()
for table in "${auth_tables[@]}"; do
  auth_args+=("--table=$table")
done

pg_dump \
  --dbname="$SUPABASE_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  "${auth_args[@]}" \
  --file="$partial/auth.sql"

if ! grep -q "auth.users" "$partial/auth.sql" || ! grep -q "auth.identities" "$partial/auth.sql"; then
  echo "Auth-dumpen saknar förväntade tabeller." >&2
  exit 1
fi

psql "$SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --tuples-only \
  --no-align \
  --set ON_ERROR_STOP=1 \
  --output "$partial/inventory.json" <<'SQL'
select json_build_object(
  'captured_at', now(),
  'database_bytes', pg_database_size(current_database()),
  'counts', json_build_object(
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
    'visit_photo_storage_objects', (select count(*) from storage.objects where bucket_id = 'visit-photos')
  )
)::text;
SQL

{
  printf 'supabase=%s\n' "$(supabase --version)"
  printf 'psql=%s\n' "$(psql --version)"
  printf 'pg_dump=%s\n' "$(pg_dump --version)"
  printf 'bun=%s\n' "$(bun --version)"
} > "$partial/tooling.txt"

chmod 600 "$partial"/*
mv "$partial" "$target"
trap - ERR INT TERM

echo "Databas- och Auth-backup skapad. Exportera privata media och skapa sedan backupmanifestet."
