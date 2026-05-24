# DEPUTYTASK — Assistente collocamento archivio documentale

**Stato:** ATTIVO — da eseguire dal deputy  
**Branch:** `cursor/feat-document-placement-assistant-6c36`  
**Richiesta committente (24/05/2026):** assistente che periodicamente scansiona l'archivio, segnala documenti in cartelle errate, suggerisce dove spostarli e — **solo dopo approvazione admin** — esegue lo spostamento.

**Comando avvio:**

`Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Contesto e fattibilità

| Già presente | File / endpoint |
|---|---|
| Mappa `doc_type` → `folder_code` | `backend/src/controllers/document.controller.js` (`DOC_TYPE_FOLDER_MAP`, `getFolderSuggestion`) |
| Stessa mappa frontend | `app/src/data/documentFolderMapping.js` |
| Inbox orfani (`parent_id` null) + suggerimento | `GET /documents/orphans`, `OrphanInbox` in `DocumentRegistry.jsx` |
| Spostamento collaudato (API + UI ↗️) | `PUT /documents/:docId/move` (`documentTree.controller.js`), smoke 24/05 OK |
| Storico spostamenti | `documentHistoryTracker.service.js` → `trackMove` |
| Cron di riferimento | `backend/src/services/alertScheduler.js` (`node-schedule`) |

**Mancante oggi:** scansione “documento **con** cartella ma **cartella sbagliata**”, coda proposte persistente, workflow approvazione, job periodico, notifica admin.

**Vincoli non negoziabili**

1. **Mai** spostamento automatico senza azione esplicita dell'admin (approvazione singola o batch).
2. **Mai** proporre/spostare verso cartelle di sistema bloccate (`is_system_folder`, 403 `SYSTEM_FOLDER_LOCKED`).
3. Ogni query/record con `organization_id` dell'utente autenticato.
4. Riutilizzare `moveDocument` / logica esistente — non duplicare UPDATE su `parent_id`.
5. `doc_type = altro` o mappa assente → `confidence: none` — **non** inserire in coda automatica (solo sezione manuale opzionale).

---

## Obiettivo prodotto (MVP)

1. **Scanner** (on-demand + schedulato): trova documenti il cui `parent_id` ≠ cartella suggerita per `doc_type` (solo `confidence: high`).
2. **Coda revisione** per l'admin dello studio: elenco con cartella attuale, cartella suggerita, motivo (`rule:doc_type`).
3. **Azioni admin:** Approva (→ sposta) | Rifiuta | Modifica cartella destinazione prima dell'approvazione.
4. **Notifica:** badge/contatore in Registro documenti + email settimanale (pattern `alertScheduler`, flag env).

**Fuori scope MVP (slice future, non implementare ora):** AI su titolo/PDF; regole per cliente/commessa; spostamento drag-and-drop.

---

## Definizione “documento mal collocato”

Documento `dr` nella org corrente tale che:

- `dr.doc_type != 'folder'`
- `dr.status != 'obsoleto'`
- `dr.parent_id` valorizzato (non orfano — orfani restano su Inbox esistente)
- Esiste cartella target `T` con `folder_code = DOC_TYPE_FOLDER_MAP[dr.doc_type]` e `is_system_folder = 1` nella stessa org
- `dr.parent_id != T.id`
- Opzionale MVP: escludere documenti già in sotto-cartella della sezione corretta (es. norma sotto `2.3.x`) — **default MVP:** solo confronto con cartella di sezione (`folder_code` esatto), documentare limite in GUIDA

---

## Piano a slice (commit intermedi)

### Slice 1 — Backend scan + API lettura (senza DB nuovo)

| Deliverable | Dettaglio |
|---|---|
| Service | `backend/src/services/documentPlacementScanner.service.js` — `scanMisplacedDocuments(organizationId)` → array `{ document_id, doc_type, doc_code, title, current_parent_id, current_folder_name, suggested_parent_id, suggested_folder_name, folder_code, confidence, reason }` |
| Estrarre mappa | `DOC_TYPE_FOLDER_MAP` in modulo condiviso es. `backend/src/constants/documentFolderMapping.js` (import da controller + service) — allineare a `app/src/data/documentFolderMapping.js` |
| Endpoint | `GET /api/v1/documents/placement-review?status=pending` — per MVP slice 1 calcolo **live** (no tabella); risposta `{ success, data, count, scanned_at }` |
| Route | Registrare in `document.routes.js` **prima** di `/documents/:id` |
| Test L1 | `backend` o `app/src/tests/documentPlacementScanner.test.js` — almeno 3 casi: ok collocato, mal collocato, `altro`/nessuna mappa |

**DoD slice 1:** test verdi; smoke curl autenticato su org test; nessuna migrazione.

### Slice 2 — Persistenza proposte + workflow

| Deliverable | Dettaglio |
|---|---|
| Migration | `backend/database/migrations/066_document_placement_suggestions.sql` |
| Tabella | `document_placement_suggestions`: `id`, `organization_id`, `document_id`, `current_parent_id`, `suggested_parent_id`, `chosen_parent_id` (nullable, override admin), `status` (`pending` \| `approved` \| `rejected` \| `applied` \| `failed`), `confidence`, `reason`, `scan_run_id`, `created_at`, `reviewed_at`, `reviewed_by`, `applied_at`, `error_message`; UNIQUE `(organization_id, document_id)` WHERE status IN (`pending`,`approved`) — o gestione upsert in service |
| Service | `documentPlacementSuggestion.service.js`: `syncSuggestionsFromScan(orgId)`, `approve(id, userId, chosenParentId?)`, `reject(id, userId)`, `applyApproved(orgId, userId)` |
| Approve | Chiama internamente stessa logica di `moveDocument` (estrarre helper condiviso se necessario) + `trackMove` + status `applied` |
| Endpoint | `POST /documents/placement-review/scan` (admin), `GET /documents/placement-review`, `POST /documents/placement-review/:id/approve`, `POST .../reject`, `POST /documents/placement-review/apply-batch` (body: `ids[]`) |
| RBAC | Solo ruoli `admin`, `superadmin` (e `studio_admin` se presente in `ARCHITETTURA_UTENTI_RBAC.md`) — middleware esistente |
| Migrazione | Eseguire su VPS con pattern cloud: `backend/scripts/run-migration-066-vps.js` + scp + ssh node |

**DoD slice 2:** approve di 1 doc test → `parent_id` aggiornato + history `moved`; reject non sposta.

### Slice 3 — UI admin

| Deliverable | Dettaglio |
|---|---|
| Componente | `PlacementReviewPanel.jsx` in `DocumentRegistry.jsx` (tab **Albero** o sotto-tab dedicato **Revisione collocamento**) — riusare stile `OrphanInbox` (tabella, badge confidence) |
| Azioni | Checkbox multipli, “Approva selezionati”, “Rifiuta”, picker cartella per override (riusare pattern `MoveFolderPicker` / albero cartelle) |
| API client | Metodi in `apiService.js` |
| Badge | Contatore `pending` su tab Documenti o banner in cima al registro |
| i18n | Testi italiani UTF-8 corretti |

**DoD slice 3:** admin vede lista dopo scan; approva 1 doc; albero si aggiorna dopo refresh.

### Slice 4 — Scheduler + notifica

| Deliverable | Dettaglio |
|---|---|
| Scheduler | `backend/src/services/documentPlacementScheduler.js` — cron default **lunedì 07:00** (config `PLACEMENT_SCAN_CRON`, `PLACEMENT_SCAN_ENABLED=true`) |
| Job | Per ogni org attiva con modulo `documents` licenziato: `syncSuggestionsFromScan`; se `pending` > 0 e SMTP ok → email riepilogo (stile `alertScheduler`) |
| Bootstrap | `require` in `server.js` come `alertScheduler` |
| Env | Documentare in `.env.example`: `PLACEMENT_SCAN_ENABLED`, `PLACEMENT_SCAN_CRON` |

**DoD slice 4:** con flag abilitato, log avvio job; email solo se ci sono pending (test con org 1001).

### Slice 5 (opzionale, solo se tempo) — AI bassa confidenza

Solo per `confidence: low` o titolo senza `doc_type` affidabile: chiamata provider AI già nel progetto — **non** auto-apply. Fuori DoD obbligatorio.

---

## API sketch (riferimento implementazione)

```
GET    /api/v1/documents/placement-review?status=pending&limit=100
POST   /api/v1/documents/placement-review/scan
POST   /api/v1/documents/placement-review/:suggestionId/approve   { chosen_parent_id?: number }
POST   /api/v1/documents/placement-review/:suggestionId/reject
POST   /api/v1/documents/placement-review/apply-batch               { ids: number[] }
```

---

## Test e verifica

| Livello | Cosa fare |
|---|---|
| **L1** | Vitest: scanner unit + mapping; test approve mock DB se possibile |
| **L2** | CI PR `ci-app-pr.yml` verde |
| **Smoke API** | Script `/tmp/test-placement-review.mjs`: login → scan → GET review → approve 1 doc spostabile → GET tree children → **ripristino** move inverso |
| **Smoke UI** | Playwright: login → Documenti → Revisione collocamento → approva 1 riga → verifica albero (pattern `test-document-move-ui.mjs`, `pressSequentially` su login) |
| **Deploy** | Backend: `deploy-controllers-to-vps.ps1` o `deploy-to-vps.sh` + restart + verifica PID; Frontend: push branch → Netlify preview |

Checklist deputy: [MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md](MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md)

---

## Documentazione a chiusura

- Aggiornare `docs/GUIDA_CONSOLIDATA.md` — sezione breve “Assistente collocamento documenti” (scan, approvazione, cron, limiti sezione vs sotto-cartella).
- Aggiornare `docs/reference/BACKEND_API.md` se esiste tabella endpoint documenti.
- **Non** creare `SESSION_NOTES_*`.
- Opzionale: 1 riga in `docs/PROJECT_ROADMAP.md` backlog completato.

---

## Git / PR

```bash
git checkout main && git pull origin main
git checkout -b cursor/feat-document-placement-assistant-6c36
# ... commit per slice ...
git push -u origin cursor/feat-document-placement-assistant-6c36
```

- PR **draft** verso `main` dopo primo push utile.
- Messaggi commit in italiano, una slice per commit quando possibile.
- Chiusura: `TEST OK` oppure `FIX NON APPLICABILI: ...` con elenco puntale.

---

## Riferimenti rapidi codice

- Spostamento: `backend/src/controllers/documentTree.controller.js` → `moveDocument` (righe ~124+)
- Suggerimento cartella: `document.controller.js` → `getFolderSuggestion` (~600–666)
- Inbox UI: `app/src/components/DocumentRegistry.jsx` → `OrphanInbox` (~648+)
- Test move esistenti: smoke 24/05 documentati in GUIDA sessione documenti

---

## Esito atteso (compilare a fine task)

| Campo | Valore |
|---|---|
| Stato | `TEST OK` / `FIX NON APPLICABILI` |
| PR | #___ |
| Slice completate | 1 / 2 / 3 / 4 |
| Deploy VPS | sì / no |
| Note | |
