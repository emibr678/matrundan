#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASHRC="${HOME}/.bashrc"
BUN_INSTALL_LINE='export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}" # matrundan-codex'
BUN_PATH_LINE='export PATH="$BUN_INSTALL/bin:$PATH" # matrundan-codex'

touch "$BASHRC"
grep -qxF "$BUN_INSTALL_LINE" "$BASHRC" || printf '\n%s\n' "$BUN_INSTALL_LINE" >> "$BASHRC"
grep -qxF "$BUN_PATH_LINE" "$BASHRC" || printf '%s\n' "$BUN_PATH_LINE" >> "$BASHRC"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

bash scripts/bootstrap-agent.sh --with-chromium

echo "Codex Cloud-miljön är klar. Bun-sökvägen är sparad i ~/.bashrc."
