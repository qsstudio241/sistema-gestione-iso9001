#!/bin/bash
# Smoke test per audit_conclusions AI
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sgq.local","password":"Sistemi@2026"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

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
