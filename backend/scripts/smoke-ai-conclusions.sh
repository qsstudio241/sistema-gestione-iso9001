#!/bin/bash
# Smoke test per audit_conclusions AI
SGQ_APP_EMAIL="${SGQ_APP_EMAIL:-admin@sgq.local}"
: "${SGQ_APP_PASSWORD:?Imposta SGQ_APP_PASSWORD (vedi docs/how-to/ACCESSO_DEPLOY_AGENTS.md)}"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SGQ_APP_EMAIL\",\"password\":\"$SGQ_APP_PASSWORD\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERRORE: login fallito"
  exit 1
fi
echo "Login OK, token ottenuto"

RESULT=$(curl -s -X POST http://localhost:3000/api/v1/ai/suggest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  --max-time 90 \
  -d '{
    "feature": "audit_conclusions",
    "context": {
      "auditMetrics": {"total": 25, "nc": 2, "oss": 3, "om": 1, "nv": 0, "conformities": 19},
      "standardCodes": ["ISO_9001_2015"],
      "findings": [
        {"clauseRef": "7.1.3", "status": "NON_COMPLIANT", "notes": "Mancata taratura strumenti", "standardCode": "ISO_9001_2015"},
        {"clauseRef": "8.5.1", "status": "NON_COMPLIANT", "notes": "Istruzioni operative non aggiornate", "standardCode": "ISO_9001_2015"},
        {"clauseRef": "9.1.1", "status": "OBSERVATION", "notes": "KPI non sempre monitorati mensilmente", "standardCode": "ISO_9001_2015"}
      ],
      "existingConclusions": "",
      "auditObject": "Audit interno annuale SGQ"
    }
  }')

echo ""
echo "=== RISPOSTA AI ==="
echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
