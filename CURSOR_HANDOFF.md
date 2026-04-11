# 🤖 CURSOR AI AGENT — Handoff Document

# Sistema Gestione ISO 9001 / 14001 / 45001

> **Data handoff**: 2026-04-11 (sessione odierna)
> **Da**: Sessione Cursor AI 11/04/2026
> **A**: Prossima sessione (Gemini Pro o Cursor)
> **Stato progetto**: ~75% completato — Sprint 0-6 COMPLETI, Sprint 7 (Reclami & Fornitori) è il prossimo
> **Ultimo commit**: `707575e` (branch `main`) — brief test Sprint 5+6

---

## 🚀 STATO CORRENTE — 11/04/2026

### Sprint completati in questa sessione

| Sprint | Nome | Commit | Stato |
|--------|------|--------|-------|
| Sprint 0 | Navigation Foundation | precedente | ✅ |
| Sprint 1 | Document Registry UX | precedente | ✅ |
| Sprint 2 | Alert Engine (cron + email) | precedente | ✅ |
| Sprint 2B | File allegati documenti (DocFileDialog 📎) | `0be6b43` + fix `e2d65db` | ✅ |
| Sprint 3 | Notifiche & Alert UI | `08618e8` | ✅ |
| Sprint 4 | Modulo Qualifiche (semaforo) | `0ec1a7b` | ✅ |
| Sprint 5 | NC & Azioni Correttive | `e437e03` | ✅ |
| Sprint 6 | Rischi & Obiettivi | `6c19fc2` | ✅ |

### Migrazioni DB eseguite sul VPS

| Migration | File | Stato VPS |
|-----------|------|-----------|
| 029 | `document_registry` | ✅ |
| 030 | `notifications_config` | ✅ |
| 031 | `attachments` — colonne doc_file | ✅ |
| 032 | `qualifications` | ✅ |
| 033 | `nc_actions` | ✅ |
| 034 | `risks` + `objectives` | ✅ |

### File nuovi/modificati significativi (sessione 11/04/2026)

**Frontend** (`app/src/`):
- `pages/NCPage.jsx` + `.css` — Registro NC cross-audit + azioni correttive
- `pages/RisksPage.jsx` + `.css` — Registro Rischi + Obiettivi (tab unica)
- `pages/QualificationsPage.jsx` + `.css` — Registro Qualifiche personale
- `pages/QualificationForm.jsx` + `.css`
- `pages/NotificationsSettingsPage.jsx` + `.css`
- `components/DocFileDialog.jsx` + `.css` — upload/download/versioning file su doc registro
- `components/DocumentRegistry.jsx` — aggiunto pulsante 📎 in CatalogView
- `layouts/AppLayout.jsx` — voci NC, Rischi, Qualifiche attive in sidebar
- `services/apiService.js` — +30 nuovi metodi (qualifiche, NC actions, risks, objectives, docfiles, notifications)

**Backend** (`backend/src/`):
- `controllers/qualifications.controller.js` — CRUD + semaforo
- `controllers/nc.controller.js` — CRUD NC + 4 nuovi endpoint nc_actions
- `controllers/risks.controller.js` — CRUD risks + objectives + stats
- `controllers/docfile.controller.js` — upload/download file documenti (**fix colonne SQL 11/04**)
- `controllers/alert.controller.js` — fix query NC (via JOIN audits), + qualifCount
- `controllers/notifications.controller.js`
- `routes/qualifications.routes.js`, `nc.routes.js` (esteso), `risks.routes.js`, `docfile.routes.js`, `notifications.routes.js`
- `config/multer.js` — aggiunto `uploadDocFile` con blacklist eseguibili + 500MB limit
- `routes/attachment.routes.js` — fix HTTP 415 (era 500) per tipo file non supportato
- `server.js` — registrate tutte le nuove routes

### Test deputy in corso

Il deputy sta eseguendo il test combinato Sprint 2B (fix) + Sprint 5 + Sprint 6.
Brief: `docs/agent-tasks/TEST_SPRINT5_6_nc_rischi.md`
Report atteso: `docs/agent-tasks/REPORT_TEST_SPRINT5_6.md`

Quando arriva il report:
1. Eseguire "Squash and merge" del PR del deputy su GitHub
2. Verificare i bug trovati e applicare fix
3. Procedere con Sprint 7

### PR aperto da chiudere

- **PR #6** (`cursor/test-sprint2-3-alert-notifiche-c259`) — test Sprint 2B: **chiudere con "Close pull request"** (il fix è già su main, il report è in `docs/agent-tasks/REPORT_TEST_SPRINT2B_file_allegati.md`)

### Prossimo sprint

**Sprint 7 — Reclami & Fornitori** (ISO 9001 §8.2.1 + §8.4):
- Tabelle: `complaints` (reclami clienti), `suppliers` (anagrafica fornitori), `supplier_evaluations` (valutazioni periodiche)
- Frontend: pagina Reclami (inserimento da azienda + stato) + pagina Fornitori (lista + valutazione)
- Alert: reclami aperti da >X giorni nel badge

### Accesso VPS (deploy manuale backend)

```powershell
# Copia file
pscp -P 1122 -pw "Sistemi@2026" "file_locale" "spascarella@www.fr-busato.it:/var/www/sgq-backend/path/sul/server"
# Restart backend
plink -P 1122 -pw "Sistemi@2026" spascarella@www.fr-busato.it "echo Sistemi@2026 | sudo -S systemctl restart sgq-backend"
# Health check
plink -P 1122 -pw "Sistemi@2026" spascarella@www.fr-busato.it "curl -sk http://localhost:3000/api/v1/health"
```

### Pattern deployment Sprint (da ripetere ogni sprint)

1. Migration SQL (script embedded in `run-migration-0NN.js` — NO path relativo al file .sql)
2. `pscp` controller + routes + server.js su VPS
3. `plink` run-migration + restart + health check
4. `npm run build` app
5. `git add -A && git commit && git push` (Netlify auto-deploya)

---

> **⚠️ NOTE CRITICHE PER PROSSIMA SESSIONE**
> - La tabella `attachments` ha PK = `attachment_id` (NON `id`), path = `storage_path` (NON `file_path`), users join su `user_id`/`full_name`
> - `req.user.user_id` (NON `req.user.id`) nei controller
> - NC non ha `organization_id` diretto — sempre via `JOIN audits a ON nc.audit_id = a.audit_id` dove `a.organization_id = @orgId`
> - Script migration: embeddare SQL inline nello script JS (no path relativo al .sql — la directory database/ non è presente sul VPS)
> - PowerShell: usare `;` non `&&` per concatenare comandi

---

---

## 📌 REGOLA #1 — LEGGERE PRIMA DI TUTTO

```
"Calma, abbiamo un server — leggi la documentazione esistente
 prima di eseguire qualsiasi azione o generare codice."
```

**Ordine di lettura obbligatorio all'inizio di ogni sessione**:

1. Questo file (`CURSOR_HANDOFF.md`) — stato, decisioni, trappole
2. `[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)` — stack, infrastruttura, regole operative
3. `[docs/PROJECT_ROADMAP.md](docs/PROJECT_ROADMAP.md)` — stato componenti, backlog
4. `[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)` — schema DB critico
5. `[docs/BACKEND_API.md](docs/BACKEND_API.md)` — endpoint attivi
6. `[docs/GUIDA_CONSOLIDATA.md](docs/GUIDA_CONSOLIDATA.md)` — esperienza operativa (deploy, Word, sync); storico in `docs/archive/sessions/`
7. `[docs/open_points.md](docs/open_points.md)` — bug aperti + risolti con root cause

---

## 🏗️ ARCHITETTURA IN SINTESI

```
Frontend (React 18 PWA)         → Netlify (auto-deploy da branch main)
         ↕ HTTPS / Axios + JWT
Backend (Node.js 20 / Express)  → VPS Ubuntu www.fr-busato.it porta 3000 → HTTPS 8443 via Nginx
         ↕ mssql driver
Database (SQL Server)           → www.fr-busato.it,11043 / SGQ_ISO9001
         ↕
File Allegati                   → /var/www/sgq-backend/uploads/{year}/{month}/
```

- **Multi-tenant**: ogni query filtra su `organization_id`
- **Offline-first**: IndexedDB locale → sync server in background (server-wins su campi critici)
- **Auth**: JWT in cookie httpOnly (desktop) + localStorage (mobile PWA — transizione ADR-004)
- **Export Word**: `docxtemplater` + `pizzip` + OOXML injection su template `.docx`

---

## 📊 STATO FUNZIONALITÀ (2026-03-02)

### ✅ Completato in sessione 04/03/2026 — FASE 0 CHIUSA (commit `c4da815`)


| Fix/Feature                         | File                                | Descrizione                                                                |
| ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| Auto-init checklist ISO 14001/45001 | `AuditAccordionLayout.jsx`          | `STANDARD_INIT_MAP` scalabile — fix checklist vuota dopo reload (bug 0.2)  |
| Retry rilievi pendenti              | `PendingIssuesCascade.jsx` + `.css` | Pulsante Riprova per errori transitori rate-limiter/rete (bug 0.1)         |
| Backend committato                  | `audit.controller.js`               | Fix multi-standard già deployato, ora anche su git (commit `696df52`)      |
| Word export multi-standard          | `wordExportHelpers.js`              | Intestazioni per standard, `extractSectionNum` corretto per ISO 14001      |
| ExportPanel titolo dinamico         | `ExportPanel.jsx`                   | Titolo mostra standard effettivi (es. "ISO_9001 + ISO_14001")              |
| ADR-004 auth mobile                 | —                                   | **GIÀ IMPLEMENTATA** — `apiService.js` usa già localStorage + Bearer token |
| Rilievi pendenti reali in Word      | `ExportPanel.jsx`                   | **GIÀ IMPLEMENTATA** — usa `checkReaudit` + `getNcResponses`               |


**Commit history sessione**: `531dc1a` → `696df52` → `c4da815`

### ✅ Completato in sessione 03/03/2026 (commit `6317215`)


| Fix                         | File                                                  | Descrizione                                                                        |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| auditConverter array/string | `auditConverter.js`                                   | `standards` gestito sia come stringa CSV (lista) che array oggetti (dettaglio)     |
| Checkbox standard           | `GeneralDataSection.jsx`                              | Normalizza `ISO_9001_2015` → `ISO_9001` per match corretto con `selectedStandards` |
| Blocco deselezione          | `GeneralDataSection.jsx` + `AuditAccordionLayout.jsx` | Standard con dati esistenti non deselezionabili (prop `standardsWithData`)         |
| Sync multi-standard         | `syncService.js` + `audit.controller.js`              | Invia `standard_ids:[1,2]` — aggiorna `audit_standards` per tutti gli standard     |


**Deploy backend eseguito**: `audit.controller.js` caricato via pscp + `systemctl restart sgq-backend` (systemd gestisce il backend, NON usare `fuser` da solo).

---

### ✅ Completato e Deployato su VPS + Netlify


| Area                     | Componenti/File chiave                                                              |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Auth JWT                 | `auth.controller.js`, `AuthContext.jsx`, `apiService.js`                            |
| Audit CRUD               | `audit.controller.js`, `AuditSelector.jsx`, `Dashboard.jsx`                         |
| Checklist ISO 9001:2015  | 35 domande da DB (standard_id=1, questionId 87–121)                                 |
| Checklist ISO 14001:2015 | 46 domande da DB (standard_id=2, questionId 122–167, sezioni `14001_s4`/`14001_s5`) |
| 6 stati conformità       | C / NC / OSS / OM / NA / NV — CHECK constraint fisso in DB                          |
| Sync offline-first       | `syncService.js`, `IndexedDBProvider.js`, `StorageContext.jsx`                      |
| Allegati                 | `AttachmentSection.jsx`, `AttachmentPreview.jsx`, `attachment.controller.js`        |
| Rilievi pendenti         | `PendingIssuesCascade.jsx`, `pending_issues` table (migration 018)                  |
| Re-audit                 | `checkReaudit` endpoint deployato, `AuditSelector.jsx` chiama l'API                 |
| Export Word              | `wordExport.js` — template-based su `ISO9001-audit-report.docx`                     |
| Multi-standard UI        | Tab checklist ISO 9001 + ISO 14001 nell'accordion                                   |
| Fix selezione standard   | `norms→selectedStandards`, accordion `_2015`/`_2018`, `standard_id` intero in sync  |


### 🔲 Backlog ordinato per priorità

#### ✅ FASE 0 — Completata al 100% (sessione 04/03/2026)

Tutti i bug e feature di Fase 0 sono chiusi. Nessun task ALTA in sospeso.

**Prossima fase**: Fase 1 — DB multi-tenant + RBAC + anagrafica aziende (6-8 settimane)

#### 🟡 MEDIA


| #   | Task                             | File coinvolti                                                           | Note                                      |
| --- | -------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| 5   | **SyncService offline allegati** | `syncService.js`, `IndexedDBProvider.js` (v3), `useAttachmentManager.js` | Store `attachments` mancante in IndexedDB |
| 6   | **Seed ISO 45001**               | `database/migrations/019_seed_iso45001.sql`                              | Stesso pattern di `migration-012.js`      |


#### 🟡 MEDIA — Nuovi requisiti (03/03/2026)


| #   | Task                                    | File coinvolti                                                      | Note                                                                                                                      |
| --- | --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Audit locking — accesso concorrente** | `audit.controller.js`, nuovo `AuditLockBanner.jsx`                  | Due utenti non possono modificare lo stesso audit contemporaneamente → pessimistic lock con TTL + notifica visiva         |
| 7   | **Offline resilience Android**          | `syncService.js`, `IndexedDBProvider.js`, `useAttachmentManager.js` | Su Android: quota 50MB IndexedDB, Service Worker limitato, File API assente → gestione esplicita errori + feedback utente |


#### 🟢 BASSA


| #   | Task                                     | Note                                                                     |
| --- | ---------------------------------------- | ------------------------------------------------------------------------ |
| 8   | Multi-tab sync logout                    | `AuthContext.jsx` — `window.addEventListener('storage', ...)`            |
| 9   | Auto-logout inattività 4h                | `AuthContext.jsx` — `setTimeout` reset su eventi utente                  |
| 10  | CSP header                               | `app/index.html`                                                         |
| 11  | Refresh token automatico                 | interceptor Axios 401 → `POST /auth/refresh`                             |
| 12  | Email alert NC scadute                   | cron job backend                                                         |
| 13  | Nginx porta 443                          | prerequisito per Office Online preview Word/Excel                        |
| 14  | Allineamento `/audits` vs `/audits/sync` | `/audits` usa `standard_ids[]`, `/audits/sync` usa `standard_id` singolo |
| 15  | Deprecare `audits.standard_id`           | → solo `audit_standards` junction table                                  |


---

## 🔑 DECISIONI ARCHITETTURALI CRITICHE

### ADR-004: Auth Mobile → localStorage JWT

**Problema**: Android PWA standalone blocca cookie httpOnly (SameSite policy) → loop login infinito.  
**Soluzione adottata**: JWT anche in `localStorage` + `Authorization: Bearer` header.  
**Dettaglio completo**: `[docs/adr/ADR-004-mobile-auth-localstorage.md](docs/adr/ADR-004-mobile-auth-localstorage.md)`

**TODO da implementare**:

- `auth.controller.js` → aggiungere `token` in response body (mantenere cookie per desktop)
- `apiService.js` → `login()` salva in `localStorage`; interceptor aggiunge `Authorization: Bearer`
- `AuthContext.jsx` → `validateStoredToken()` legge da localStorage; `logout()` pulisce localStorage

---

### ADR-005: Allegati su Filesystem Linux (migration-ready Azure)

**Preview allegati**: `fetch()` con header Authorization → blob → `URL.createObjectURL()`  
**NON** usare `<img src="...?token=">` per CORS su porta 8443 da Netlify.  
**Dettaglio completo**: `[docs/adr/ADR-005-attachment-storage-strategy.md](docs/adr/ADR-005-attachment-storage-strategy.md)`

```javascript
// ✅ CORRETTO
const blob = await apiService.fetchAttachmentBlob(attachmentId);
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
setTimeout(() => URL.revokeObjectURL(url), 10000);

// ❌ SBAGLIATO — CORS blocca
<img src={`https://www.fr-busato.it:8443/api/v1/attachments/${id}/view?token=${token}`} />
```

---

### Pending Issues Flow (decisione sessione 01/03/2026)

- **Trigger**: `conformity_status IN ('NC', 'OSS')` — OM **escluso** (è osservazione minore, non rilievo)
- **Fonte dati**: tabella `pending_issues` (migration 018), auto-popolata
- **Endpoint**: `POST /api/v1/audits/check-reaudit` — **già deployato**
- `AuditSelector.jsx` **chiama già** `checkReaudit()` ma manca UI che mostra la lista
- **Colonne usate**: `section_code` (NON `clause_number` — non esiste in DB)

---

### Template Word — uno per sistema (decisione 04/03/2026)

Ogni standard avrà **il proprio template** e la propria tab nell'UI:

- ISO 9001 → `ISO9001-audit-report.docx` (versione attuale da ripristinare a solo ISO 9001)
- ISO 14001 → template da estrarre da file sorgente utente
- ISO 45001 → template da estrarre da file sorgente utente

Il template attuale (modificato in sessione 04/03 con intestazioni multi-standard) va **riportato alla versione precedente** quando si implementerà la UI a tab per standard (Fase 2). L'utente ha i file sorgente per estrarre i template di ogni sistema.

---

### Word Export (architettura template-based)

```
Template: app/public/templates/ISO9001-audit-report.docx (editabile in Word)
Lib:      docxtemplater + pizzip    ← NON il package npm "docx"
Pattern:  {segnaposto} per scalari, CHECKLIST_MARKER/RILIEVI_MARKER per OOXML injection
```

Vedere `[FASE_8_EXPORT_WORD.md](FASE_8_EXPORT_WORD.md)` per la spec completa.

---

### Coerenza standard_id (contesto tecnico decisioni 01/03/2026)

4 bug corretti in commit `9894ed5` (dettaglio in `docs/archive/sessions/SESSION_NOTES_20260301.md`):

1. `formData.norms` non mappato a `selectedStandards` nel modal creazione
2. Accordion accordion checklist ISO 14001 non visibile con codice `ISO_14001_2015`
3. `backendToFrontend` restituiva formato inconsistente senza sfruttare junction table
4. `syncService` inviava stringa `"ISO_9001"` invece di intero `1` al server

---

## 🗄️ DATABASE — RIFERIMENTO RAPIDO

**Connessione**: `www.fr-busato.it,11043` / DB: `SGQ_ISO9001`  
**Credenziali**: `pascarella` / `#Gestione2025@` (in `.env`, MAI in repo)

```sql
-- conformity_status CHECK constraint (NON modificare mai)
'C', 'NC', 'OSS', 'OM', 'NA', 'NV', NULL

-- audit.status
'draft', 'in_progress', 'completed', 'approved'

-- question_type (MAIUSCOLO obbligatorio)
'TEXT', 'YES_NO', 'MULTIPLE_CHOICE'

-- Standards
standard_id = 1  →  ISO 9001:2015    (35 domande, questionId 87-121)
standard_id = 2  →  ISO 14001:2015   (46 domande, questionId 122-167)
standard_id = 3  →  ISO 45001:2018   (0 domande — da fare migration 019)

-- checklist_sections.section_code  →  VARCHAR(10): max 10 caratteri!
-- Usare '14001_s4', non 'iso14001_s4' (12 char troppo lungo)

-- checklist_questions colonne REALI (NON esistono clause_number né requirement_reference)
question_id, question_uuid, section_code, question_text, question_type,
display_order, is_mandatory, is_active, created_at, updated_at, standard_id
```

**Migration history** (vedi `docs/DATABASE_SCHEMA.md`):


| Migration | Descrizione                                                       | Stato        |
| --------- | ----------------------------------------------------------------- | ------------ |
| 001-010   | Schema base, checklist, multi-standard                            | ✅ Eseguita   |
| 011-016   | Response history, trigger, email log                              | ✅ Eseguita   |
| 017       | `attachments.question_id` + `attachment_uuid`                     | ✅ Eseguita   |
| 018       | Tabella `pending_issues` con FK NO ACTION su `source_response_id` | ✅ Eseguita   |
| 019       | Seed ISO 45001 `checklist_questions`                              | 🔲 Da creare |


---

## 🌐 API — RIFERIMENTO RAPIDO

**Base URL**: `https://www.fr-busato.it:8443/api/v1`

```
POST /auth/login                          → {success, token, user} + cookie httpOnly
POST /auth/logout
GET  /auth/validate

GET    /audits                            → lista paginata (org filter)
POST   /audits                            → crea (body: standard_ids: number[])
GET    /audits/:id
PUT    /audits/:id
DELETE /audits/:id
GET    /audits/:id/statistics
GET    /audits/:id/pending-issues         → NC/OSS da audit precedente stesso cliente
GET    /audits/:id/nc-responses           → risposte NC/OSS per export
POST   /audits/check-reaudit              → {has_previous_audit, pending_count, last_audit_id}
POST   /audits/sync                       → upsert offline (standard_id: number singolo)

GET    /audit-responses/audit/:id         → tutte le risposte di un audit
POST   /audit-responses/bulk              → salva risposte in batch
GET    /audit-responses/audit/:id/pending-issues  → alias pending issues

GET    /attachments?audit_id=&question_id=
POST   /attachments/upload                → multipart/form-data
GET    /attachments/:id/download?token=  → stream file (inline img/PDF)
GET    /attachments/:id/view?token=      → preview inline
PUT    /attachments/:id/replace          → sostituisce (solo desktop)
DELETE /attachments/:id

GET    /standards                         → lista standard disponibili
GET    /standards/:id/sections            → sezioni checklist
GET    /standards/:id/questions           → domande checklist
```

---

## 🖥️ INFRASTRUTTURA


| Risorsa      | Dettaglio                                                      |
| ------------ | -------------------------------------------------------------- |
| SSH          | `ssh spascarella@www.fr-busato.it -p 1122` pwd: `Sistemi@2026` |
| Backend path | `/var/www/sgq-backend/`                                        |
| Log backend  | `/var/www/sgq-backend/app.log`                                 |
| Upload path  | `/var/www/sgq-backend/uploads/{year}/{month}/`                 |


### Restart Backend (NO `;` dopo `fuser`)

```bash
fuser -k 3000/tcp
sleep 2 && cd /var/www/sgq-backend && nohup node src/server.js > /var/www/sgq-backend/app.log 2>&1 &
sleep 4 && cat /var/www/sgq-backend/app.log
```

### Deploy Backend

```bash
# Upload singolo file
pscp -P 1122 -pw "Sistemi@2026" "backend/src/controllers/auth.controller.js" \
  spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/auth.controller.js
# poi restart backend
```

### Deploy Frontend

```bash
git add -A && git commit -m "feat: descrizione" && git push origin main
# Netlify auto-deploya in ~2 minuti
```

---

## 📁 STRUTTURA REPOSITORY (cartelle chiave)

```
app/
  src/
    components/
      AttachmentSection.jsx      ✅ Upload + lista allegati per risposta
      AttachmentPreview.jsx      ✅ Preview lazy-blob (file attivo nell'editor)
      PendingIssuesCascade.jsx   ✅ Lista NC/OSS/NV read-only con note
      AuditSelector.jsx          ✅ Dropdown + checkReaudit + CreateAuditModal
      ChecklistModule.jsx        ✅ Domande checklist multi-standard
      AuditAccordionLayout.jsx   ✅ Struttura accordion (fix _2015 codes)
      GeneralDataSection.jsx     ✅ Dati generali + selezione standard
      Dashboard.jsx              ✅
    contexts/
      AuthContext.jsx            ⚠️  Fix mobile (ADR-004) — da modificare
      StorageContext.jsx         ✅ State management centrale
    services/
      apiService.js              ✅ Axios + interceptors + fetchAttachmentBlob
      syncService.js             ⚠️  syncUploadAttachment non connesso a IndexedDB
      IndexedDBProvider.js       ⚠️  Manca store 'attachments' v3
      checklistService.js        ✅
    hooks/
      useAttachmentManager.js    ⚠️  Offline sync allegati non completo
    utils/
      wordExport.js              ⚠️  RILIEVI_MARKER hardcoded, manca ISO 14001
      auditConverter.js          ✅ backendToFrontend/frontendToBackend (fix `9894ed5`)
    data/
      checklistTemplates.js      ✅ ISO 9001 (35q) + ISO 14001 (46q) con questionId reali
      auditDataModel.js          ✅ createNewAudit, ISO_STANDARDS enum

backend/
  src/
    controllers/
      auth.controller.js         ✅ (da modificare per ADR-004 localStorage)
      audit.controller.js        ✅ checkReaudit, pending-issues, sync
      attachment.controller.js   ✅ view/download/upload/replace
      response.controller.js     ✅ bulk save, pending-issues
    routes/
      audit.routes.js            ✅
      attachment.routes.js       ✅
    middleware/
      auth.middleware.js         ✅ authenticate + authenticateDownload (?token=)

database/
  migrations/
    010_update_iso9001_35questions.sql  ✅ 35 domande ISO 9001
    017_add_question_id_to_attachments.sql  ✅
    018_pending_issues.sql              ✅
    019_seed_iso45001.sql               🔲 DA CREARE

app/public/
  templates/
    ISO9001-audit-report.docx          ← template Word editabile con segnaposto

docs/
  adr/
    ADR-001-multi-agent-workflow.md
    ADR-002-offline-first-sync.md
    ADR-003-bidirectional-sync.md
    ADR-003-database-architecture-processes-analysis.md
    ADR-003-pwa-mobile-android-strategy.md
    ADR-004-mobile-auth-localstorage.md    ← decisione auth mobile
    ADR-005-attachment-storage-strategy.md ← strategia allegati
  PROJECT_ROADMAP.md          ← stato avanzamento aggiornato al 01/03/2026
  DATABASE_SCHEMA.md          ← LEGGERE PRIMA DI TOCCARE IL DB
  MANUALE_UTENTE.md           ← flusso utente verificato su codice
  GUIDA_CONSOLIDATA.md      ← guida operativa unica; storico: archive/sessions/
  open_points.md              ← bug #006-#009 risolti, P1/P2 aperti

CURSOR_HANDOFF.md             ← QUESTO FILE: punto di ingresso per Cursor
PROJECT_CONTEXT.md            ← regole operative, stack, infrastruttura
docs/BACKEND_API.md           ← spec endpoint completa
FASE_8_EXPORT_WORD.md         ← spec export Word (leggere prima di toccare wordExport.js)
ARCHITETTURA_ESRS_PWA_PER_AI_AGENT.md  ← data model audit completo
```

---

## 🏛️ VISIONE STRATEGICA — SaaS Multi-Tenant (decisione 03/03/2026)

### Modello di business

```
QS Studio (admin globale)
  └── Auditor/Studio consulenza (nostro cliente, paga abbonamento per standard)
        └── Aziende auditate (clienti dell'auditor, accesso read-only ai propri audit)
```

### Approccio di sviluppo: Dark Launch (feature flag per tab)

Ogni nuovo modulo (standard, anagrafica, checklist libera) viene sviluppato come **tab nascosta**:

- Visibile solo agli admin QS Studio durante sviluppo e test
- Rilasciata agli auditor solo quando stabile e collaudata
- Zero interruzioni all'operatività corrente

### Roadmap fasi (dettaglio in `docs/PROJECT_ROADMAP.md`)


| Fase  | Contenuto                                          | Stima          |
| ----- | -------------------------------------------------- | -------------- |
| **0** | Chiusura bug minori correnti                       | 1-2 settimane  |
| **1** | DB multi-tenant + RBAC + anagrafica aziende        | 6-8 settimane  |
| **2** | UI a tab per standard + feature flags + nuova UX   | 6-8 settimane  |
| **3** | Sistema licenze/abbonamenti per standard           | 3-4 settimane  |
| **4** | Checklist libera + gap analysis + query conformità | 6-8 settimane  |
| **5** | Workflow implementazione SGQ (post-audit)          | 8-12 settimane |


### Decisione architetturale: backend systemd

Il backend gira come **servizio systemd** (`sgq-backend.service`).

- ✅ Restart corretto: `sudo systemctl restart sgq-backend.service`
- ❌ NON usare `fuser -k 3000/tcp` da solo — systemd lo rilancia immediatamente
- Comando completo: `echo 'Sistemi@2026' | sudo -S systemctl restart sgq-backend.service`

---

## ⚠️ TRAPPOLE CRITICHE (da NON ripetere)


| Trappola                          | Dettaglio                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `tail -N file` dopo `fuser`       | NON funziona su questa shell SSH → usare `cat`                                                                                       |
| Concatenare restart con `;`       | `fuser -k 3000/tcp ; nohup...` → il nohup non parte → comandi su righe separate                                                      |
| Restart con fuser diretto         | Il backend gira su **systemd** → `fuser -k` viene ignorato (systemd rilancia) → usare `systemctl restart`                            |
| SSH da shell Cursor               | La porta 1122 può essere bloccata dalla rete — se timeout, usare PowerShell esterno o verificare con `Test-NetConnection -Port 1122` |
| `clause_number` in query          | La colonna NON esiste → usare `section_code` (errore 500 commit `a298190`)                                                           |
| `<img src="...?token=">`          | CORS blocca su porta 8443 da Netlify → usare `fetch()` + blob                                                                        |
| Package npm `docx`                | Il progetto usa `docxtemplater` + `pizzip` — sono diversi!                                                                           |
| Modificare conformity_status      | CHECK constraint fisso: solo `C NC OSS OM NA NV NULL`                                                                                |
| `question_type` minuscolo         | Il DB usa MAIUSCOLO: `'TEXT'` non `'text'`                                                                                           |
| `checklist_sections.section_code` | `VARCHAR(10)` → max 10 char: `'14001_s4'` ok, `'iso14001_s4'` no                                                                     |
| Migration 010 doppia esecuzione   | Il DB ha già le 35 domande ISO 9001 — verificare con COUNT prima di rieseguire                                                       |
| `standard_id` vs `standard_ids`   | `/audits` (create) usa array `standard_ids: [1,2]`; `/audits/sync` usa scalare `standard_id: 1`                                      |
| Rate limiter 429                  | Dopo molte request → attendere 15 min o riavviare backend                                                                            |


---

## 🧪 CHECKLIST DI VERIFICA PRE-SVILUPPO

```bash
# 1. Backend attivo?
curl https://www.fr-busato.it:8443/health

# 2. Login funziona?
curl -X POST https://www.fr-busato.it:8443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sgq.local","password":"Admin123!"}'

# 3. Domande ISO 9001 nel DB (atteso: 35)
# via SSMS o migration script Node.js:
SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 1;  -- 35
SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 2;  -- 46
```

```javascript
// Browser DevTools Console — stato IndexedDB
const req = indexedDB.open('SGQ_ISO9001');
req.onsuccess = e => console.log('DB version:', e.target.result.version);

// Verifica token (dopo ADR-004 implementato)
localStorage.getItem('authToken');
```

---

## 🚀 PROSSIME AZIONI — Sessione 06/04/2026

### Decisioni architetturali prese (NON riaprire)

1. **Architettura unificata 3 layer** approvata: Core Platform / Domain Modules / UI Components.
2. **HLS discovery**: ISO 9001 + 14001 + 45001 condividono struttura sezioni 4–10. Stesso motore checklist per tutti.
3. **6 entità universali** del Domain Model: Organization, Document, Person, Qualification, Risk, Objective, Action.
4. **Pipeline AI import** documenti normativi: PDF → OCR → LLM extraction → validazione → DB.
5. **Sprint plan A–F** approvato. Vedere `docs/PROJECT_ROADMAP.md §Architettura Unificata`.

---

### ✅ Sprint A — Step 1 COMPLETATO (05/04/2026)


| Artefatto                                        | Stato                | Note                       |
| ------------------------------------------------ | -------------------- | -------------------------- |
| `database/migrations/029_document_registry.sql`  | ✅ creato             | Script SQL idempotente     |
| `backend/scripts/run-migration-029.js`           | ✅ creato ed eseguito | Tabella creata su DB prod  |
| DB: tabella `document_registry`                  | ✅ in produzione      | 22 col, 6 FK, 4 indici     |
| `backend/src/controllers/document.controller.js` | ✅ deployato          | CRUD + stats + soft-delete |
| `backend/src/routes/document.routes.js`          | ✅ deployato          | 6 endpoint                 |
| `backend/src/server.js`                          | ✅ deployato          | Route registrata           |
| Smoke test `/api/v1/documents`                   | ✅ 401 atteso         | Route attiva e auth OK     |


**Nota tecnica**: `database.json` (production) usato per le migration — NON `.env` (ha `#` in password che dotenv interpreta come commento).

---

### ✅ Sprint A — Step 2 COMPLETATO (08/04/2026)

UI DocumentRegistry deployata su Netlify: griglia documenti, filtri, semaforo scadenze, form modale crea/modifica, soft-delete (→ obsoleto), stats bar.

---

### ✅ SPRINT 0 — Navigation Foundation COMPLETATO (08/04/2026)


| Artefatto                                      | Stato       | Note                                                           |
| ---------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `app/src/contexts/RouterContext.jsx`           | ✅ creato    | Router custom su History API, zero dipendenze npm              |
| `app/src/layouts/AppLayout.jsx` + `.css`       | ✅ creato    | Sidebar desktop 230px + bottom nav mobile 5 voci               |
| `app/src/pages/HomePage.jsx` + `.css`          | ✅ creato    | Dashboard "Cosa fare oggi": alert scadenze, NC, accesso rapido |
| `app/src/components/ModuleLocked.jsx` + `.css` | ✅ creato    | Schermata elegante per moduli non ancora attivi                |
| `app/src/App.jsx`                              | ✅ riscritto | Rimosso pattern viewMode → Routes con URL semantici            |
| Build Vite                                     | ✅ 0 errori  | 235 moduli, warning chunk size preesistente                    |
| Commit `cacfa6b` + push                        | ✅ su main   | Netlify auto-deploy attivo                                     |


**Nota tecnica**: npm non riesce a installare su Google Drive (I/O lento per molti file piccoli).
Il RouterContext custom è equivalente a React Router per tutte le funzionalità necessarie ora.
Se si vorrà migrare a `react-router-dom` in futuro, basta eseguire `npm install react-router-dom`
da una cartella locale (es. `C:\progetti\sgq-app`) e poi ricopiare `node_modules`.

---

### 🚀 SPRINT 1 — Document Registry UX (PROSSIMO — prima cosa da fare)

**Obiettivo**: sostituire il pattern `viewMode` con React Router v6 + sidebar persistente.
Senza questo, ogni modulo aggiunto rende App.jsx sempre più ingestibile.

**Passi**:

1. `npm install react-router-dom` nella cartella `app/`
2. Creare `app/src/layouts/AppLayout.jsx` + CSS — sidebar desktop (240px) + bottom nav mobile
3. Creare `app/src/pages/HomePage.jsx` + CSS — dashboard "Cosa fare oggi" (alert scadenze, NC aperte, prossimi audit)
4. Creare `app/src/components/ModuleLocked.jsx` + CSS — placeholder per moduli non ancora attivi
5. Riscrivere `app/src/App.jsx` — sostituire viewMode con `<BrowserRouter><Routes>` con route per ogni sezione
6. Build + smoke + commit + push

**Route map**:

```
/           → HomePage (dashboard alert)
/audit      → Dashboard (audit corrente — comportamento invariato)
/documents  → DocumentRegistry
/qualifiche → ModuleLocked (attivo in Sprint 2)
/saldatura  → ModuleLocked (attivo in Sprint 5)
/companies  → CompaniesPage
/settings   → redirect a /settings/users (solo admin)
/settings/users
/settings/checklist
/settings/templates
/settings/custom-checklists
```

**Nota**: i componenti esistenti mantengono il prop `onBack` — nelle route viene passato `() => navigate(-1)`.

---

---

### ✅ SPRINT 1 — Document Registry UX COMPLETATO (09/04/2026)


| Artefatto               | Stato        | Note                                                                 |
| ----------------------- | ------------ | -------------------------------------------------------------------- |
| `DocumentRegistry.jsx`  | ✅ riscritto  | Tab Priorità/Catalogo, export CSV, inline confirm, rimosso onBack    |
| `DocumentRegistry.css`  | ✅ riscritto  | Priority cards, tab switcher, catalog toolbar, inline confirm styles |
| `DocumentForm.jsx`      | ✅ riscritto  | Wizard 2 passi per nuovo doc, form completo in modifica              |
| `DocumentForm.css`      | ✅ aggiornato | Step indicator, doc-type chip grid, divider, required asterisk       |
| Build Vite              | ✅ 0 errori   | 235 moduli                                                           |
| Commit `fe25fb7` + push | ✅ su main    | Netlify auto-deploy attivo                                           |


**Nota tecnica**: export CSV usa BOM UTF-8 (`\uFEFF`) — apre correttamente in Excel italiano con separatore `;`.

---

### ✅ SPRINT 1 — Bug fix post-test deputy (10/04/2026)


| Bug                                            | Priorità   | Fix applicato                                                      |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| BUG-001: wizard step 2 non mostrato            | 🔴 Critico | Rimosso tag `<form>`, submit ora esclusivamente via `onClick`      |
| BUG-002: tab Priorità sempre "Tutto in ordine" | 🔴 Critico | Risolto a cascata dal BUG-001                                      |
| BUG-003: inline confirm stile diverso da spec  | 🟡 Medio   | Tabella Catalogo ora usa stesso pannello giallo della tab Priorità |
| BUG-004: data mostra `0020/05/2026`            | 🟢 Basso   | Parsing ISO string diretto (YYYY-MM-DD) senza `new Date()`         |


Commit fix: `0300277`

---

### ✅ SPRINT 2 — Alert Engine COMPLETATO (10/04/2026) — DEPLOY VPS PENDENTE


| Artefatto                                          | Stato        | Note                                                   |
| -------------------------------------------------- | ------------ | ------------------------------------------------------ |
| `database/migrations/030_notifications_config.sql` | ✅ creato     | Tabella config destinatari + soglie per organizzazione |
| `backend/scripts/run-migration-030.js`             | ✅ creato     | Script esecuzione migration                            |
| `backend/src/controllers/alert.controller.js`      | ✅ creato     | GET /alerts/count + GET /alerts                        |
| `backend/src/routes/alert.routes.js`               | ✅ creato     | Route alert autenticate                                |
| `backend/src/services/alertScheduler.js`           | ✅ creato     | Cron job 08:00 + template email HTML                   |
| `backend/src/server.js`                            | ✅ aggiornato | alertRoutes + startAlertScheduler integrati            |
| `app/src/services/apiService.js`                   | ✅ aggiornato | getAlertCount() + getAlerts()                          |
| `app/src/layouts/AppLayout.jsx`                    | ✅ aggiornato | Badge rosso su voce "Documenti" in sidebar             |
| `app/src/layouts/AppLayout.css`                    | ✅ aggiornato | Stili badge sidebar (espansa + collassata)             |
| Build Vite                                         | ✅ 0 errori   | 235 moduli                                             |
| Commit `c5bc2f8` + push                            | ✅ su main    | Netlify auto-deploy frontend OK                        |
| **Deploy backend VPS**                             | ✅ completato | Migration 030 + restart — 11/04/2026                   |


**Deploy VPS manuale (da eseguire):**

```bash
cd /var/www/sgq-backend
git pull origin main
npm install node-schedule nodemailer --save
node backend/scripts/run-migration-030.js
echo 'Sistemi@2026' | sudo -S systemctl restart sgq-backend.service
```

**Configurazione SMTP (da aggiungere in .env sul VPS per attivare email):**

```
ALERT_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@qsstudio.it
SMTP_PASS=<app-password>
SMTP_FROM=SGQ Studio <alerts@qsstudio.it>
```

---

### ✅ SPRINT 3 — Impostazioni & Notifiche UI COMPLETATO (11/04/2026) — DEPLOY VPS PENDENTE

| Artefatto | Stato | Note |
| --- | --- | --- |
| `backend/src/controllers/notifications.controller.js` | ✅ creato | GET + PUT /notifications-config + POST /test |
| `backend/src/routes/notifications.routes.js` | ✅ creato | Route autenticate |
| `backend/src/server.js` | ✅ aggiornato | notificationsRoutes integrato |
| `app/src/pages/NotificationsSettingsPage.jsx` | ✅ creato | Form destinatari, soglie, toggle tipi, pulsante test email |
| `app/src/pages/NotificationsSettingsPage.css` | ✅ creato | Toggle switch, card layout, responsive |
| `app/src/services/apiService.js` | ✅ aggiornato | getNotificationsConfig / saveNotificationsConfig / sendTestEmail |
| `app/src/layouts/AppLayout.jsx` | ✅ aggiornato | Voce "🔔 Notifiche" in sidebar (solo admin) |
| `app/src/App.jsx` | ✅ aggiornato | Route /settings/notifications |
| Build Vite | ✅ 0 errori | 237 moduli |
| Commit `08618e8` + push | ✅ su main | Netlify auto-deploy frontend OK |
| **Deploy backend VPS** | ✅ completato | pscp + migration 030 + restart — 11/04/2026 |

**Deploy VPS manuale (da eseguire, include anche Sprint 2 se non fatto):**
```bash
cd /var/www/sgq-backend
git pull origin main
echo 'Sistemi@2026' | sudo -S systemctl restart sgq-backend.service
```

**Decisione architetturale**:
- SMTP = credenziali tecniche del server → `.env` VPS (configurate una volta sola dal tecnico)
- Destinatari + soglie = configurazione dell'organizzazione → tabella `notifications_config` → UI admin
- La pagina Settings → Notifiche è accessibile solo al ruolo `admin`/`superadmin`

---

### 🚀 SPRINT 2B — Gestione file allegati (dopo Sprint 3)

**Obiettivo**: badge alert in sidebar + cron job email giornaliero per scadenze documenti.

**Passi**:

1. **Migration 030**: tabella `notifications_config` (destinatari email + soglie per organizzazione)
2. **Backend `alert.controller.js`**: endpoint `GET /alerts/count` (badge) + `GET /alerts` (lista)
3. **Backend `alertScheduler.js`**: cron job `node-schedule` — ogni giorno ore 08:00, query scaduti/in scadenza, email con `nodemailer`
4. **Frontend badge**: `AppLayout.jsx` → voce "Documenti" mostra badge rosso con conteggio urgenti
5. **Nuovi package**: `node-schedule` + `nodemailer` → installare su VPS dopo deploy

**Attenzione**: NON toccare DocumentRegistry, DocumentForm, backend esistente — funzionano correttamente.

---

### ✅ SPRINT 2B — Gestione file allegati COMPLETATO (11/04/2026)

| Artefatto | Stato | Note |
| --- | --- | --- |
| `database/migrations/031_document_file_attachments.sql` | ✅ creato | Estende `attachments` con `document_id`, `doc_file_version`, `is_current_doc_version` |
| `backend/scripts/run-migration-031.js` | ✅ creato | Script esecuzione migration |
| `backend/src/config/multer.js` | ✅ aggiornato | `uploadDocFile` — blacklist eseguibili, 500 MB, path `uploads/docs/{org}/{docId}/` |
| `backend/src/controllers/docfile.controller.js` | ✅ creato | listDocFiles, uploadDocFile, downloadDocFile |
| `backend/src/routes/docfile.routes.js` | ✅ creato | GET/POST `/documents/:docId/file*` autenticati |
| `backend/src/server.js` | ✅ aggiornato | `docfileRoutes` integrato |
| `app/src/components/DocFileDialog.jsx` | ✅ creato | Dialog upload/download/versioning con storico |
| `app/src/components/DocFileDialog.css` | ✅ creato | UI dialog file |
| `app/src/components/DocumentRegistry.jsx` | ✅ aggiornato | Pulsante 📎 in ogni riga Catalogo |
| `app/src/services/apiService.js` | ✅ aggiornato | getDocFiles, uploadDocFile, getDocFileDownloadUrl |
| Nginx `client_max_body_size` | ✅ configurato | 500m in `/etc/nginx/nginx.conf` |
| Migration 031 su DB | ✅ eseguita | Colonne aggiunte alla tabella `attachments` |
| Build Vite | ✅ 0 errori | 239 moduli |
| Commit `0be6b43` + push | ✅ su main | Netlify auto-deploy frontend OK |
| Deploy backend VPS | ✅ completato | 11/04/2026 |

**Formati accettati**: qualsiasi eccetto `.exe .bat .cmd .ps1 .sh .msi .vbs .jar .com .scr .pif .reg .dll .sys`  
**Dimensione max**: 500 MB per file (configurabile aumentando il limite multer)  
**Lettura PDF**: `?inline=1` nella URL → viewer browser nativo  
**Storico versioni**: visibile nel dialog collassato  

---

### Sprint A — Step 2 (COMPLETATO — archiviato)

```
Costruire il componente React <DocumentRegistry /> per la UI.
Passi:
1. Creare app/src/components/DocumentRegistry/DocumentRegistry.jsx
   - Tabella/griglia documenti con colonne: Codice, Titolo, Tipo, Stato, Scadenza, Azienda
   - Colore semaforo: verde=vigente, giallo=in_scadenza_30gg, rosso=scaduto/obsoleto
   - Pulsanti: Nuovo, Modifica, Archivia (soft delete)
   - Filtri: per tipo documento, per stato, per azienda
2. Creare app/src/components/DocumentRegistry/DocumentForm.jsx
   - Form modale per creazione/modifica documento
   - Campi: doc_type (select), doc_code, title, revision, status, issue_date, expiry_date, responsible, notes
3. Integrare in app/src/services/apiService.js i metodi:
   - getDocuments(filters), getDocumentStats(), createDocument(data), updateDocument(id, data), archiveDocument(id)
4. Aggiungere voce "Documenti" nel menu di navigazione principale
```

**Librerie già disponibili nel frontend**: Axios (API), nessuna griglia dedicata → usare tabella HTML + CSS o valutare `react-table` (già nel progetto?).

**Attenzione**: NON modificare funzionalità esistenti (audit, NC, checklist). Solo aggiungere nuova sezione.

**Componente universale da costruire**:

- `<DataGrid />` — griglia dati con colonne configurabili, ordinamento, filtri, paginazione, export Excel
- Riusato da: Document Registry, Qualifiche, WPS/WPQR, Commesse, Rischi, Obiettivi, Azioni

---

### Sprint B — Alert Engine + Document Browser (dopo A)

- Cron job backend (node-schedule): scadenze qualifiche, documenti, NC aperte, abbonamenti
- Nodemailer: configurazione SMTP + template email alert
- `<DocumentBrowser />`: navigazione cartelle virtuali, filtri, semaforo scadenze
- Tabella `notifications_config`: configurazione destinatari e soglie per organizzazione

---

### Sprint C — Modulo SAL (dopo B)

- SAL = Stato Avanzamento Lavori (Scenario 3 — Camellini)
- Migration: `document_type = 'sal'` in `audits`
- Nuovo componente `<SALModule />`: griglia requisiti × stati, colori per standard
- Word export SAL con legenda colori (nero/blu/verde/rosso/viola)
- Riferimento cliente: `Check List Audit/CLIENTE - SAL documentale iso 14001 - 9001 - 45001.docx`

---

### Sprint D — Modulo Welding ISO 3834 (dopo B)

- Registro WPS/WPQR con `<DataGrid />`
- Gestione qualifiche saldatori con alert scadenza
- Gestione commesse con riesame requisiti e tecnico
- RDP (Rapporto di Prova) — PREREQUISITO: fix foto embedded Word (pic:cNvPr id duplicati)

---

### Sprint E — AI Import Pipeline (dopo D)

- Upload batch PDF con rilevamento tipo documento
- OCR (pdf-parse + Tesseract.js fallback per documenti scansionati)
- LLM extraction con schema Zod per tipo documento
- UI anteprima con confidence score per campo
- Record importati con `import_status = 'ai_draft'` fino a conferma umana

**Tipi documento con schema noto**: patentini ISO 9606, ISO 9712 NDT, WPS, WPQR, Dichiarazioni CE macchine, certificati taratura

---

### Debiti tecnici aperti (non bloccanti per Sprint A)


| Debito                                | Priorità | Note                                                 |
| ------------------------------------- | -------- | ---------------------------------------------------- |
| Fix foto embedded Word                | 🔴       | Blocca modulo RDP per Mason — pic:cNvPr id duplicati |
| Auth mobile ADR-004                   | 🟡       | Loop login Android PWA                               |
| ISO 45001 domande da norma PDF        | 🟡       | Norma disponibile in `docs/Normative/`               |
| `norm_excerpt` in checklist_questions | 🟡       | Alta priorità per report professionali               |
| Token monouso allegati Word           | 🟢       | Sicurezza JWT in link Word                           |
| React Router (navigazione URL)        | 🟢       | Da introdurre per scalabilità navigazione            |


---

*Aggiornato: 08 aprile 2026 — Sprint 0 completato. Navigation Foundation in produzione. Prossimo: Sprint 1 DocumentRegistry UX.*