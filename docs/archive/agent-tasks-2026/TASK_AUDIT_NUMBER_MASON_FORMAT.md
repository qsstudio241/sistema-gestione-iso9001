# TASK — Numerazione report audit stile Mason (`MSN-260417-01`)

## Contesto prodotto

L’auditor **Mason** identifica i report audit con una numerazione leggibile e ordinabile:

| Segmento | Esempio | Regola |
|-----------|---------|--------|
| Prefisso studio | `MSN` | Codice fisso associato allo **studio / auditor** (Mason → `MSN`). |
| Anno | `26` | Ultime **2** cifre dell’anno (2026 → `26`). |
| Mese | `04` | **2** cifre, zero a sinistra. |
| Giorno | `17` | **2** cifre, zero a sinistra. |
| Progressivo giornaliero | `01`, `02`, … | Stesso **giorno di calendario** (secondo le regole sotto): più report nello stesso giorno incrementano `01` → `02` → `03`. |

Formato completo con trattini: **`PREFISSO-YYMMDD-NN`**  
Esempio: **`MSN-260417-01`**.

---

## Decisioni di prodotto (fonte di verità per il deputy)

> Il deputy **implementa** secondo questa tabella. Se qualcosa è `TBD`, il deputy documenta l’ipotesi scelta nel body della PR e nella mini-nota in fondo a questo file (non lasciare silenzio).

| # | Domanda | Decisione (compilare prima del merge) | Default consigliato se TBD |
|---|---------|----------------------------------------|----------------------------|
| D1 | **Fuso orario** del “giorno” per YYMMDD e per il contatore | `Europe/Rome` | Sì |
| D2 | **Momento** in cui viene assegnato / bloccato il numero | Alla **creazione** dell’audit lato server (prima risposta `201` con numero definitivo) | Creazione server-side |
| D3 | **Ambito** del progressivo `NN` (chi condivide lo stesso contatore nello stesso giorno) | Per **`organization_id` + prefisso studio`** (stesso tenant, stesso codice tipo `MSN`) | Org + prefisso |
| D4 | Prefisso `MSN`: **solo Mason** o **configurabile** (anagrafica studio / utente)? | Configurabile con default da profilo o tabella dedicata; Mason = default `MSN` dove applicabile | Colonna o JSON org-wide |
| D5 | Se `audit_number` è già passato dal client (sync / form), il server **sovrascrive** o **rispetta**? | Server **genera sempre** per coerenza contatore (client può ignorare o mostrare preview) | Server-wins su create |
| D6 | Audit **cancellato**: il numero è **consumato** (non riassegnabile)? | Sì (tracciabilità) | Sì |
| D7 | Audit **draft** creato oggi e completato domani: il numero resta quello del giorno di **assegnazione** (D2)? | Sì, ancorato a D2 | Sì |

### Valori “locked” per questa delega (se la tabella sopra non è compilata a mano)

Usare questi come **fonte operativa**; qualunque deviazione va motivata in PR e approvata dal reviewer.

| Chiave | Valore |
|--------|--------|
| D1 | `Europe/Rome` |
| D2 | Numero assegnato e persistito alla **prima creazione** audit lato server (`INSERT` riuscito). |
| D3 | Contatore `NN` per coppia **`(organization_id, prefix, calendar_day)`** dove `calendar_day` è la data locale D1. |
| D4 | Prefisso da **config persistita per organizzazione** (es. colonna JSON o tabella settings); default stringa `MSN` se assente (retrocompatibilità Mason senza obbligo di migrazione dati obbligatoria). |
| D5 | **Server-wins** su `audit_number` in creazione: ignorare o sostituire valore client non conforme / placeholder. |
| D6 | Numeri già emessi **non riutilizzabili** (buco ammesso in sequenza solo per cancellazioni). |
| D7 | Numero **immutabile** dopo assegnazione (no ricalcolo a completamento). |

---

## Robustezza e stabilità (non negoziabili per il deputy)

1. **Unicità e concorrenza**  
   - Vietato basarsi solo su `SELECT MAX(audit_number)` senza lock: sotto due richieste parallele si ottengono duplicati.  
   - Obbligatorio: **transazione** + tabella contatori con `UNIQUE (organization_id, prefix, sequence_date)` **oppure** `UPDLOCK`/`SERIALIZABLE` su riga contatore documentato in PR.  
   - Gestire `2627` / violazione unique: **retry controllato** (max N tentativi) o errore `409` esplicito, mai silent corruption.

2. **Retrocompatibilità**  
   - Audit esistenti con `audit_number` già valorizzato (formati legacy `AUD-...`, anni pieni, ecc.): **non riscrivere** in massa salvo migrazione dati esplicita e fuori scope.  
   - La nuova generazione vale per **nuove** creazioni (e per sync che crea nuovo record) secondo D5.  
   - UI ed export Word devono continuare a mostrare il valore in DB anche se “non Mason”.

3. **Validazione formato**  
   - Regex lato server (o equivalente) per `^[A-Z0-9]+-\d{6}-\d{2}$` (adattare se il prefisso può contenere altro; in caso documentare).  
   - Rifiutare con `400` payload malformati **solo** se esposto endpoint che accetta numero manuale; altrimenti sovrascrivere silenziosamente coerente a D5.

4. **Scope della modifica**  
   - **Diff minimo**: toccare solo file necessari al flusso creazione + sync + UI + test.  
   - **No** refactor estetici, no dipendenze npm nuove salvo giustificazione in PR.  
   - **No** feature flag obbligatorio: se si introduce, deve essere **default ON** con stesso comportamento Mason per non cambiare UX a sorpresa (oppure documentare OFF per ambienti test).

5. **Sicurezza**  
   - Nessuna credenziale DB/API in repo o log.  
   - Nessun `console.log` con PII in produzione oltre quanto già accettato nel modulo.

6. **Offline / sync**  
   - Documentare in PR: cosa succede se il client crea draft offline con numero temporaneo e poi fa sync (merge vs replace). Comportamento minimo accettabile: dopo risposta server, **metadata locale** deve riflettere `audit_number` definitivo senza duplicare audit.

---

## Anti-regressioni (verificare esplicitamente in PR)

- [ ] `POST /audits` (desktop online) e percorso **sync create** (`sync.controller` / equivalente) coerenti.
- [ ] Lista audit, selector, dashboard: nessun crash se `auditNumber` mancante o legacy.
- [ ] `ExportPanel` / `wordExport.js`: placeholder `{auditNumber}` invariato per contenuto = valore persistito.
- [ ] Test automatici esistenti **wordExport** / **response-options** ancora verdi; aggiungere test mirato nuovo file se serve.
- [ ] Nessun uso di `fetch` nuovo lato app (solo Axios).

---

## Verifica pre-merge obbligatoria (comandi — il deputy li esegue e riporta output in PR)

Dalla root repo, cartella `app/`:

```powershell
cd app
$env:NODE_ENV = "test"
npm run test:run
npm run build
```

Dalla root repo, cartella `backend/` (se si tocca il backend):

```powershell
cd backend
npm test
```

In PR: incollare esito sintetico (pass/fail) o screenshot log CI.

---

## Lettura obbligatoria prima di modificare codice

- `PROJECT_CONTEXT.md` — golden rules, stack, sync.  
- Se si tocca scope tenant/studio: `docs/ARCHITETTURA_UTENTI_RBAC.md` (sezioni pertinenti).  
- Schema DB prima di migrazioni: `docs/DATABASE_SCHEMA.md` (solo tabelle coinvolte).

---

## Stato tecnico oggi (punti d’aggancio — non reinventare)

### Frontend

- **`app/src/pages/CreateAuditPage.jsx`**  
  Se `audit_number` è vuoto, genera oggi qualcosa tipo `AUD-{year}-{random}` prima del `POST /audits`. Va **sostituito** / bypassato in favore della logica Mason **oppure** lasciato solo come fallback se il backend restituisce già il numero.

- **`app/src/utils/auditUtils.js`** — `getNextAuditNumber`  
  Oggi logica diversa (`{year}-{progressivo}`). Valutare **deprecazione** per UI locale o allineamento se ancora usato in elenchi offline.

- **`app/src/utils/auditConverter.js`** — mapping `audit_number` ↔ `metadata.auditNumber`

- **`app/src/utils/wordExport.js`**  
  Usa `metadata.auditNumber` (placeholder `{auditNumber}` nel template Word). Il numero assegnato deve fluire fin qui senza regressioni.

### Backend

- **`backend/src/controllers/audit.controller.js`** — `createAudit`  
  Inserisce `audit_number` da body. Serve **generazione atomica** lato server (query con lock/transazione o tabella contatori) per evitare duplicati `NN` nello stesso giorno sotto carico.

- **`backend/src/controllers/sync.controller.js`** — `createAuditFromSync`  
  Usa `clientAudit.auditNumber` dal client: allineare a D5 (server-wins o riconciliazione) per non rompere offline-first.

### Database

- Verificare colonna esistente **`audits.audit_number`** (già presente nel flusso insert).  
- Se serve contatore dedicato: **nuova tabella** tipo `audit_daily_sequences (organization_id, sequence_date, prefix, last_value)` con unique constraint e update in transazione — preferibile a “SELECT MAX” fragile sotto concorrenza.

---

## Vincoli obbligatori (golden rules progetto)

- **Multi-tenant**: ogni query / generazione numero deve essere filtrata / scoped su `organization_id` (e studio se applicabile).
- **Offline-first**: se il numero nasce solo sul server, il client dopo `POST` deve aggiornare metadata locale (sync già previsto); documentare il comportamento se creazione avviene offline (coda sync).
- **Nessun segreto** nel repo; nessuna password in chiaro in commit.
- **HTTP client**: solo Axios dove si tocca il client (regola progetto).
- **PR verso `main`**: branch dedicato; CI verde (`.github/workflows/ci-app-pr.yml` — test + build `app/`).
- **Deploy VPS / migrazioni produzione**: **fuori scope** di questo task salvo file SQL in `database/migrations/` con istruzioni in PR (esecuzione DB a carico operatore).

---

## Obiettivo deputy (deliverable)

1. **Backend**: generazione deterministica `PREFISSO-YYMMDD-NN` in `createAudit` (e allineamento sync se necessario) secondo tabella decisioni.
2. **Frontend**: creazione audit mostra numero assegnato dal server; rimuovere o disattivare generazione random `AUD-...` in conflitto con D5.
3. **DB** (se necessario): migrazione per tabella sequenze o colonne di supporto + indici univoci.
4. **Test**: almeno test unitario backend (o frontend) che verifica formato e incremento `NN` per stesso giorno (mock DB o transazione di test).
5. **Doc**: 5–10 righe in `docs/GUIDA_CONSOLIDATA.md` o nota in coda a questo file con “come si configura il prefisso”.

---

## Criteri di completamento (DoD — checklist PR)

- [ ] Due `POST /audits` consecutivi (stesso org, stesso prefisso, stesso giorno calendario D1) producono `...-01` e `...-02` senza duplicati.
- [ ] Risposta API creazione include `audit_number` coerente con il formato.
- [ ] UI creazione / dettaglio audit mostra il numero Mason (non più random AUD).
- [ ] Export Word mostra `{auditNumber}` uguale al valore persistito.
- [ ] Sync da client offline: comportamento documentato + nessuna regressione critica (test o nota rischio).
- [ ] `npm run test:run` + `npm run build` in `app/` verdi in CI.
- [ ] Nessun segreto o credenziale nel diff.

---

## Branch e workflow Git

1. Da `main` aggiornato: `git pull origin main`
2. Branch: **`feat/audit-number-mason-format`** (o nome equivalente descritto in PR).
3. Commit atomici sensati; PR verso `main` con titolo es.:  
   `feat(audit): numerazione report Mason PREFISSO-YYMMDD-NN`
4. Body PR: summary, file toccati, test eseguiti, decisioni D1–D7 finali.

---

## Prompt di comando per il deputy (Cursor web) — copia tutto il blocco sotto

```text
Sei il deputy su questo repository. Obiettivo: implementare SOLO quanto descritto in docs/agent-tasks/TASK_AUDIT_NUMBER_MASON_FORMAT.md, senza compromettere robustezza, stabilità o retrocompatibilità.

REGOLE ASSOLUTE
1) Leggi per intero docs/agent-tasks/TASK_AUDIT_NUMBER_MASON_FORMAT.md (incluse sezioni Robustezza, Anti-regressioni, Verifica pre-merge).
2) Rispetta i valori “locked” D1–D7 nel task salvo diverso accordo esplicito scritto in PR dal reviewer.
3) Multi-tenant hard: ogni lettura/scrittura/generazione numero deve rispettare organization_id (e studio se applicabile).
4) Unicità NN stesso giorno: MAI solo SELECT MAX; usa tabella contatori + transazione OPPURE locking documentato su SQL Server.
5) Retrocompatibilità: NON riscrivere massivamente audit_number esistenti; la nuova logica vale per nuove creazioni e sync coerente con D5 server-wins.
6) Diff minimo: niente refactor non richiesti, nessuna nuova dipendenza npm senza motivazione, nessun segreto in repo.
7) Client app: solo Axios (no fetch). Backend: coerente con controller/route esistenti.
8) Branch: feat/audit-number-mason-format da main aggiornato. PR verso main. CI deve restare verde (.github/workflows/ci-app-pr.yml).

DELIVERABLE
- Backend: generazione atomica PREFISSO-YYMMDD-NN in create (e allineamento sync se toccato).
- Frontend: niente più AUD-{year}-random come sostituto del server; mostrare numero restituito dall’API.
- DB: solo se necessario, migration SQL in database/migrations/ con nome sequenziale e commenti; in PR istruzioni esecuzione (no deploy VPS nel deputy).
- Test: almeno un test che copre formato + incremento NN stesso giorno (mock o DB test). Tutti i test esistenti devono passare.
- Documentazione breve: GUIDA_CONSOLIDATA o nota in coda al task file per configurazione prefisso.

PRIMA DI INIZIARE
Elenca in 5–8 bullet: file che intendi modificare e strategia concorrenza. Poi implementa.

PRIMA DI APRIRE LA PR
Esegui localmente i comandi nella sezione “Verifica pre-merge obbligatoria” del task e riporta esito nel body PR. Includi: file toccati, decisioni finali D1–D7, rischi offline/sync residui, istruzioni smoke manuale (due POST stesso giorno).
```

---

## Nota operatore (post-merge — non delegabile all’agente web)

- Eseguire migrazione DB su ambiente reale se la PR introduce script SQL.
- Comunicare a Mason il **punto di configurazione** del prefisso (D4) e il fuso (D1).

---

*Task preparato per delega desktop → web. Aggiornare la sezione “Decisioni” quando il product owner conferma i valori definitivi.*
