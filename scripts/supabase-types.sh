#!/usr/bin/env bash
set -euo pipefail

SUPABASE_CLI_VERSION="2.115.0"
TARGET="${2:-src/integrations/supabase/types.ts}"
MODE="${1:-check}"

tmp="$(mktemp)"
actual_normalized="$(mktemp)"
expected_normalized="$(mktemp)"
cleanup() {
  rm -f "$tmp" "$actual_normalized" "$expected_normalized"
}
trap cleanup EXIT

case "$MODE" in
  generate|check) ;;
  *)
    echo "Användning: bash scripts/supabase-types.sh <generate|check> [målfil]" >&2
    exit 2
    ;;
esac

if ! command -v npx >/dev/null 2>&1; then
  echo "npx krävs för den pinnade Supabase CLI:n." >&2
  exit 1
fi

normalize_trailing_blank_lines() {
  awk 'NF { last = NR } { lines[NR] = $0 } END { for (i = 1; i <= last; i++) print lines[i] }' "$1"
}

npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript --local --schema public > "$tmp"

if [[ "$MODE" == "generate" ]]; then
  mkdir -p "$(dirname "$TARGET")"
  cp "$tmp" "$TARGET"
  echo "Supabase-typer genererade från lokal migrationsdatabas: $TARGET"
  exit 0
fi

normalize_trailing_blank_lines "$TARGET" > "$actual_normalized"
normalize_trailing_blank_lines "$tmp" > "$expected_normalized"

if ! cmp -s "$actual_normalized" "$expected_normalized"; then
  echo "De incheckade Supabase-typerna matchar inte repoets lokala migrationsschema." >&2
  echo "Kör 'bun run supabase:types:generate' efter att lokal Supabase-databas har startats." >&2
  diff -u "$actual_normalized" "$expected_normalized" || true
  exit 1
fi

echo "Supabase-typerna matchar repoets lokala migrationsschema."
