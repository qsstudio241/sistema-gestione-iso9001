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

# Chromium di Playwright nello snapshot Cloud: gli smoke autenticati
# (`smoke-percorsi-critici.mjs`) usano backend/node_modules, non /tmp.
# Idempotente: se i binari sono già in ~/.cache/ms-playwright, è un no-op.
install_playwright_chromium() {
  if [[ ! -f "$ROOT/backend/package.json" ]]; then
    echo "[cloud-install] skip playwright chromium (nessun backend/package.json)"
    return 0
  fi
  if ! grep -q '"playwright"' "$ROOT/backend/package.json"; then
    echo "[cloud-install] skip playwright chromium (non in package.json)"
    return 0
  fi
  if [[ ! -f "$ROOT/backend/node_modules/playwright/package.json" ]]; then
    echo "[cloud-install] ERRORE: playwright è in package.json ma manca in node_modules (npm ci ha omesso i dev?)" >&2
    return 1
  fi
  echo "[cloud-install] npx playwright install chromium"
  (cd "$ROOT/backend" && npx playwright install chromium)
}

install_playwright_chromium

echo "[cloud-install] OK"
