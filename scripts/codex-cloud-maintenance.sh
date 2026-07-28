#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

bash scripts/bootstrap-agent.sh --dependencies-only
bunx playwright install chromium

echo "Codex Cloud-cachen är uppdaterad för aktuell branch."
