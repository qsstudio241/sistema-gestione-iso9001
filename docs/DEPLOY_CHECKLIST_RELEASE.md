# Checklist deploy — nuova versione per utenti

Usa questa lista per mettere in produzione la nuova versione in modo ordinato e verificabile.

**Ultimo deploy completato**: 15/03/2026 — release checklist custom, azienda da anagrafica, sync UUID; frontend su Netlify (main), backend VPS aggiornato con pscp/plink. Riferimento operativo: [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (sez. A); storico in [archive/sessions/SESSION_NOTES_20260315.md](archive/sessions/SESSION_NOTES_20260315.md).

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

Il frontend su Netlify chiama le API del backend su VPS. **Il backend va aggiornato prima o insieme al frontend**, altrimenti le nuove funzionalità (UUID, sync create, ecc.) non funzioneranno.

- [ ] **Copia file backend sul VPS**  
  Da PowerShell nella root del progetto (sostituisci porta e utente se diversi):
  ```powershell
  cd "c:\Users\pasca\OneDrive - QS Studio\Sistema Gestione ISO 9001"
  scp -P 1122 backend/src/controllers/audit.controller.js backend/src/controllers/customChecklist.controller.js spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/
  ```

- [ ] **Riavvio servizio backend sul VPS**  
  Connettiti in SSH e riavvia Node:
  ```bash
  ssh -p 1122 spascarella@www.fr-busato.it
  # Sul server:
  fuser -k 3000/tcp
  sleep 2 && cd /var/www/sgq-backend && nohup node src/server.js > /var/www/sgq-backend/app.log 2>&1 &
  sleep 4 && tail -30 /var/www/sgq-backend/app.log
  exit
  ```
  Controlla che in `app.log` non ci siano errori di avvio.

- [ ] **Verifica rapida API**  
  Da browser o da Postman: `GET https://www.fr-busato.it:8443/api/v1/health` (o l’URL reale del backend). Deve rispondere 200.

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
