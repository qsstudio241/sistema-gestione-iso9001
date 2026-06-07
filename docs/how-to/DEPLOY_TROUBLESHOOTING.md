# Deploy troubleshooting (errori ricorrenti + soluzioni)

Questo file raccoglie i problemi che incontriamo piu' spesso durante deploy e test, con la soluzione pratica gia' verificata nel progetto.

## 1) "Endpoint non trovato" (404) su endpoint nuovi

**Sintomi**
- Nel browser/console vedi richieste tipo:
  - `PUT /audits/:id/custom-checklist-responses`
  - risposta: `404 { error: "Endpoint non trovato" }`
- Nel frontend compaiono log tipo: `save CustomChecklistResponses fallito ... Endpoint non trovato`

**Causa probabile**
- Il **backend in produzione (VPS) non e' aggiornato** con le route/entrypoint corretti, oppure il servizio Node non e' stato riavviato dopo la copia file.

**Soluzione**
- Deploy sul VPS dei file minimi necessari + restart:
  - `backend/src/controllers/audit.controller.js`
  - `backend/src/controllers/customChecklist.controller.js`
  - `backend/src/routes/audit.routes.js`
  - `backend/src/routes/customChecklist.routes.js`
  - `backend/src/server.js`
- Usare lo script: `backend/scripts/deploy-controllers-to-vps.ps1` (nonostante il nome, ora include routes + server.js).

## 1.b) Deploy ok ma restart fallisce con errori su `set -e`

**Sintomi**
- Dopo la copia file, il restart stampa errori tipo:
  - `set: usage: ...`
  - `invalid option ...`

**Causa**
- Il comando remoto e' interpretato da una shell non compatibile con `set -e` (o con alcune sintassi).

**Soluzione**
- Eseguire i comandi di restart dentro `bash -lc '...'`.
- Se il backend e' gestito da `systemd`, usare `systemctl restart sgq-backend.service` (preferibile).

## 1.c) Restart via bash fallisce con `... $'\\r': command not found`

**Sintomi**
- Output tipo:
  - `bash: line 1: $'\r': command not found`
  - `cd: $'/var/www/sgq-backend\r': No such file or directory`

**Causa**
- Il comando remoto e' stato inviato con terminatori Windows **CRLF** (contiene `\r`).

**Soluzione**
- Rimuovere i `\r` prima di inviare il comando (es. in PowerShell: `-replace \"`r\", \"\"`).

## 2) `scp`/`ssh` bloccati (password o host key prompt)

**Sintomi**
- Il comando rimane "appeso" senza output.

**Causa**
- Prompt interattivo (password, oppure "Store key in cache? (y/n)").

**Soluzione**
- Usare PuTTY tools in modalita' batch:
  - `pscp -batch ...`
  - `plink -batch ...`
- Se e' la prima connessione su quella macchina, accettare la host key una volta (manuale), poi `-batch` funzionera' sempre.

**Se il batch fallisce con** `FATAL ERROR: Cannot answer interactive prompts in batch mode`
- Significa che **c'e' ancora un prompt** (di solito host key non in cache, oppure password).
- Passo 1 (una sola volta): eseguire manualmente e rispondere ai prompt:
  - `C:\Program Files\PuTTY\plink.exe -P 1122 spascarella@www.fr-busato.it exit`
  - Se chiede `Store key in cache? (y/n)`: rispondere `y`
  - Se chiede password: o la inserisci (una volta) oppure meglio configurare **autenticazione a chiave** (consigliato).
- Poi rieseguire lo script di deploy (che usa `-batch`).

## 2.b) Password SSH: come renderla non-interattiva (consigliato)

Se il VPS richiede password, gli script `-batch` non possono funzionare.

**Soluzione consigliata (robusta): PuTTY sessione salvata con chiave**
- Apri **PuTTY** → Session:
  - Host: `www.fr-busato.it`
  - Port: `1122`
- Connection → Data:
  - Auto-login username: `spascarella`
- Connection → SSH → Auth:
  - configura una **chiave** (ppk) / Pageant (se gia' la usi)
- Salva la sessione con un nome, es. `SGQ-VPS`

Poi lancia lo script con:
- variabile d’ambiente: `SGQ_PUTTY_SESSION=SGQ-VPS`
- e riesegui `backend/scripts/deploy-controllers-to-vps.ps1`

**Soluzione rapida (meno sicura): password via variabile d’ambiente**
- Imposta (solo nella shell corrente) una variabile:
  - `SGQ_SSH_PASSWORD` (NON committare mai password nel repo)
- Esegui lo script: userà `plink/pscp -pw` per evitare prompt.

## 2.c) `sudo -n systemctl restart` fallisce (password richiesta)

**Sintomi**
- Dopo `deploy-controllers-to-vps.ps1` i file su disco sono aggiornati ma le **nuove route** non rispondono; oppure in `/api/v1/health` l’`uptime` resta molto alto come prima del deploy.

**Causa**
- `sudo` senza password non consente il restart di `sgq-backend.service`; il processo Node **vecchio** resta in memoria.

**Soluzione (in ordine)**
1. **Opzione A — password sudo solo per la sessione PowerShell** (mai in repo):  
   `$env:SGQ_SUDO_PASSWORD = '...'` poi rieseguire `deploy-controllers-to-vps.ps1`. Lo script lancia **prima** un `plink` dedicato con `sudo systemctl restart` (password via base64), poi il blocco usuale (`sudo -n` + fallback `fuser`/`nohup`).
2. **Opzione B — come DEPLOY_CHECKLIST_RELEASE.md**: SSH sul server, poi  
   `fuser -k 3000/tcp` → `sleep 2` → `cd /var/www/sgq-backend && nohup node src/server.js >> /var/www/sgq-backend/app.log 2>&1 &`  
   (stesso fallback eseguito dallo script se A e `sudo -n` non bastano).

## 2.d) File locale sicuro per Cursor / deploy ripetibile (consigliato)

**Problema:** password o sessione solo in variabili globali Windows, o sessione PuTTY salvata non aggiornata, mentre la password SSH funziona, oppure conflitto tra sessione `-load` e password.

**Soluzione:**
1. Copiare `backend/config/.ssh-deploy.local.ps1.example` in **`backend/config/.ssh-deploy.local.ps1`** (il secondo nome e' in `.gitignore`, non va su Git).
2. Nel file `.ps1` impostare solo cio' che serve (es. `$env:SGQ_SSH_PASSWORD`, oppure `$env:SGQ_PUTTY_SESSION`, opzionale `$env:SGQ_SUDO_PASSWORD` per `systemctl`).
3. Rilanciare `backend/scripts/deploy-controllers-to-vps.ps1`: lo script **carica automaticamente** `.ssh-deploy.local.ps1` se esiste.

**Regola anti-conflitto:** se `SGQ_SSH_PASSWORD` e' valorizzata (env o file locale), lo script **ignora la sessione PuTTY** per quell'esecuzione e usa hostkey + `-pw`, cosi' non si resta bloccati su una sessione `-load` errata.

Riepilogo URL e host: [ACCESSO_DEPLOY_AGENTS.md](ACCESSO_DEPLOY_AGENTS.md).

## 3) PowerShell: `&&` non supportato

**Sintomi**
- Errore tipo: `Il token '&&' non e' un separatore di istruzioni valido...`

**Soluzione**
- Usare `;` e controllare `$LASTEXITCODE` tra i comandi.

## 4) OneDrive / file `.docx` "PermissionError" o lock

**Sintomi**
- Script che leggono `.docx` falliscono con `PermissionError` anche se il file esiste.

**Causa**
- Lock temporaneo di OneDrive/Office (sincronizzazione o file aperto).

**Soluzione**
- Copiare il `.docx` in una cartella temporanea locale e lavorare sulla copia:
  - `Copy-Item <file> $env:TEMP`

## 5) Test Word export falliscono su `fetch` template

**Sintomi**
- Vitest fallisce con errori tipo: `Impossibile caricare il template ... Cannot read properties of undefined (reading 'ok')`

**Causa**
- Ambiente test non ha accesso al `fetch` del file `.docx` come in runtime (dipende dal setup).

**Soluzione**
- Non bloccare il deploy se la **build** e' OK e il comportamento in app e' corretto.
- Se serve, predisporre mock di `fetch` o import dei template nei test.

