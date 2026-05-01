#!/usr/bin/env bash
# Deploy backend sul VPS — versione Linux/bash per Cloud Agent Cursor
#
# Equivalente di deploy-controllers-to-vps.ps1 ma usa ssh/scp OpenSSH standard
# invece di pscp/plink PuTTY (necessario su Linux e in Cloud Agent).
#
# AUTENTICAZIONE (ordine di precedenza):
#   1. Variabile d'ambiente SGQ_SSH_KEY_B64  — chiave privata SSH in base64
#      (impostabile nei Cursor Cloud Secrets: Dashboard → Cloud Agents → Secrets)
#      Generazione: base64 -w0 ~/.ssh/id_rsa_sgq  (o altro file chiave)
#   2. File ~/.ssh/id_rsa_sgq o ~/.ssh/id_ed25519_sgq già presente sul sistema
#   3. Variabile SGQ_SSH_PASSWORD + sshpass (se sshpass è installato)
#
# COME USARE NEL CLOUD AGENT:
#   1. Aggiungi in Cursor Dashboard → Cloud Agents → Secrets:
#      - SGQ_SSH_KEY_B64 = <output di: base64 -w0 /path/alla/tua/chiave_privata>
#      - SGQ_SUDO_PASSWORD = <password sudo sul VPS> (opzionale ma consigliata)
#   2. L'agent può eseguire:
#      bash backend/scripts/deploy-to-vps.sh
#
# HOST KEY FINGERPRINT VPS (per verifica non interattiva):
#   ssh-ed25519 255 SHA256:X7V82/1Ugdd7QmCJqaAXTn8Pazqv8bRA3mshLlwbsoc
#
# SICUREZZA:
#   - Non committare mai chiavi private, password o SGQ_SSH_KEY_B64 nel repository.
#   - Usare solo Cursor Cloud Secrets o file locali gitignored.

set -euo pipefail

VPS_USER="spascarella"
VPS_HOST="www.fr-busato.it"
VPS_PORT="1122"
VPS="${VPS_USER}@${VPS_HOST}"
REMOTE_BASE="/var/www/sgq-backend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== Deploy SGQ Backend → VPS ==="
echo "    Backend locale : ${BACKEND_ROOT}"
echo "    Destinazione   : ${VPS}:${REMOTE_BASE} (porta ${VPS_PORT})"

# ── Impostazione autenticazione SSH ──────────────────────────────────────────

SSH_KEY_FILE=""

# Opzione 1: chiave privata da secret Cursor (base64)
if [[ -n "${SGQ_SSH_KEY_B64:-}" ]]; then
    SSH_KEY_FILE="$(mktemp /tmp/sgq_ssh_key_XXXXXX)"
    chmod 600 "${SSH_KEY_FILE}"
    echo "${SGQ_SSH_KEY_B64}" | base64 -d > "${SSH_KEY_FILE}"
    echo "  [auth] Chiave SSH da variabile SGQ_SSH_KEY_B64"
    trap 'rm -f "${SSH_KEY_FILE}"' EXIT
fi

# Opzione 2: file chiave già presente
if [[ -z "${SSH_KEY_FILE}" ]]; then
    for candidate in ~/.ssh/id_rsa_sgq ~/.ssh/id_ed25519_sgq ~/.ssh/id_ed25519 ~/.ssh/id_rsa; do
        if [[ -f "${candidate}" ]]; then
            SSH_KEY_FILE="${candidate}"
            echo "  [auth] Chiave SSH da file: ${candidate}"
            break
        fi
    done
fi

# Opzione 3: password SSH via sshpass
USE_SSHPASS=false
if [[ -z "${SSH_KEY_FILE}" ]] && [[ -n "${SGQ_SSH_PASSWORD:-}" ]]; then
    if command -v sshpass &>/dev/null; then
        USE_SSHPASS=true
        echo "  [auth] Password SSH da variabile SGQ_SSH_PASSWORD (via sshpass)"
    else
        echo "❌ sshpass non disponibile e nessuna chiave SSH trovata."
        echo "   Configura SGQ_SSH_KEY_B64 nei Cursor Cloud Secrets."
        exit 1
    fi
fi

if [[ -z "${SSH_KEY_FILE}" ]] && [[ "${USE_SSHPASS}" == "false" ]]; then
    echo "❌ Nessun metodo di autenticazione SSH configurato."
    echo ""
    echo "   Soluzioni:"
    echo "   1. Aggiungi SGQ_SSH_KEY_B64 in Cursor Dashboard → Cloud Agents → Secrets"
    echo "      (base64 -w0 <tua_chiave_privata>)"
    echo "   2. Metti la chiave privata in ~/.ssh/id_rsa_sgq o ~/.ssh/id_ed25519_sgq"
    echo "   3. Installa sshpass e imposta SGQ_SSH_PASSWORD"
    exit 1
fi

# ── Funzioni SSH/SCP ──────────────────────────────────────────────────────────

SSH_OPTS=(
    -o StrictHostKeyChecking=accept-new
    -o BatchMode=yes
    -o ConnectTimeout=15
    -p "${VPS_PORT}"
)

if [[ -n "${SSH_KEY_FILE}" ]]; then
    SSH_OPTS+=(-i "${SSH_KEY_FILE}")
fi

ssh_run() {
    if [[ "${USE_SSHPASS}" == "true" ]]; then
        sshpass -e -p "${SGQ_SSH_PASSWORD}" ssh "${SSH_OPTS[@]}" "${VPS}" "$@"
    else
        ssh "${SSH_OPTS[@]}" "${VPS}" "$@"
    fi
}

scp_file() {
    local local_path="$1"
    local remote_path="$2"
    if [[ ! -f "${local_path}" ]]; then
        echo "  ⚠ File non trovato (saltato): ${local_path}"
        return 0
    fi
    echo "  -> ${local_path##"${BACKEND_ROOT}/"} → ${remote_path}"
    if [[ "${USE_SSHPASS}" == "true" ]]; then
        sshpass -e -p "${SGQ_SSH_PASSWORD}" scp -P "${VPS_PORT}" -o StrictHostKeyChecking=accept-new "${local_path}" "${VPS}:${remote_path}"
    else
        scp -P "${VPS_PORT}" -o StrictHostKeyChecking=accept-new ${SSH_KEY_FILE:+-i "${SSH_KEY_FILE}"} "${local_path}" "${VPS}:${remote_path}"
    fi
}

# ── Preflight SSH ─────────────────────────────────────────────────────────────

echo ""
echo "Preflight SSH..."
ssh_run "echo OK preflight" || {
    echo "❌ Connessione SSH fallita. Verificare credenziali e firewall."
    exit 1
}
echo "  ✓ SSH OK"

# ── Copia file backend ────────────────────────────────────────────────────────

echo ""
echo "Copia controller, route, service, middleware..."

# Controllers
scp_file "${BACKEND_ROOT}/src/controllers/audit.controller.js"         "${REMOTE_BASE}/src/controllers/audit.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/sync.controller.js"          "${REMOTE_BASE}/src/controllers/sync.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/nc.controller.js"            "${REMOTE_BASE}/src/controllers/nc.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/customChecklist.controller.js" "${REMOTE_BASE}/src/controllers/customChecklist.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/admin.controller.js"         "${REMOTE_BASE}/src/controllers/admin.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/auditorOrg.controller.js"    "${REMOTE_BASE}/src/controllers/auditorOrg.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/organization.controller.js"  "${REMOTE_BASE}/src/controllers/organization.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/auth.controller.js"          "${REMOTE_BASE}/src/controllers/auth.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/auditEvents.controller.js"   "${REMOTE_BASE}/src/controllers/auditEvents.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/response.controller.js"      "${REMOTE_BASE}/src/controllers/response.controller.js"
scp_file "${BACKEND_ROOT}/src/controllers/attachment.controller.js"    "${REMOTE_BASE}/src/controllers/attachment.controller.js"

# Routes
scp_file "${BACKEND_ROOT}/src/routes/audit.routes.js"                  "${REMOTE_BASE}/src/routes/audit.routes.js"
scp_file "${BACKEND_ROOT}/src/routes/customChecklist.routes.js"        "${REMOTE_BASE}/src/routes/customChecklist.routes.js"
scp_file "${BACKEND_ROOT}/src/routes/admin.routes.js"                  "${REMOTE_BASE}/src/routes/admin.routes.js"
scp_file "${BACKEND_ROOT}/src/routes/organization.routes.js"           "${REMOTE_BASE}/src/routes/organization.routes.js"

# WebDAV (Sprint 12)
scp_file "${BACKEND_ROOT}/src/controllers/webdav.controller.js"        "${REMOTE_BASE}/src/controllers/webdav.controller.js"
scp_file "${BACKEND_ROOT}/src/routes/webdav.routes.js"                 "${REMOTE_BASE}/src/routes/webdav.routes.js"

# Entry point
scp_file "${BACKEND_ROOT}/src/server.js"                               "${REMOTE_BASE}/src/server.js"

# Middleware JWT/RBAC
scp_file "${BACKEND_ROOT}/src/middleware/auth.middleware.js"           "${REMOTE_BASE}/src/middleware/auth.middleware.js"

# Services
scp_file "${BACKEND_ROOT}/src/services/auditMaintenance.service.js"    "${REMOTE_BASE}/src/services/auditMaintenance.service.js"
scp_file "${BACKEND_ROOT}/src/services/auditListRbac.service.js"       "${REMOTE_BASE}/src/services/auditListRbac.service.js"
scp_file "${BACKEND_ROOT}/src/services/auditLock.service.js"           "${REMOTE_BASE}/src/services/auditLock.service.js"
scp_file "${BACKEND_ROOT}/src/services/auditNumberAllocation.service.js" "${REMOTE_BASE}/src/services/auditNumberAllocation.service.js"
scp_file "${BACKEND_ROOT}/src/services/customChecklist.service.js"     "${REMOTE_BASE}/src/services/customChecklist.service.js"
scp_file "${BACKEND_ROOT}/src/services/reportTemplate.service.js"      "${REMOTE_BASE}/src/services/reportTemplate.service.js"

echo ""
echo "✓ Tutti i file copiati."

# ── Restart servizio sul VPS ──────────────────────────────────────────────────

echo ""
echo "Riavvio backend (sgq-backend.service)..."

RESTART_CMD='
set -e
cd '"${REMOTE_BASE}"'
OLD_PID=$(systemctl show sgq-backend.service --property=MainPID --value 2>/dev/null || echo 0)
echo "  PID attuale: ${OLD_PID}"

RESTARTED=0
# Tenta prima con password (più affidabile del nopass: evita race systemd)
if [ -n "'"${SGQ_SUDO_PASSWORD:-}"'" ]; then
    echo "'"${SGQ_SUDO_PASSWORD:-}"'" | sudo -S systemctl restart sgq-backend.service && {
        echo deploy_systemctl_password_ok
        RESTARTED=1
    }
fi
if [ "$RESTARTED" != "1" ]; then
    sudo -n systemctl restart sgq-backend.service 2>/dev/null && {
        echo deploy_systemctl_nopass_ok
        RESTARTED=1
    }
fi
if [ "$RESTARTED" != "1" ]; then
    echo deploy_fallback_fuser_nohup
    fuser -k 3000/tcp 2>/dev/null || true
    sleep 3
    nohup node src/server.js >> '"${REMOTE_BASE}"'/app.log 2>&1 &
    sleep 4
fi

sleep 3
NEW_PID=$(systemctl show sgq-backend.service --property=MainPID --value 2>/dev/null || echo 0)
echo "  PID dopo restart: ${NEW_PID}"
if [ "$OLD_PID" = "$NEW_PID" ] && [ "$OLD_PID" != "0" ]; then
    echo "  ⚠ ATTENZIONE: PID invariato — il processo potrebbe non essersi riavviato!"
else
    echo "  ✓ Processo riavviato correttamente"
fi

systemctl --no-pager --full status sgq-backend.service 2>/dev/null | tail -10 || true
tail -10 '"${REMOTE_BASE}"'/app.log || true
'

ssh_run "bash -s" <<< "${RESTART_CMD}" || {
    echo "⚠ Restart fallito o parziale. Verificare: GET /api/v1/health"
    exit 1
}

# ── Verifica health ───────────────────────────────────────────────────────────

echo ""
echo "Verifica health API..."
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${VPS_HOST}:8443/api/v1/health" || echo "000")
if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "  ✓ Health API OK (200)"
else
    echo "  ⚠ Health API risposta: ${HTTP_CODE} (potrebbe servire qualche secondo in più)"
fi

echo ""
echo "=== DEPLOY COMPLETATO ==="
echo "    Verifica manuale: GET https://${VPS_HOST}:8443/api/v1/health"
