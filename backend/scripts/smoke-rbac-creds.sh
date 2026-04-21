#!/bin/bash
cd /var/www/sgq-backend
BASE=http://localhost:3000/api/v1

echo "=== SMOKE: health ==="
curl -s -o /dev/null -w "HTTP %{http_code}" $BASE/health
echo ""

declare -A USERS
USERS["andrea.mason@mason-cs.com"]="Mason2026!"
USERS["marcocamellini@gmail.com"]="Camellini2026!"

for EMAIL in "andrea.mason@mason-cs.com" "marcocamellini@gmail.com"; do
  PASS="${USERS[$EMAIL]}"
  echo ""
  echo "=== USER: $EMAIL ==="
  LOGIN=$(curl -s -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  SUCCESS=$(echo $LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','?'))" 2>/dev/null)
  TOKEN=$(echo $LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','NO_TOKEN'))" 2>/dev/null)
  echo "  login.success=$SUCCESS  token_len=${#TOKEN}"

  if [ "$TOKEN" != "NO_TOKEN" ] && [ ${#TOKEN} -gt 20 ]; then
    AUD=$(curl -s $BASE/audits -H "Authorization: Bearer $TOKEN")
    NUMS=$(echo $AUD | python3 -c "
import sys,json
d=json.load(sys.stdin)
lst = d if isinstance(d,list) else d.get('data',[])
nums = [x.get('audit_number',x.get('auditNumber','?')) for x in lst]
print('count='+str(len(nums))+' audits='+str(nums))
" 2>/dev/null || echo "parse_err: $(echo $AUD | head -c 100)")
    echo "  GET /audits => $NUMS"
  else
    echo "  login FAILED: $(echo $LOGIN | head -c 150)"
  fi
done