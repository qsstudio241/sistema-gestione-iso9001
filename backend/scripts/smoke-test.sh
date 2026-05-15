#!/bin/bash
set -e

BASE="http://localhost:3000/api/v1"
echo "=== 6.1 Health ==="
curl -s "$BASE/health" | python3 -m json.tool

echo ""
echo "=== 6.2 Login ==="
LOGIN=$(curl -s "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sgq.local","password":"Admin2026!"}')
echo "$LOGIN" | python3 -m json.tool 2>/dev/null | head -5
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',d.get('accessToken','NO_TOKEN')))" 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "NO_TOKEN" ]; then
  echo "ERRORE: token non ottenuto. Risposta login:"
  echo "$LOGIN"
  exit 1
fi
echo "Token ottenuto (${#TOKEN} chars)"

AUTH="-H \"Authorization: Bearer $TOKEN\""

echo ""
echo "=== 6.3a Albero documentale ==="
curl -s "$BASE/documents/tree" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

echo ""
echo "=== 6.3b Tag di sistema ==="
curl -s "$BASE/document-tags" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -30

echo ""
echo "=== 6.3c Categorie tag ==="
curl -s "$BASE/tag-categories" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

echo ""
echo "=== 6.3d Template albero ==="
curl -s "$BASE/document-tree-templates" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

echo ""
echo "=== 6.3e History documento 1 ==="
curl -s "$BASE/documents/1/history" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -10

echo ""
echo "=== 6.4 Provisioning albero company_id=1 ==="
PROV=$(curl -s -X POST "$BASE/documents/provision-tree" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"company_id": 1, "standard_codes": ["ISO_9001"]}')
echo "$PROV" | python3 -m json.tool 2>/dev/null | head -30

echo ""
echo "=== Albero dopo provisioning ==="
curl -s "$BASE/documents/tree?company_id=1" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -40

echo ""
echo "=== SMOKE TEST COMPLETATO ==="
