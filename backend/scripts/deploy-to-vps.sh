#!/usr/bin/env bash
# Deploy backend sul VPS — versione Linux/bash (Cloud Agent / WSL)
# Equivalente di deploy-controllers-to-vps.ps1 — usa lo stesso deploy-manifest.json
#
# Uso: bash backend/scripts/deploy-to-vps.sh
# Secrets Cursor: SGQ_SSH_KEY_B64, SGQ_SUDO_PASSWORD (opzionale)

set -euo pipefail

VPS_USER="spascarella"
VPS_HOST="busato.selfip.com"
VPS_PORT="1122"
VPS="${VPS_USER}@${VPS_HOST}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST="${SCRIPT_DIR}/deploy-manifest.json"
HEALTH_URL="${SGQ_HEALTH_URL:-https://${VPS_HOST}:8443/api/v1/health}"

if [[ ! -f "${MANIFEST}" ]]; then
    echo "❌ Manifest non trovato: ${MANIFEST}"
    exit 1
fi

REMOTE_BASE="${SGQ_REMOTE_BASE:-$(python3 -c "import json; print(json.load(open('${MANIFEST}', encoding='utf-8-sig')).get('remoteBase','/var/www/sgq-backend'))")}"
SYSTEMD_SERVICE="${SGQ_SYSTEMD_SERVICE:-sgq-backend.service}"

echo "=== Deploy SGQ Backend → VPS ==="
echo "    Backend locale : ${BACKEND_ROOT}"
echo "    Destinazione   : ${VPS}:${REMOTE_BASE} (porta ${VPS_PORT})"
echo "    Manifest       : ${MANIFEST}"

# ── Autenticazione SSH ────────────────────────────────────────────────────────

SSH_KEY_FILE=""

if [[ -n "${SGQ_SSH_KEY_B64:-}" ]]; then
    SSH_KEY_FILE="$(mktemp /tmp/sgq_ssh_key_XXXXXX)"
    chmod 600 "${SSH_KEY_FILE}"
    echo "${SGQ_SSH_KEY_B64}" | base64 -d > "${SSH_KEY_FILE}"
    echo "  [auth] Chiave SSH da SGQ_SSH_KEY_B64"
    trap 'rm -f "${SSH_KEY_FILE}"' EXIT
fi

if [[ -z "${SSH_KEY_FILE}" ]]; then
    for candidate in ~/.ssh/id_rsa_sgq ~/.ssh/id_ed25519_sgq ~/.ssh/id_ed25519 ~/.ssh/id_rsa; do
        if [[ -f "${candidate}" ]]; then
            SSH_KEY_FILE="${candidate}"
            echo "  [auth] Chiave SSH: ${candidate}"
            break
        fi
    done
fi

USE_SSHPASS=false
if [[ -z "${SSH_KEY_FILE}" ]] && [[ -n "${SGQ_SSH_PASSWORD:-}" ]]; then
    if command -v sshpass &>/dev/null; then
        USE_SSHPASS=true
        echo "  [auth] Password SSH via sshpass"
    else
        echo "❌ sshpass non disponibile e nessuna chiave SSH."
        exit 1
    fi
fi

if [[ -z "${SSH_KEY_FILE}" ]] && [[ "${USE_SSHPASS}" == "false" ]]; then
    echo "❌ Nessun metodo SSH. Configura SGQ_SSH_KEY_B64 o chiave locale."
    exit 1
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=15 -p "${VPS_PORT}")
[[ -n "${SSH_KEY_FILE}" ]] && SSH_OPTS+=(-i "${SSH_KEY_FILE}")

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
    echo "  -> ${local_path##"${BACKEND_ROOT}/"}"
    if [[ "${USE_SSHPASS}" == "true" ]]; then
        sshpass -e -p "${SGQ_SSH_PASSWORD}" scp -P "${VPS_PORT}" -o StrictHostKeyChecking=accept-new "${local_path}" "${VPS}:${remote_path}"
    else
        scp -P "${VPS_PORT}" -o StrictHostKeyChecking=accept-new ${SSH_KEY_FILE:+-i "${SSH_KEY_FILE}"} "${local_path}" "${VPS}:${remote_path}"
    fi
}

# ── Preflight locale: tutti i file del manifest ───────────────────────────────

echo ""
echo "Preflight locale (manifest)..."
MISSING="$(python3 <<PY
import json, os, sys
m = json.load(open("${MANIFEST}", encoding="utf-8-sig"))
root = "${BACKEND_ROOT}"
missing = []
for g in m.get("groups", []):
    for rel in g.get("files", []):
        p = os.path.join(root, rel.replace("/", os.sep))
        if not os.path.isfile(p):
            missing.append(rel)
if missing:
    print("\\n".join(missing))
    sys.exit(1)
print(f"OK — {sum(len(g.get('files',[])) for g in m.get('groups',[]))} file")
PY
)" || {
    echo "❌ File mancanti nel workspace:"
    echo "${MISSING}"
    exit 1
}
echo "  ✓ ${MISSING}"

echo ""
echo "Preflight SSH..."
ssh_run "echo OK preflight" || { echo "❌ Connessione SSH fallita."; exit 1; }
echo "  ✓ SSH OK"

# Directory remote
DIRS="$(python3 -c "import json; print(' '.join(json.load(open('${MANIFEST}', encoding='utf-8-sig')).get('ensureRemoteDirs',[])))")"
if [[ -n "${DIRS}" ]]; then
    echo ""
    echo "Creazione directory remote..."
    for d in ${DIRS}; do
        ssh_run "mkdir -p ${REMOTE_BASE}/${d}"
    done
fi

# ── Copia file per gruppo ─────────────────────────────────────────────────────

echo ""
echo "Copia file (ordine manifest)..."

LAST_GROUP=""
while IFS='|' read -r group rel; do
    [[ -n "${group}" ]] || continue
    if [[ "${LAST_GROUP}" != "${group}" ]]; then
        echo "[${group}]"
        LAST_GROUP="${group}"
    fi
    local_path="${BACKEND_ROOT}/${rel}"
    remote_path="${REMOTE_BASE}/${rel}"
    scp_file "${local_path}" "${remote_path}"
done < <(python3 <<PY
import json
m = json.load(open("${MANIFEST}", encoding="utf-8-sig"))
for g in m.get("groups", []):
    for rel in g.get("files", []):
        print(f"{g['name']}|{rel}")
PY
)

echo ""
echo "✓ Tutti i file copiati."

# ── Restart ───────────────────────────────────────────────────────────────────

echo ""
echo "Riavvio backend (${SYSTEMD_SERVICE})..."

RESTART_CMD='
set -e
cd '"${REMOTE_BASE}"'
OLD_PID=$(systemctl show '"${SYSTEMD_SERVICE}"' --property=MainPID --value 2>/dev/null || echo 0)
echo "  PID attuale: ${OLD_PID}"
RESTARTED=0
if [ -n "'"${SGQ_SUDO_PASSWORD:-}"'" ]; then
    echo "'"${SGQ_SUDO_PASSWORD:-}"'" | sudo -S systemctl restart '"${SYSTEMD_SERVICE}"' && {
        echo deploy_systemctl_password_ok
        RESTARTED=1
    }
fi
if [ "$RESTARTED" != "1" ]; then
    sudo -n systemctl restart '"${SYSTEMD_SERVICE}"' 2>/dev/null && {
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
NEW_PID=$(systemctl show '"${SYSTEMD_SERVICE}"' --property=MainPID --value 2>/dev/null || echo 0)
echo "  PID dopo restart: ${NEW_PID}"
grep -q normUpload.routes.js '"${REMOTE_BASE}"'/src/server.js && echo deploy_norm_upload_route_ok || echo deploy_norm_upload_route_MISSING
grep -q ncResponsibleOptions '"${REMOTE_BASE}"'/src/controllers/nc.controller.js && echo deploy_nc_responsible_ok || echo deploy_nc_responsible_MISSING
systemctl --no-pager --full status '"${SYSTEMD_SERVICE}"' 2>/dev/null | tail -10 || true
tail -10 '"${REMOTE_BASE}"'/app.log || true
'

ssh_run "bash -s" <<< "${RESTART_CMD}" || {
    echo "⚠ Restart fallito o parziale."
    exit 1
}

# ── Health check ──────────────────────────────────────────────────────────────

echo ""
echo "Verifica health API..."
sleep 3
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 15 "${HEALTH_URL}" || echo "000")
if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "  ✓ Health API OK (200) — ${HEALTH_URL}"
else
    echo "  ❌ Health API risposta: ${HTTP_CODE} (${HEALTH_URL})"
    exit 1
fi

echo ""
echo "=== DEPLOY COMPLETATO ==="
echo "    Smoke: npm run smoke:deploy (da backend/)"
