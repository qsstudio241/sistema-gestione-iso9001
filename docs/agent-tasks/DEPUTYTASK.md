# DEPUTYTASK — Deploy Gestione Documentale Avanzata + Smoke Test

## Obiettivo
Eseguire le 4 migration SQL, il seed dei tag di sistema, il deploy backend sul VPS e uno smoke test completo delle nuove API.

## Pre-condizioni
- Il commit `28d850e` è già su `main` (push completato)
- Netlify build frontend è in corso automaticamente
- Le variabili `SGQ_SSH_KEY_B64` e `SGQ_SUDO_PASSWORD` devono essere disponibili come Cloud Secrets

## Step 1 — Setup SSH
```bash
echo "$SGQ_SSH_KEY_B64" | base64 -d > /tmp/sgq_key && chmod 600 /tmp/sgq_key
SSH_CMD="ssh -i /tmp/sgq_key -p 1122 -o StrictHostKeyChecking=no spascarella@www.fr-busato.it"
SCP_CMD="scp -i /tmp/sgq_key -P 1122 -o StrictHostKeyChecking=no"
```

## Step 2 — Pull codice sul VPS
```bash
$SSH_CMD "cd /var/www/sgq-backend && git pull origin main"
```
Verificare che l'output mostri i file nuovi (controllers, routes, services, migrations).

## Step 3 — Eseguire le 4 migration SQL
Creare uno script runner e copiarlo sul VPS:

```bash
cat > /tmp/run-migrations-056-059.js << 'SCRIPT'
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const dbConfig = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await dbConfig.getPool();
    const migrationsDir = '/var/www/sgq-backend/database/migrations';
    const files = [
        '056_document_tags.sql',
        '057_document_tree_and_relations.sql',
        '058_document_history.sql',
        '059_document_tree_templates.sql',
    ];

    for (const file of files) {
        console.log(`\n=== Esecuzione ${file} ===`);
        const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        // Splitta per GO ed esegui ogni batch separatamente
        const batches = sqlText.split(/^\s*GO\s*$/gim).filter(b => b.trim());
        for (const batch of batches) {
            try {
                await pool.request().query(batch);
            } catch (err) {
                // Ignora errori di "già esiste" (idempotenza)
                if (err.message.includes('already') || err.message.includes('There is already')) {
                    console.log(`  (già presente, skip)`);
                } else {
                    console.error(`  ERRORE: ${err.message}`);
                }
            }
        }
        console.log(`  ${file} completato`);
    }
    console.log('\nTutte le migration completate.');
    process.exit(0);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
SCRIPT

$SCP_CMD /tmp/run-migrations-056-059.js spascarella@www.fr-busato.it:/tmp/
$SSH_CMD "cd /var/www/sgq-backend && node /tmp/run-migrations-056-059.js"
```

## Step 4 — Seed tag di sistema
```bash
$SCP_CMD backend/scripts/seed-system-tags.js spascarella@www.fr-busato.it:/tmp/
$SSH_CMD "cd /var/www/sgq-backend && node /tmp/seed-system-tags.js"
```
Verificare output: 4 categorie + ~19 tag creati (o "già presente" se ripetuto).

## Step 5 — Restart backend
```bash
$SSH_CMD "echo '$SGQ_SUDO_PASSWORD' | sudo -S systemctl restart sgq-backend.service && sleep 3 && sudo systemctl status sgq-backend | head -5"
```
Verificare: `Active: active (running)`.

## Step 6 — Smoke test API

### 6.1 Health check
```bash
curl -sk https://www.fr-busato.it:8443/api/v1/health
```
Atteso: `{"status":"ok",...}`

### 6.2 Login (ottenere token)
```bash
TOKEN=$(curl -sk https://www.fr-busato.it:8443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
```
Se le credenziali di test non funzionano, usare qualsiasi utente valido. L'importante è ottenere un token JWT.

### 6.3 Test nuove API (con token)
```bash
# Albero documentale
curl -sk https://www.fr-busato.it:8443/api/v1/documents/tree \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20

# Tag di sistema
curl -sk https://www.fr-busato.it:8443/api/v1/document-tags \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30

# Categorie tag
curl -sk https://www.fr-busato.it:8443/api/v1/tag-categories \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Template albero
curl -sk https://www.fr-busato.it:8443/api/v1/document-tree-templates \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20

# History di un documento (se ne esiste almeno uno — usa id=1 o un id valido)
curl -sk https://www.fr-busato.it:8443/api/v1/documents/1/history \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -10
```

### 6.4 Test provisioning albero (opzionale ma consigliato)
Se esiste almeno una company (usa id reale), provisionare l'albero Camellini:
```bash
curl -sk -X POST https://www.fr-busato.it:8443/api/v1/documents/provision-tree \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"company_id": 1, "standard_codes": ["ISO_9001"]}' | python3 -m json.tool | head -30
```
Atteso: lista cartelle create (15 cartelle madre per ISO 9001, meno quelle condizionate a 14001/45001).

Dopo il provisioning, ri-verificare l'albero:
```bash
curl -sk https://www.fr-busato.it:8443/api/v1/documents/tree?company_id=1 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -40
```

## Step 7 — Verifica frontend
Verificare che la build Netlify sia completata:
```bash
curl -sI https://sistema-gestione-iso9001.netlify.app | head -5
```
Se risponde 200, la build è OK. La nuova tab "Albero" sarà visibile nel Registro Documenti.

## Esito atteso
Riportare per ogni step: OK o ERRORE con dettaglio.
Chiudere con: **TEST OK** o **FIX NECESSARIO: [descrizione]**
