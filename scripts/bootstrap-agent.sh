#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WITH_CHROMIUM=false
for argument in "$@"; do
  case "$argument" in
    --with-chromium) WITH_CHROMIUM=true ;;
    --dependencies-only) ;;
    *)
      echo "Okänt argument: $argument" >&2
      echo "Användning: bash scripts/bootstrap-agent.sh [--with-chromium] [--dependencies-only]" >&2
      exit 2
      ;;
  esac
done

PACKAGE_MANAGER="$(grep -m1 '"packageManager"' package.json | sed -E 's/.*"packageManager"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
if [[ ! "$PACKAGE_MANAGER" =~ ^bun@([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo 'package.json måste ange ett exakt "packageManager": "bun@x.y.z".' >&2
  exit 1
fi
EXPECTED_BUN_VERSION="${BASH_REMATCH[1]}"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

CURRENT_BUN_VERSION="$(bun --version 2>/dev/null || true)"
if [[ "$CURRENT_BUN_VERSION" != "$EXPECTED_BUN_VERSION" ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "Bun $EXPECTED_BUN_VERSION saknas och curl är inte installerat." >&2
    exit 1
  fi
  echo "Installerar Bun $EXPECTED_BUN_VERSION i $BUN_INSTALL …"
  curl -fsSL https://bun.sh/install | bash -s "bun-v$EXPECTED_BUN_VERSION"
  hash -r
fi

if [[ "$(bun --version)" != "$EXPECTED_BUN_VERSION" ]]; then
  echo "Kunde inte aktivera Bun $EXPECTED_BUN_VERSION. Kontrollera PATH och BUN_INSTALL." >&2
  exit 1
fi

echo "Installerar låsta beroenden …"
bun install --frozen-lockfile

if [[ "$WITH_CHROMIUM" == "true" ]]; then
  echo "Installerar Chromium för relevanta Playwright-kontroller …"
  bunx playwright install --with-deps chromium
fi

bun run doctor

echo "Miljön är klar. Kör bun run verify:agent för relevant verifiering."
