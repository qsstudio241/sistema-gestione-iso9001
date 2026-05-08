# DEPUTYTASK — Sprint 10: Staging PDF → Document Registry

> **Owner**: Deputy Agent  
> **Lead**: sgq-iso9001-lead  
> **Creato**: 23 aprile 2026  
> **Branch**: `deputy/sprint10-staging-registry`  
> **Prerequisiti**: Sprint 9 (Import PDF batch) ✅

---

## Obiettivo

Collegare il sistema di import PDF (Sprint 9, già in produzione) al **Document Registry** tramite
uno strato di **staging** dove l'utente rivede e approva i dati estratti prima che diventino
documenti ufficiali nel registro.

Flusso target:

```
Upload PDF → AI estrae campi → staging (bozza, needs_review)
  → utente apre scheda → corregge campi incerti → approva (commit)
  → documento creato in document_registry con campi verificati
```

---

## Contesto tecnico

- **Sprint 9 già implementato**: `import_jobs` table, batch PDF upload, `pdf-parse`, confidence
  score, revisione umana base. Codice in `backend/src/controllers/importJobs.controller.js` e
  `frontend/src/pages/ImportJobsPage.jsx`.
- **document_registry già implementata**: tabella con `id, organization_id, title, doc_code,
  status, revision, expiry_date, ...`. CRUD in `backend/src/controllers/document.controller.js`.
- **Flusso attuale Sprint 9**: import_job va in stato `completed` ma NON crea ancora il documento
  nel registry. Il collegamento manca.

---

## Task da implementare

### DB-01 — Tabella `import_staging` (richiede approvazione lead prima di eseguire)

Crea il file `database/migrations/NNN_import_staging.sql` con il contenuto seguente
(il numero di migrazione NNN va determinato leggendo l'ultima migrazione esistente):

```sql
CREATE TABLE import_staging (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    import_job_id   INT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    organization_id INT NOT NULL REFERENCES organizations(id),

    -- Campi estratti dall'AI (editabili dall'utente in revisione)
    proposed_title      NVARCHAR(512),
    proposed_doc_code   NVARCHAR(100),
    proposed_doc_type   NVARCHAR(100),
    proposed_revision   NVARCHAR(50),
    proposed_expiry_date DATE,
    proposed_company_id INT REFERENCES companies(id),
    proposed_notes      NVARCHAR(MAX),

    -- Confidence per campo (0.0–1.0) — campi in giallo se < 0.75
    confidence_title      FLOAT DEFAULT NULL,
    confidence_doc_code   FLOAT DEFAULT NULL,
    confidence_doc_type   FLOAT DEFAULT NULL,
    confidence_expiry_date FLOAT DEFAULT NULL,

    -- Workflow
    status          NVARCHAR(30) NOT NULL DEFAULT 'needs_review',
                    -- needs_review | approved | rejected
    reviewed_by     INT REFERENCES users(user_id),
    reviewed_at     DATETIME,
    commit_doc_id   INT REFERENCES document_registry(id), -- popolato dopo commit

    created_at      DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME NOT NULL DEFAULT GETDATE(),

    INDEX idx_staging_org_status (organization_id, status),
    INDEX idx_staging_job (import_job_id)
);
```

**ATTENZIONE**: non eseguire questa migrazione sul DB di produzione senza approvazione esplicita
del lead (Pascal). Prepara il file, notifica il lead, attendi conferma prima di `run-migration.js`.

### BE-01 — Endpoint staging list

`GET /api/v1/import/staging`

- Ritorna lista staging dell'organizzazione dell'utente con `status = 'needs_review'`
- Campi: `id, import_job_id, proposed_*, confidence_*, status, created_at`
- Ordinamento: `created_at DESC`

### BE-02 — Endpoint staging detail + update

`GET  /api/v1/import/staging/:id`  
`PATCH /api/v1/import/staging/:id`

- GET: ritorna dettaglio record staging (incluso testo estratto dall'import_job)
- PATCH: aggiorna i campi `proposed_*` (revisione utente)
- Body PATCH: `{ proposed_title, proposed_doc_code, proposed_doc_type, proposed_revision, proposed_expiry_date, proposed_company_id, proposed_notes }`

### BE-03 — Endpoint commit (staging → registry)

`POST /api/v1/import/staging/:id/commit`

- Valida che il record sia in stato `needs_review` e appartenga all'org dell'utente
- Crea riga in `document_registry` con i campi `proposed_*` verificati
- Aggiorna `import_staging.status = 'approved'`, `commit_doc_id`, `reviewed_by`, `reviewed_at`
- Aggiorna `import_jobs.status = 'completed_committed'` (o aggiunge colonna se non esiste)
- Ritorna `{ document_id, document_registry_url }`

### BE-04 — Endpoint reject

`POST /api/v1/import/staging/:id/reject`

- Aggiorna `import_staging.status = 'rejected'`
- Body: `{ reason }` (salvato in `proposed_notes` come prefisso "RIFIUTATO: ...")

### BE-05 — Popola staging da import_job (hook post-import)

Nel `importJobs.controller.js`, dopo che un job raggiunge `status = 'completed'`, crea
automaticamente un record in `import_staging` con i campi estratti dall'AI.

Mappatura campi:
- `extracted_data.title` → `proposed_title`
- `extracted_data.doc_code` → `proposed_doc_code`
- `extracted_data.doc_type` → `proposed_doc_type`
- `extracted_data.expiry_date` → `proposed_expiry_date`
- `extracted_data.revision` → `proposed_revision`
- `confidence` scores dall'output AI → colonne `confidence_*`

### FE-01 — Pagina revisione staging

Nuova pagina `app/src/pages/ImportStagingPage.jsx`:

- Lista record con `status = 'needs_review'`
- Card per ogni documento con:
  - Campi modificabili (input text/date per i campi `proposed_*`)
  - Indicatori confidence: 🟢 ≥0.85, 🟡 0.60–0.84, 🔴 <0.60
  - Pulsanti: **Approva** (commit) e **Rifiuta**
- Dopo approvazione: mostra link al documento creato nel registry
- Route: `/import/staging`

### FE-02 — Badge sidebar per staging in attesa

In `AppLayout.jsx`, aggiungere badge alert nella voce "Import PDF" quando ci sono record
`needs_review` (polling ogni 5 minuti, come già fatto per documenti e reclami).

Chiama: `GET /api/v1/import/staging?count_only=true` (aggiungi questo endpoint in BE-01).

---

## Definition of Done (DoD)

- [ ] `import_staging.sql` preparato (approvazione lead prima di eseguire)
- [ ] Tutti gli endpoint BE (BE-01..05) operativi e testati con curl/Postman
- [ ] `ImportStagingPage.jsx` renderizza lista, permette editing campi e approva/rifiuta
- [ ] Dopo commit: documento appare in `/documents` con i campi verificati
- [ ] Badge sidebar mostra count staging in attesa
- [ ] `npm run test:run` passa (aggiungi almeno 1 test L1 per il commit endpoint)
- [ ] Deploy VPS: `deploy-controllers-to-vps.ps1` aggiornato con i nuovi controller

---

## File da toccare

| File | Azione |
|------|--------|
| `database/migrations/NNN_import_staging.sql` | Crea (approvazione lead) |
| `backend/src/controllers/importStaging.controller.js` | Crea |
| `backend/src/routes/importStaging.routes.js` | Crea |
| `backend/src/controllers/importJobs.controller.js` | Modifica (hook post-import) |
| `backend/src/server.js` | Registra route |
| `app/src/pages/ImportStagingPage.jsx` | Crea |
| `app/src/App.jsx` | Aggiungi route `/import/staging` |
| `app/src/layouts/AppLayout.jsx` | Badge staging |
| `app/src/services/apiService.js` | Aggiungi metodi `getImportStaging*` |

---

## Note

- **Sicurezza**: ogni endpoint filtra per `organization_id = req.user.organization_id` (RBAC)
- **Licenza**: proteggere con `requireLicensedModule('ai_import')` come ImportJobsPage
- **Branch**: crea `deputy/sprint10-staging-registry` da `main`, NON pushare su `main` direttamente
- **Approvazione migrazione DB**: notifica il lead (Pascal) prima di eseguire `run-migration.js` in produzione
