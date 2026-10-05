# DEPUTYTASK — COV-1: Chassis copertura scalabile + adapter welder_9606

**Stato:** CHIUSO — TEST OK  
**Aperto:** 05/10/2026  
**Chiuso:** 05/10/2026  
**Piano:** [`PLAN_COPERTURA_SCALABILE_SLICES.md`](PLAN_COPERTURA_SCALABILE_SLICES.md) § COV-1  
**Rischio:** Medio — BE/FE additivo; nessuna migrazione  
**Branch:** `cursor/copertura-scalabile-fetta2-098a`  
**PR:** https://github.com/qsstudio241/sistema-gestione-iso9001/pull/702 (draft)  
**Slot precedente:** Alert #3 CHIUSO — sovrascrittura consentita  

---

## Esito

**TEST OK**

- Chassis `backend/src/services/capabilityCoverage/` (nome ≠ `coverage/` per `.gitignore` Jest)
- Adapter `welder_9606` completo su validità; stub `wpqr_procedure`; match minimo `cnd_9712`
- API `GET …/coverage/domains` + `POST …/coverage/verify`
- UI `CoverageVerifyPanel` su Qualifiche
- Jest 13/13 · Vitest 3/3 · `npm run build` OK · harness boot OK
- **Nessuna migration VPS**

## File toccati

- `docs/agent-tasks/PLAN_COPERTURA_SCALABILE_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK.md`
- `backend/src/services/capabilityCoverage/**`
- `backend/src/controllers/qualifications.controller.js`
- `backend/src/routes/qualifications.routes.js`
- `backend/scripts/deploy-manifest.json`
- `app/src/components/CoverageVerifyPanel.jsx`
- `app/src/tests/coverageVerifyPanel.test.jsx`
- `app/src/pages/QualificationsPage.jsx` / `.css`
- `app/src/services/apiService.js`
- `docs/reference/LIBRERIA_UI_SGQ.md`
- `PROJECT_CONTEXT.md` · `docs/PROJECT_ROADMAP.md`

## Cosa NON toccato

- Generatore WPS, ingest, auth/sync, migrazioni SQL, JEV, Acrobat

## Prossime fette

- COV-2 WPQR pieno · COV-3 CND pieno · COV-4/5 ponte commessa/UI
