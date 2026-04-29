# DEPUTYTASK — Chiusura sprint sync: deploy backend + migrazione T1 + fix CORS

> **Prerequisito**: i Cursor Cloud Secrets `SGQ_SSH_KEY_B64`, `SGQ_SUDO_PASSWORD`,
> `DB_SERVER`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` devono essere
> configurati (sono già stati impostati il 28/04/2026).
>
> Usa **`bash backend/scripts/deploy-to-vps.sh`** e
> **`bash backend/scripts/run-migration-agent.sh <N>`** — non usare pscp/plink.

---

## Contesto

Tre operazioni in sospeso per chiudere lo sprint sync (SYNC-1/2/3/4 + T1):

| # | Operazione | Perché serve |
|---|---|---|
| 1 | **Deploy backend** (`audit.controller.js`) | SYNC-2: field-level merge sul server — senza questo il 409 conflict scarta ancora i testi modificati |
| 2 | **Migrazione DB 045** (temporal tables) | T1: storicizzazione automatica audit_responses + audits per compliance ISO §7.5 |
| 3 | **Fix CORS su `.env` VPS** | Il dominio `sistema-gestione-iso9001.netlify.app` non è ancora nella lista CORS — blocca le chiamate API dal browser |

---

## Step 1 — Verifica segreti disponibili

```bash
env | grep -E "^(SGQ_|DB_)" | sed 's/=.*/=***/'
```

Devono comparire tutti e 7. Se mancano, fermarsi e segnalarlo.

---

## Step 2 — Deploy backend (SYNC-2 + tutti i file aggiornati)

```bash
bash backend/scripts/deploy-to-vps.sh
```

Lo script copia `audit.controller.js` + tutti i controller/route/service/middleware
e fa `systemctl restart sgq-backend`. Attendere la conferma `✓ Health API OK (200)`.

---

## Step 3 — Fix CORS nel `.env` sul VPS

Dopo il deploy, aggiorna il file `.env` sul VPS via SSH:

```bash
SGQ_KEY_FILE=$(mktemp /tmp/sgq_XXXXXX)
chmod 600 "$SGQ_KEY_FILE"
echo "$SGQ_SSH_KEY_B64" | base64 -d > "$SGQ_KEY_FILE"

ssh -i "$SGQ_KEY_FILE" -o StrictHostKeyChecking=accept-new -p 1122 \
  spascarella@www.fr-busato.it \
  "sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://sistema-gestione-iso9001.netlify.app,https://systemgest.netlify.app,http://localhost:5173|' /var/www/sgq-backend/.env && grep CORS_ORIGIN /var/www/sgq-backend/.env"

rm -f "$SGQ_KEY_FILE"
```

Output atteso:
```
CORS_ORIGIN=https://sistema-gestione-iso9001.netlify.app,https://systemgest.netlify.app,http://localhost:5173
```

Poi riavvia:
```bash
SGQ_KEY_FILE=$(mktemp /tmp/sgq_XXXXXX)
chmod 600 "$SGQ_KEY_FILE"
echo "$SGQ_SSH_KEY_B64" | base64 -d > "$SGQ_KEY_FILE"
ssh -i "$SGQ_KEY_FILE" -o StrictHostKeyChecking=accept-new -p 1122 \
  spascarella@www.fr-busato.it \
  "echo '$SGQ_SUDO_PASSWORD' | sudo -S systemctl restart sgq-backend.service && sleep 3 && sudo systemctl status sgq-backend | head -8"
rm -f "$SGQ_KEY_FILE"
```

---

## Step 4 — Migrazione DB 045 (temporal tables T1)

```bash
bash backend/scripts/run-migration-agent.sh 045 production
```

La migrazione è idempotente (`IF NOT EXISTS`): se T1 era già stato eseguito, termina senza errori.

Output atteso a fine script:
```
=== MIGRATION COMPLETATA ===
```

---

## Step 5 — Verifica CORS post-deploy

```bash
curl -s -X OPTIONS "https://www.fr-busato.it:8443/api/v1/audits/sync" \
  -H "Origin: https://sistema-gestione-iso9001.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization,X-Audit-Lock-Token" \
  -D - 2>&1 | grep -E "Access-Control|HTTP/"
```

Output atteso:
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://sistema-gestione-iso9001.netlify.app
```

---

## Step 6 — Verifica field-level merge attivo sul VPS

```bash
SGQ_KEY_FILE=$(mktemp /tmp/sgq_XXXXXX)
chmod 600 "$SGQ_KEY_FILE"
echo "$SGQ_SSH_KEY_B64" | base64 -d > "$SGQ_KEY_FILE"
ssh -i "$SGQ_KEY_FILE" -o StrictHostKeyChecking=accept-new -p 1122 \
  spascarella@www.fr-busato.it \
  "grep -c 'field-level merge' /var/www/sgq-backend/src/controllers/audit.controller.js"
rm -f "$SGQ_KEY_FILE"
```

Output atteso: `3` o più (righe con "field-level merge" nel controller).

---

## Definition of Done

- [ ] `deploy-to-vps.sh` → exit 0 + health 200
- [ ] CORS_ORIGIN aggiornato sul VPS con entrambi i domini Netlify
- [ ] `systemctl status sgq-backend` → `active (running)`
- [ ] Migrazione 045 → `MIGRATION COMPLETATA` (o già presente)
- [ ] `grep -c 'field-level merge' audit.controller.js` sul VPS → ≥ 3
- [ ] CORS preflight risponde `Access-Control-Allow-Origin: https://sistema-gestione-iso9001.netlify.app`

Chiudi con **TEST OK** o **FIX NON APPLICABILI** elencando l'esito di ogni step.
