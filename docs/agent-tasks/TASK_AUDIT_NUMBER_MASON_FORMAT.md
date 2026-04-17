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

## Prompt pronto per Cursor web (deputy)

Copia-incolla nella chat web (dopo aver aperto il repo su GitHub in Cursor web):

```text
Implementa il task descritto in docs/agent-tasks/TASK_AUDIT_NUMBER_MASON_FORMAT.md.

Vincoli:
- Rispetta multi-tenant e le decisioni D1–D7 documentate nel file (se una cella è TBD, scegli il default indicato e scrivilo chiaramente nella PR).
- Non introdurre segreti nel repo.
- PR da branch feat/audit-number-mason-format verso main con CI verde.

Nel body della PR includi: elenco file modificati, come testare manualmente due creazioni nello stesso giorno, e limiti noti (offline / sync).
```

---

## Nota operatore (post-merge — non delegabile all’agente web)

- Eseguire migrazione DB su ambiente reale se la PR introduce script SQL.
- Comunicare a Mason il **punto di configurazione** del prefisso (D4) e il fuso (D1).

---

*Task preparato per delega desktop → web. Aggiornare la sezione “Decisioni” quando il product owner conferma i valori definitivi.*
