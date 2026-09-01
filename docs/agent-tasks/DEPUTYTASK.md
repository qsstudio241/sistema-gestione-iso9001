# DEPUTYTASK — VC-1: Report gap capacità v0 (output studio)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 01/09/2026  
**Chiuso:** 01/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § VC-1  
**Rischio:** Medio — BE additivo (snapshot report) + FE pannello minimo; migrazione **161** nullable/additiva  
**Branch:** `cursor/vc1-capability-gap-report-1c5d`  
**PR:** (da aggiornare al push — link sotto Esito)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito deputy

**TEST OK** — report gap capacità persistito end-to-end (service + GET/POST + UI «Report studio»).

| Voce | Dettaglio |
|------|-----------|
| Persistenza | mig. **161**: `commercial_cases.capability_gap_report_json` + `capability_gap_report_at` (nullable) |
| Service | `caseCapabilityGapReport.service.js` riusa `loadExtractedRequirements` / `computeCaseProjectCoverage` / `buildCaseCoverageAdvisory` |
| API | `GET/POST /contract-reviews/:id/capability-gap-report` (stesso guard `ai_review`) |
| UI | pannello «Report studio» in `ContractReviewPage` (`.cr-panel`), CoveragePanel intatto |
| Test L1 | BE: service + controller + migration uniqueness; FE: `npm run build` OK |
| Deploy | `deploy-manifest.json` aggiornato; runner `run-migration-161-vps.js` |

**Prossima slice:** VC-2 (dopo merge PR + migrazione VPS).

---

## Perché (prodotto)

Lo studio riceve documenti cliente, li collega al caso con **azienda appaltatrice** (capacità), ma oggi la copertura è solo **vista live** (CoveragePanel / advisory). Manca un **artefatto report persistito** riusabile come output della gap analysis. VC-1 è l’hello world end-to-end più piccolo: aggregare ciò che già esiste e salvarlo sul caso.

## Obiettivo

Su un `commercial_case` con `company_id` (azienda SGQ capacità) e, se presenti, requisiti estratti / copertura calcolabile:

1. Generare uno **snapshot report gap capacità** (JSON strutturato) riusando i servizi già in repo.
2. **Persistere** lo snapshot sul caso (colonna JSON nullable **oppure** tabella sottile dedicata — Gate Ponytail: preferire estensione minima; dichiarare N migrazione **prima** di creare il file in `database/migrations/`).
3. Esporre **GET** (leggi ultimo snapshot) + **POST** (ricalcola e salva) sotto le route `contract-reviews` esistenti (stesso guard/RBAC/org scope).
4. UI minima in `ContractReviewPage`: pannello «Report studio» con esito sintetico (ok / gap / need_input) e data generazione — DNA esistente (`.cr-panel`), niente look nuovo.
5. Test L1 BE (e Vitest FE se tocchi logica UI non banale) + `npm run build` in `app/`.

## DoD

- [x] Service aggregatore (`caseCapabilityGapReport.service.js`) chiama in lettura i mattoni esistenti — **non** duplicare algoritmi di match
- [x] Persistenza multi-tenant; senza `company_id` → 400 chiaro
- [x] Endpoint GET + POST documentati nel test; response stabile (summary + lista gap)
- [x] Pannello UI visibile sul dettaglio caso; non rompe CoveragePanel esistente
- [x] `deploy-manifest.json` aggiornato
- [x] Test L1 verdi; PLAN VC-1 spuntato
- [x] Nessuna modifica a auth/sync; nessuna riscrittura ingest/SAL

## File previsti / toccati

- `backend/src/services/caseCapabilityGapReport.service.js` (+ `.test.js`)
- `backend/src/controllers/contractReview.controller.js` (+ test)
- `backend/src/routes/contractReview.routes.js`
- `database/migrations/161_commercial_cases_capability_gap_report.sql` + `run-migration-161-vps.js`
- `app/src/pages/ContractReviewPage.jsx` (+ CSS)
- `app/src/services/apiService.js`
- `backend/scripts/deploy-manifest.json`
- `docs/agent-tasks/PLAN_VALUTAZIONE_COMMESSE_SLICES.md`
- questo brief → CHIUSO

## Cosa NON toccare

- `gapAnalysis.service.js` / `SALModule.jsx` (SAL ≠ questo report)
- `documentIngestPipeline` / pipeline Material Compliance / WPQR ingest
- `auth.middleware.js`, `syncService.js`, JWT
- Offerta, chiarimenti automatici, PPAP, ordini fornitori (VC-5+)
- `ProjectsPage` / CRUD commesse 3834 salvo link read-only già usato da coverage
- Altri `DEPUTYTASK*` / PLAN di altri epic
- GUIDA intera (lezione breve solo a slice chiusa se unica chat)

## Criteri

| Esito | Quando |
|-------|--------|
| **TEST OK** | DoD soddisfatto; L1 verdi; snapshot ricalcolabile e riletto dopo refresh |
| **FIX NON APPLICABILI** | Su `main` esiste già report persistito equivalente end-to-end (documentare path + PR); oppure manca prerequisito prodotto bloccante non aggirabile (es. assenza totale tabelle caso — improbabile) |

## Note per il deputy

- Charting Lead **non** ha implementato codice applicativo: solo PLAN + questo brief.
- Preferire tante slice sottili: **non** aggiungere export Word/PDF in VC-1 (è VC-4).
- Se CoveragePanel già mostra tutto ma senza persistenza, VC-1 resta **applicabile** (la persistenza è il DoD).
