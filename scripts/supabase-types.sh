#!/usr/bin/env bash
set -euo pipefail

SUPABASE_CLI_VERSION="2.115.0"
TARGET="${2:-src/integrations/supabase/types.ts}"
MODE="${1:-check}"

tmp="$(mktemp)"
cleanup() {
  rm -f "$tmp"
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

npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript --local --schema public > "$tmp"

if [[ "$MODE" == "generate" ]]; then
  mkdir -p "$(dirname "$TARGET")"
  cp "$tmp" "$TARGET"
  echo "Supabase-typer genererade från lokal migrationsdatabas: $TARGET"
  exit 0
fi

if ! cmp -s "$TARGET" "$tmp"; then
  echo "De incheckade Supabase-typerna matchar inte repoets lokala migrationsschema." >&2
  echo "Kör 'bun run supabase:types:generate' efter att lokal Supabase-databas har startats." >&2
  diff -u "$TARGET" "$tmp" || true
  exit 1
fi

echo "Supabase-typerna matchar repoets lokala migrationsschema."
