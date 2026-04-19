# Checklist deploy — nuova versione per utenti

Usa questa lista per mettere in produzione la nuova versione in modo ordinato e verificabile.

**Ultimo deploy completato**: 15/03/2026 — release checklist custom, azienda da anagrafica, sync UUID; frontend su Netlify (main), backend VPS aggiornato con pscp/plink. Riferimento operativo: [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (sez. A); storico in [archive/sessions/SESSION_NOTES_20260315.md](archive/sessions/SESSION_NOTES_20260315.md).

### Allineamento VPS e Git (da ricordare sempre)

- **`/var/www/sgq-backend` sul server non è un clone Git**: `git pull` lì **non** aggiorna il codice. La fonte di verità è **GitHub**; sul VPS arriva solo ciò che **copi** (script `backend/scripts/deploy-controllers-to-vps.ps1` con PuTTY/pscp, oppure `scp` manuale).
- **Ordine consigliato**: `git push` su `main` → Netlify build (frontend) → **subito dopo** deploy file backend + **`sudo systemctl restart sgq-backend`** (il servizio systemd è il modo supportato di riavvio; evitare `nohup` parallelo se systemd è attivo).
- **Verifica post-deploy**: `GET https://www.fr-busato.it:8443/api/v1/health` e, per feature nuove, l’endpoint specifico (es. `GET /api/v1/organizations/me` con Bearer → 401 senza token è normale; 404 = route/file non deployati).

---

## 1. Pre-deploy (locale)

- [ ] **Build frontend senza errori**  
  Dalla root del progetto:
  ```bash
  cd app
  npm run build
  ```
  Se la build fallisce, correggere prima di procedere.

- [ ] **Lint** (opzionale ma consigliato)  
  Verificare che non ci siano errori di lint nei file modificati (es. `app/src`, `backend/src`).

- [ ] **Test**  
  `cd app && npm run test:run` — alcuni test wordExport possono fallire in ambiente CI (template .docx non disponibile); la **build** è il controllo decisivo per il deploy.

- [ ] **Backend: file da deployare sul VPS**  
  Per questa release sono stati toccati almeno:
  - `backend/src/controllers/audit.controller.js` (upsert UUID, delete con UUID)
  - `backend/src/controllers/customChecklist.controller.js` (GET/PUT custom-checklist-responses con UUID)
  Nessuna migrazione DB obbligatoria per queste modifiche.

---

## 2. Deploy backend (VPS)

Il frontend su Netlify chiama le API del backend su VPS. **Il backend va aggiornato prima o insieme al frontend**, altrimenti le nuove funzionalità non funzioneranno.

- [ ] **Copia file backend sul VPS (metodo consigliato)**  
  Da PowerShell nella **root del repo** (`C:\ProgettoISO`), con PuTTY installato (`pscp`/`plink`). Autenticazione: sessione PuTTY, Pageant, oppure file gitignored **`backend/config/.ssh-deploy.local.ps1`** (copia da `.ssh-deploy.local.ps1.example`) — vedi [ACCESSO_DEPLOY_AGENTS.md](ACCESSO_DEPLOY_AGENTS.md) e [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md).
  ```powershell
  cd "C:\ProgettoISO"
  $env:SGQ_PUTTY_SESSION = "NomeSessioneSalvataInPuTTY"   # oppure .putty-session.local / .ssh-deploy.local.ps1
  .\backend\scripts\deploy-controllers-to-vps.ps1
  ```
  Lo script copia i controller/routes/service elencati nello script, inclusi **`organization`**, **`auth`**, **`server.js`**, **`src/middleware/auth.middleware.js`** (JWT / ruolo per RBAC), e tenta **`systemctl restart sgq-backend`**.

- [ ] **Riavvio (solo se non usi lo script)**  
  Sul server: **`sudo systemctl restart sgq-backend`**. Evitare `nohup node ...` in parallelo a systemd (porta 3000 già occupata → `EADDRINUSE`).

- [ ] **Verifica rapida API**  
  `GET https://www.fr-busato.it:8443/api/v1/health` → 200. Per smoke mirati usare anche l’endpoint della feature (con token se serve).

---

## 3. Commit e push (frontend + repo)

- [ ] **Stato Git**  
  Verificare che tutte le modifiche da includere nella release siano presenti:
  ```bash
  git status
  ```

- [ ] **Commit**  
  Un solo commit di release è sufficiente, es.:
  ```bash
  git add -A
  git commit -m "Release: checklist custom, sync UUID, azienda da anagrafica, export e doc report"
  ```

- [ ] **Push su main**  
  Il deploy Netlify parte automaticamente dal branch `main`:
  ```bash
  git push origin main
  ```

---

## 4. Netlify (frontend)

- [ ] **Variabile d’ambiente produzione**  
  In Netlify: Site → Settings → Environment variables → verifica che **VITE_API_URL** sia impostata con l’URL del backend di produzione (es. `https://www.fr-busato.it:8443/api/v1`). Senza questa variabile il frontend in produzione non troverà le API.

- [ ] **Attendere il build**  
  Dopo il push, in Netlify: Deploys → ultimo deploy. Attendere che lo stato passi da “Building” a “Published” (di solito 2–3 minuti).

- [ ] **Build fallita**  
  Se il deploy fallisce: aprire i log di build in Netlify, correggere l’errore, fare un nuovo commit e push.

---

## 5. Post-deploy (smoke test)

Eseguire questi controlli sulla **versione pubblicata** (URL del sito Netlify).

Per **smoke estesi** (auth, licenze moduli, multi-tenant, sync, import PDF): usare la matrice in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) — sezione *Piano qualità: fasi di sviluppo e test di robustezza* (tabella “Matrice smoke robustezza”).

- [ ] **Login**  
  Accesso con un utente reale; nessun errore in console.

- [ ] **Azienda committente**  
  Creazione nuovo audit: il campo “Azienda committente *” è un menu a tendina (se ci sono aziende in anagrafica) con opzione “Nuova azienda / Inserimento manuale”.

- [ ] **Audit solo checklist personalizzata**  
  Creare un audit con sola “Checklist personalizzata” (nessuna norma ISO). Verificare che la sezione “Checklist personalizzata” si carichi e che non compaia la checklist ISO 9001 a vuoto.

- [ ] **Export Word**  
  Per un audit con checklist personalizzata: “Genera Report Word”. Verificare che il file si scarichi e che il contenuto sia coerente.

- [ ] **Eliminazione audit**  
  Eliminare un audit di test. Verificare che l’operazione vada a buon fine (anche per audit identificati per UUID).

---

## 6. Chiusura

- [ ] **Comunicazione utenti** (se prevista)  
  Eventuale messaggio interno o email con: “Nuova versione pubblicata; novità: …”.

- [ ] **Aggiornare la checklist**  
  Salvare una copia di questa checklist con le date e gli esiti (es. “Deploy 15/03/2026: backend OK, Netlify OK, smoke test OK”).

---

## Riepilogo ordine consigliato

1. Build locale frontend (verifica che compili).  
2. Deploy backend su VPS (copia file + riavvio).  
3. Verifica health/API backend.  
4. Commit + push su `main`.  
5. Controllo variabile `VITE_API_URL` su Netlify e attesa deploy.  
6. Smoke test sulla URL di produzione.

Se un passo fallisce, correggere prima di passare al successivo.
