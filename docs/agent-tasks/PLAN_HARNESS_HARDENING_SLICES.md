# Piano slice — Hardening harness doppio (sviluppo + prodotto AI)

> **Obiettivo**: chiudere i gap strutturali emersi dall’audit harness (giugno 2026): allineare governance Cursor, alleggerire memoria operativa, completare collare AI runtime (NormBroker, licenze, audit trail, gap analysis MVP).
> **Brief attivo**: [`DEPUTYTASK.md`](DEPUTYTASK.md)
> **Branch suggerito**: `cursor/harness-hardening-hk-6b60` (una PR per slice o PR cumulativa se CI verde e diff reviewabile)

---

## Risposta: si può fare?

**Sì, ma non in un unico commit.** Il lavoro è **10 slice verticali** (HK-1 … HK-10), ognuna con DoD verificabile. Il deputy esegue **in ordine** salvo dove indicato parallelismo sicuro.

**Fuori scope** (richiedono credenziali umane o finanziamento):
- WebScraper UNI Store con login reale (HK-7 prepara connettore stub + mock test)
- pgvector / PostgreSQL (RAG resta su SQL Server embedding JSON)
- Streaming chat real-time (resta JSON completo; documentare in ADR-010 nota implementativa)
- Deploy VPS produzione (solo TEST se serve smoke backend; prod = nota per committente)

---

## Mappa slice

| Slice | Tema | Perimetro | PR separata? |
|-------|------|-----------|--------------|
| **HK-1** | Governance agenti dev | ADR, `.github/agents`, regole `.mdc` | Sì |
| **HK-2** | Alleggerire GUIDA | Diario → archive, link roadmap | Sì |
| **HK-3** | Igiene repo + smoke catalog | `.gitignore`, stub, tabella smoke | Sì |
| **HK-4** | Unificare AI riesame | FE+BE percorso canonico | Sì |
| **HK-5** | Audit trail completo | import, riesame, feedback | Dopo HK-4 |
| **HK-6** | Licenze AI allineate | routes + admin UI | Dopo HK-4 |
| **HK-7** | NormBroker v1 cascata | local → public law → log access | Sì |
| **HK-8** | Gap analysis MVP | service + API + pagina minima | Dopo HK-7 |
| **HK-9** | UX AI compliance | disclaimer, AiSuggestionInline | Sì |
| **HK-10** | Chiusura doc + test L1 | GUIDA lezione, test mirati | Finale |

---

## HK-1 — Governance harness sviluppo

### Problema
Convivono ADR-001 (Copilot 3-agenti) e workflow Cursor Lead/Deputy; path obsoleti (`src/` vs `app/`); regola encoding corrotta.

### Scope
- Creare **`docs/adr/ADR-015-cursor-lead-deputy-workflow.md`** (Stato: Accettato) che **supera** ADR-001 per lo sviluppo corrente.
- In **`docs/adr/ADR-001-multi-agent-workflow.md`**: aggiungere in testa blocco **Stato: Superato da ADR-015** (non cancellare storico).
- Aggiornare **`docs/adr/README.md`**: processo approvazione = Lead prepara brief → Deputy esegue → merge PR; rimuovere riferimenti Planner/Implementer come workflow attivo.
- In **`docs/INDICE_DOCUMENTAZIONE.md`**: sezione harness — marcare `.github/agents/` e `.github/copilot-instructions.md` come **legacy / non usare**.
- Riparare **`.cursor/rules/sgq-encoding-quality.mdc`** (UTF-8, accenti italiani corretti).
- In **`sgq-operating-memory.mdc`**: unificare le **due** sezioni «Approvazione esplicita dell'utente» in una sola; tabella riuso UI → link a `docs/reference/LIBRERIA_UI_SGQ.md` (tenere max 5 righe riassunto).

### DoD
- [ ] ADR-015 committato; ADR-001 marcato Superato
- [ ] `node backend/scripts/check-utf8-encoding.js .cursor/rules/sgq-encoding-quality.mdc` OK
- [ ] Nessun `U+FFFD` in file toccati
- [ ] README ADR coerente con Lead/Deputy

### Test L1
- Solo doc/rules — nessun test app; verifica encoding script.

---

## HK-2 — Alleggerire GUIDA_CONSOLIDATA

### Problema
~3700 righe; diario sessioni duplica «Lezioni apprese»; link roadmap `#coda-prossimi-task` rotto; sezione E duplicata.

### Scope
- Spostare blocco **diario cronologico sessioni** (da riga ~1268 in giù, se delimitabile) in **`docs/archive/sessions/GUIDA_DIARIO_2026.md`**.
- In **`GUIDA_CONSOLIDATA.md`**: lasciare indice + lezioni consolidate + procedure A–F; sostituire diario con link all’archive.
- Correggere **numerazione sezione E** duplicata (un solo «Flusso SAL», ripristino idee in sottosezione o roadmap).
- Aggiornare **`PROJECT_ROADMAP.md`**: link a `DEPUTYTASK.md` e a questo piano; rimuovere anchor `#coda-prossimi-task` se assente.
- Aggiungere in **`PROJECT_CONTEXT.md`** (≤15 righe) paragrafo **«Harness agentico»** con link ADR-015 + ADR-010.

### DoD
- [ ] GUIDA ridotta di almeno ~1500 righe (diario fuori)
- [ ] Link roadmap funzionanti
- [ ] Archive consultabile; nessun contenuto perso

### Test L1
- Grep link rotti `](#sessione-` verso anchor ancora in GUIDA (fix se broken).

---

## HK-3 — Igiene repo e catalogo smoke

### Scope
- **`.gitignore`**: ignorare `.cursor/_*.cjs`, `.cursor/_*.mjs`, `.cursor/rbac-smoke-*.txt`, `.cursor/*-result.json`, `.cursor/_pr-body-*.md` (non ignorare `skills/`, `mcp.env.example`, script smoke ufficiali documentati).
- Spostare stub **`docs/agent-tasks/TASK_AI_*`** (solo redirect) in archive; lasciare stub 3 righe che puntano all’archive.
- Eliminare o spostare in archive **`DEPUTYTASK_UI_CATALOG.md`** (root) se obsoleto/encoding rotto.
- Aggiungere tabella **«Catalogo smoke harness»** in `docs/GUIDA_CONSOLIDATA.md` (sezione D o nuova sottosezione):

| Modulo | Script | Livello |
|--------|--------|---------|
| CI PR | `.github/workflows/ci-app-pr.yml` | L1 |
| Backend test | `.github/workflows/smoke-test.yml` | L2 |
| Ingest E2E | `backend/scripts/smoke-ingest-e2e-test.js` | L3 |
| VPS preflight | `backend/scripts/vps-preflight.ps1` | ops |
| … | (completare i principali) | |

### DoD
- [ ] `.gitignore` aggiornato
- [ ] Stub AI archiviati
- [ ] Tabella smoke ≥8 voci documentate

---

## HK-4 — Percorso canonico AI riesame contratto

### Problema
`ContractReviewPage.jsx` usa `POST /ai/suggest` (`ai_assist`); esiste `POST /contract-reviews/:id/ai/analyze-requirements` (`ai_review`) con logica parallela in `contractReview.controller.js`.

### Decisione (vincolante)
**Canonico**: `POST /contract-reviews/:id/ai/analyze-requirements` sotto licenza **`ai_review`**.
- Il controller delega a `aiContextBuilder.buildReviewRequirementsContext` + adapter (già presente o da estrarre).
- **`POST /ai/suggest`** con `feature=review_requirements` resta per compatibilità ma **deprecato** (log warn) oppure thin wrapper che richiede `caseId` e inoltra — scegliere una sola implementazione interna (`reviewRequirementsAi.service.js` nuovo file ≤150 righe ammesso).

### Scope file
- `backend/src/controllers/contractReview.controller.js` — `analyzeRequirements`
- `backend/src/controllers/aiAssist.controller.js` — rimuovere duplicazione o delegare
- `app/src/pages/ContractReviewPage.jsx` — usare `apiService.analyzeContractRequirements` (o equivalente) invece di `useAiAssist` per analisi capitolato
- `app/src/services/apiService.js`
- Test: `backend/src/controllers/contractReview.test.js` o nuovo test mirato

### DoD
- [ ] UI riesame chiama solo endpoint canonico
- [ ] Una sola implementazione business per `review_requirements`
- [ ] Test L1 backend verde sul percorso scelto

---

## HK-5 — Audit trail AI esteso

### Scope
Estendere `logAiInteraction` (o chiamate dirette al service di persistenza) a:
- `POST .../ai-extract` in **`importJobs.controller.js`** → feature `import`
- `analyzeRequirements` → feature `review` (middleware o call inline dopo risposta)
- `POST /ai/feedback` → feature `assist` o `feedback` (coerente con schema `ai_interactions.feature`)

File: `backend/src/middleware/aiAuditTrail.middleware.js`, routes import, contractReview.

### DoD
- [ ] Test `aiAuditTrail.test.js` esteso per almeno 1 nuovo feature
- [ ] Nessun segreto/prompt intero in `context_summary` (max 500 char come ADR-010)

---

## HK-6 — Licenze AI enforcement + admin

### Scope
- **`normBroker.routes.js`**: `requireLicensedModule('ai_norms')` su tutte le GET `/norms/*`
- **`aiChat.routes.js`**: `requireLicensedModule('ai_chat')` al posto di `ai_assist`
- **`AppLayout.jsx` / `App.jsx`**: route chat → `licenseKey: "ai_chat"` se separata; Assistente AI resta `ai_assist` per suggest non-chat
- **`app/src/components/UsersAdminPage.jsx`**: elencare tutte le chiavi AI: `ai_import`, `ai_assist`, `ai_norms`, `ai_review`, `ai_chat`
- **`moduleLicense.service.js`**: verificare KNOWN_MODULE_KEYS già complete

### DoD
- [ ] 403 coerente senza licenza su norme e chat
- [ ] Superadmin può assegnare tutte le chiavi da UI
- [ ] Test mirato su middleware licenza (se esiste) o test route mock

---

## HK-7 — NormBroker v1 (cascata minima)

### Scope
Refactor **`normBroker.service.js`**:

```
getClauseText(standardCode, clauseRef):
  1. localStoreConnector
  2. normativaConnector / publicLaw (se configurato) — solo lettura, no scraper login
  3. null + log

searchByCode(code):
  stessa cascata

on hit da fonte non locale:
  - upsert in norm_requirements (service dedicato, idempotente)
  - insert norm_access_log (organization_id da caller, standard_code, source, created_at)
```

- Passare `organizationId` dal controller (`req.user.organization_id`).
- Test unitario con mock connettori.
- **Non** implementare UNI Store scraper in questa slice.

### DoD
- [ ] Cascata documentata in commento + ADR-010 nota «implementazione parziale v1»
- [ ] `norm_access_log` riceve almeno 1 riga in test
- [ ] Graceful degradation se connettore esterno down

---

## HK-8 — Gap analysis MVP (Fase 2 ADR-010)

### Scope minimo (non la UI semaforo completa)
- **`backend/src/services/gapAnalysis.service.js`**:
  - Input: `organizationId`, `companyId`, `standardCode`
  - Per ogni clausola in `norm_requirements` (is_current=1): cerca match keyword in `document_registry` (title + type_specific_data JSON) per quella company
  - Output: `{ clauseRef, title, coverage: 'covered'|'partial'|'missing', evidence: [{docId, title}] }`
- **`backend/src/controllers/gapAnalysis.controller.js`** + route `GET /gap-analysis` con `ai_norms` o `ai_review` (scegliere `ai_norms`)
- **`app/src/pages/GapAnalysisPage.jsx`** minima: select standard + company (pattern Ambito) + tabella risultati
- Registrare route in `App.jsx` con `LicensedRoute`

### DoD
- [ ] API restituisce matrice per ISO_9001_2015 su company di test
- [ ] Pagina renderizza senza errori console
- [ ] Test service con DB mock o fixture

### Nota
Copertura «partial» euristico: ≥1 token significativo match → partial; ≥2 doc o match titolo → covered.

---

## HK-9 — UX compliance AI

### Scope
- Componente **`AiDisclaimer.jsx`** (testo ADR-010 §9): mostrare in `ContractReviewPage`, `AiAssistantPage`, `AiConclusionsModal`, `GapAnalysisPage` (footer non invasivo).
- **`AiSuggestionInline.jsx`**: se `suggestion` è oggetto non mappato, mostrare campi leggibili (non `JSON.stringify` grezzo).

### DoD
- [ ] Disclaimer visibile sui 4 flussi
- [ ] UTF-8 corretto, no emoji non richieste

---

## HK-10 — Chiusura documentazione e test

### Scope
- **`GUIDA_CONSOLIDATA.md`**: riga in «Lezioni apprese» — harness hardening HK, con link a questo piano e PR.
- **`docs/adr/ADR-010-ai-agentic-architecture.md`**: sezione breve «Stato implementazione 2026-06» (NormBroker v1, gap MVP, licenze, audit trail).
- Eseguire test L1:
  - `backend`: test mirati ai file HK-4/5/7/8
  - `app`: `NODE_ENV=test` vitest mirato se toccato FE (o build Vite se solo pagine semplici)

### DoD finale (intero piano)
- [ ] Tutte le slice HK-1…HK-10 completate **oppure** elencate in DEPUTYTASK con `FIX NON APPLICABILI`
- [ ] CI PR verde
- [ ] DEPUTYTASK aggiornato con tabella stato slice

---

## Ordine di esecuzione e parallelismo

```
HK-1 ──┬── HK-2 ── HK-3
       │
       └── HK-4 ── HK-5 ── HK-6
                    │
HK-7 ──────────────┴── HK-8
HK-9 (dopo HK-4, parallelizable con HK-7)
HK-10 (sempre ultimo)
```

**Regola**: commit atomico per slice; push; aggiornare tabella stato in `DEPUTYTASK.md` prima di passare alla slice successiva.

---

## Riferimenti

- Audit harness conversazione giugno 2026 (Lead)
- [ADR-010](../adr/ADR-010-ai-agentic-architecture.md)
- [ADR-001](../adr/ADR-001-multi-agent-workflow.md) → superato da ADR-015
- [MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md](MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md)
