#!/bin/bash
set -e

BASE_URL="http://localhost:3000/api/v1"
EMAIL="admin@sgq.local"
PASSWORD="Sistemi@2026"

echo "=== 1. Login ==="
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN_RESP" | head -c 200
echo ""

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "ERRORE: token non ottenuto"
  exit 1
fi
echo "Token ottenuto: ${TOKEN:0:20}..."

echo ""
echo "=== 2. Creo PDF di test ==="
python3 -c "
import struct
pdf = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 100 700 Td (ISO 9001:2015 Test) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n430\n%%EOF'
with open('/tmp/test-norm.pdf','wb') as f: f.write(pdf)
print('OK')
"
echo "File PDF di test creato: /tmp/test-norm.pdf"

echo ""
echo "=== 3. Upload norma ==="
UPLOAD_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/documents/norms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/tmp/test-norm.pdf;filename=ISO_9001_2015_test.pdf" \
  -F "category=Norme e Leggi")
HTTP_CODE=$(echo "$UPLOAD_RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$UPLOAD_RESP" | grep -v "HTTP_CODE:")
echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY" | head -c 500
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo ""
  echo "=== SMOKE TEST PASSED ==="
else
  echo ""
  echo "=== SMOKE TEST FAILED (HTTP $HTTP_CODE) ==="
  exit 1
fi
