#!/usr/bin/env bash
# Install idempotente dipendenze per Cloud Agents Cursor (ProgettoISO).
# Eseguito da `.cursor/environment.json` → campo `install` all'avvio VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

install_dir() {
  local dir="$1"
  if [[ ! -f "$dir/package.json" ]]; then
    echo "[cloud-install] skip $dir (nessun package.json)"
    return 0
  fi
  echo "[cloud-install] npm ci → $dir"
  if [[ -f "$dir/package-lock.json" ]]; then
    (cd "$dir" && npm ci --no-audit --no-fund)
  else
    (cd "$dir" && npm install --no-audit --no-fund)
  fi
}

install_dir "app"
install_dir "backend"

echo "[cloud-install] OK"
