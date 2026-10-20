#!/usr/bin/env bash
# Deploy backend VPS — solo ambiente TEST (sgq-backend-test + DB test).
# Mai sgq-backend / /var/www/sgq-backend / porta 3000 (PROD).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SGQ_REMOTE_BASE="/var/www/sgq-backend-test"
export SGQ_SYSTEMD_SERVICE="sgq-backend-test.service"
export SGQ_HEALTH_URL="https://sistemi.fr-busato.it:8443/test-api/api/v1/health"
export SGQ_LISTEN_PORT="${SGQ_LISTEN_PORT:-3001}"
bash "${SCRIPT_DIR}/deploy-to-vps.sh"
