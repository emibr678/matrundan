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

mapfile -t auth_data_tables < <(
  psql "$SUPABASE_DB_URL" -X --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 <<'SQL'
select table_schema || '.' || table_name
from information_schema.tables
where table_schema = 'auth'
  and table_type = 'BASE TABLE'
order by table_name;
SQL
)

if [[ ${#auth_data_tables[@]} -lt 2 ]]; then
  echo "Auth-backup kräver minst auth.users och auth.identities." >&2
  exit 1
fi

auth_tables=()
for required_table in auth.users auth.identities auth.mfa_factors; do
  for available_table in "${auth_data_tables[@]}"; do
    if [[ "$available_table" == "$required_table" ]]; then
      auth_tables+=("$required_table")
      break
    fi
  done
done

if [[ ${#auth_tables[@]} -lt 2 ]] || [[ " ${auth_tables[*]} " != *" auth.users "* ]] || [[ " ${auth_tables[*]} " != *" auth.identities "* ]]; then
  echo "Auth-backup kräver minst auth.users och auth.identities." >&2
  exit 1
fi

data_exclude_args=(
  -x "storage.buckets_vectors"
  -x "storage.vector_indexes"
)
for table in "${auth_data_tables[@]}"; do
  data_exclude_args+=(-x "$table")
done

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$partial/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$partial/schema.sql"
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$partial/data.sql" \
  --use-copy \
  --data-only \
  "${data_exclude_args[@]}"

if grep -Eq '^[[:space:]]*(COPY|INSERT[[:space:]]+INTO)[[:space:]]+"?auth"?\.' "$partial/data.sql"; then
  echo "Den generella databackupen innehåller Auth-data trots explicit exkludering." >&2
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
  > "$partial/auth.sql"

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
  > "$partial/auth-schema.json" <<'SQL'
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

psql "$SUPABASE_DB_URL" \
  -X \
  --no-psqlrc \
  --tuples-only \
  --no-align \
  --set ON_ERROR_STOP=1 \
  > "$partial/inventory.json" <<'SQL'
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
    'visit_photo_storage_objects', (
      select count(*)
      from storage.objects o
      join public.visit_media vm on vm.storage_path = o.name
      where o.bucket_id = 'visit-photos'
    )
  )
)::text;
SQL

{
  printf 'supabase=%s\n' "$(supabase --version)"
  printf 'psql=%s\n' "$(psql --version)"
  printf 'pg_dump=%s\n' "$(pg_dump --version)"
  printf 'bun=%s\n' "$(bun --version)"
  printf 'postgres_client_image=%s\n' "${POSTGRES_CLIENT_IMAGE:-native}"
} > "$partial/tooling.txt"

chmod 600 "$partial"/*
mv "$partial" "$target"
trap - ERR INT TERM

echo "Databas-, Auth- och Auth-schemabackup skapad. Exportera privata media och skapa sedan backupmanifestet."
