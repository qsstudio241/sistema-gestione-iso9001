#!/usr/bin/env bash
# Esegui migration DB dal Cloud Agent Cursor
#
# USO:
#   bash backend/scripts/run-migration-agent.sh 019
#   bash backend/scripts/run-migration-agent.sh 040 production
#
# SEGRETI CURSOR necessari (Dashboard → Cloud Agents → Secrets):
#   DB_SERVER   = www.fr-busato.it,11043
#   DB_PORT     = 11043
#   DB_DATABASE = SGQ_ISO9001
#   DB_USER     = <utente SQL>
#   DB_PASSWORD = <password SQL>
#
# NODE_ENV (secondo argomento, default: production) controlla quale sezione
# di database.json viene usata; con le variabili DB_* i valori file vengono
# comunque sovrascritti, quindi il file database.json locale non è necessario
# se i segreti Cursor sono configurati.

set -euo pipefail

MIGRATION_NUM="${1:-}"
NODE_ENV="${2:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -z "${MIGRATION_NUM}" ]]; then
    echo "Uso: $0 <numero_migration> [production|development]"
    echo "     Es: $0 019"
    echo "     Es: $0 040 production"
    exit 1
fi

# Padded (es. "19" → "019")
PADDED=$(printf "%03d" "${MIGRATION_NUM}" 2>/dev/null || echo "${MIGRATION_NUM}")
SCRIPT_FILE="${SCRIPT_DIR}/run-migration-${PADDED}.js"

if [[ ! -f "${SCRIPT_FILE}" ]]; then
    echo "❌ Script non trovato: ${SCRIPT_FILE}"
    echo "   Migration disponibili:"
    ls "${SCRIPT_DIR}"/run-migration-*.js 2>/dev/null | xargs -I{} basename {} || echo "   (nessuna)"
    exit 1
fi

# Verifica segreti DB minimi
MISSING=()
[[ -z "${DB_SERVER:-}" ]]   && MISSING+=("DB_SERVER")
[[ -z "${DB_DATABASE:-}" ]] && MISSING+=("DB_DATABASE")
[[ -z "${DB_USER:-}" ]]     && MISSING+=("DB_USER")
[[ -z "${DB_PASSWORD:-}" ]] && MISSING+=("DB_PASSWORD")

if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo "❌ Variabili d'ambiente DB mancanti: ${MISSING[*]}"
    echo ""
    echo "   Aggiungile in Cursor Dashboard → Cloud Agents → Secrets:"
    echo "     DB_SERVER   = www.fr-busato.it,11043"
    echo "     DB_PORT     = 11043"
    echo "     DB_DATABASE = SGQ_ISO9001"
    echo "     DB_USER     = <utente SQL>"
    echo "     DB_PASSWORD = <password SQL>"
    exit 1
fi

# Crea database.json temporaneo se non esiste (mergeDbEnv.js ne ha bisogno come fallback)
DB_JSON="${BACKEND_ROOT}/config/database.json"
DB_JSON_CREATED=false
if [[ ! -f "${DB_JSON}" ]]; then
    DB_JSON_CREATED=true
    cat > "${DB_JSON}" <<DBJSON
{
  "production": {
    "server": "${DB_SERVER}",
    "port": ${DB_PORT:-11043},
    "database": "${DB_DATABASE}",
    "user": "${DB_USER}",
    "password": "${DB_PASSWORD}",
    "options": { "encrypt": true, "trustServerCertificate": true, "enableArithAbort": true }
  },
  "development": {
    "server": "${DB_SERVER}",
    "port": ${DB_PORT:-11043},
    "database": "${DB_DATABASE}",
    "user": "${DB_USER}",
    "password": "${DB_PASSWORD}",
    "options": { "encrypt": true, "trustServerCertificate": true, "enableArithAbort": true }
  }
}
DBJSON
    echo "  [info] database.json temporaneo creato (gitignored)"
    # Rimuovi alla fine anche in caso di errore
    trap 'rm -f "${DB_JSON}"' EXIT
fi

echo "=== Migration SGQ DB ==="
echo "    Script  : $(basename "${SCRIPT_FILE}")"
echo "    Server  : ${DB_SERVER}"
echo "    Database: ${DB_DATABASE}"
echo "    Env     : ${NODE_ENV}"
echo ""

cd "${BACKEND_ROOT}"
NODE_ENV="${NODE_ENV}" node "${SCRIPT_FILE}"
EXIT_CODE=$?

if [[ "${DB_JSON_CREATED}" == "true" ]]; then
    rm -f "${DB_JSON}"
fi

if [[ ${EXIT_CODE} -eq 0 ]]; then
    echo ""
    echo "=== MIGRATION COMPLETATA ==="
else
    echo ""
    echo "❌ Migration fallita (exit ${EXIT_CODE})"
    exit ${EXIT_CODE}
fi
