# DEPUTYTASK1 — ING-4: Template checklist Riesame requisiti personalizzabile (studio)

**Stato:** APERTO  
**Aperto:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § ING-4  
**Rischio:** Medio — migrazione additiva 162 + API template + hook snapshot in `generateChecklist`; niente auth/sync breaking  
**Branch:** `cursor/ing4-checklist-templates-1c5d`  
**Parallelo a:** ING-1 su [`DEPUTYTASK.md`](DEPUTYTASK.md) — **file disgiunti** (non toccare catalogo allegati / `ContractReviewPage` HITL batch)  
**Migrazione prenotata:** `162_commercial_checklist_templates.sql`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Obiettivo verificabile

Lo studio gestisce **template checklist** Riesame requisiti (voci P/F) associabili a un cliente (`company_id`) o default org. All’applicazione su un caso: **snapshot** in `commercial_case_checklist` (INSERT solo se ref assente) — non sovrascrive checklist già compilate. Fedeltà ISO §8.2: core P1–P10 / F1–F6 sempre presenti; personalizzazione = variante testo core e/o voci extra, non bypass norma.

## File previsti

- `database/migrations/162_commercial_checklist_templates.sql` + `backend/scripts/run-migration-162-vps.js`
- `backend/src/data/commercialChecklistDefaults.js`
- `backend/src/services/commercialChecklistTemplate.service.js` (+ test Jest)
- `backend/src/controllers/commercialChecklistTemplate.controller.js`
- `backend/src/routes/commercialChecklistTemplate.routes.js`
- `backend/src/server.js` (mount route)
- `backend/src/controllers/contractReview.controller.js` (solo resolve items in generateChecklist + seed import)
- `backend/scripts/deploy-manifest.json`
- `app/src/data/commercialChecklistDefaults.js` (+ test Vitest)
- `app/src/pages/ContractChecklistTemplatesPage.jsx` (+ CSS minimo token esistenti)
- `app/src/App.jsx` / `app/src/layouts/AppLayout.jsx` / `app/src/services/apiService.js`
- `docs/agent-tasks/DEPUTYTASK1.md` (questo brief)
- PLAN: solo riga ING-4 se sicuro; altrimenti nota qui (parallelo PR #623 / ING-1)

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (slot ING-1)
- `ContractReviewPage.jsx` / CSS HITL batch / `caseDocCatalog*`
- `importJobs*`, ingest staging, auth/JWT, sync
- Export Word VC-4 (`wordExportContractReviewChecklist.js`) — legge già lo snapshot caso

## Come lo studio personalizza (UX)

1. Gestione → **Template checklist riesame** (`/settings/contract-checklist-templates`)
2. Crea template (seed automatico core §8.2) → opzionale associa azienda cliente
3. Aggiunge voci extra (es. `P11`) o modifica testo variante core
4. Su caso: «Genera preliminare/finale» usa template azienda se attivo, altrimenti default org, altrimenti solo core — snapshot additivo

## Criteri chiusura

- [ ] Resolve: core sempre; extras da template; snapshot NOT EXISTS
- [ ] UI CRUD minima + test L1 + build
- [ ] PR/compare; DEPUTYTASK1 CHIUSO TEST OK
