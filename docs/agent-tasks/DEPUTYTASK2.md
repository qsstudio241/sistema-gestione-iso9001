# DEPUTYTASK2 — CTX-2: Badge % + wizard contesto azienda (CompanyDetail)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CTX-1 #664)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § CTX-2  
**Rischio:** Medio — API additiva su GET/PUT companies + UI CompanyDetail; niente auth/sync/migrazioni  
**Branch:** `cursor/ctx2-badge-wizard-company-8269`  
**Compare:** https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/ctx2-badge-wizard-company-8269?expand=1  
**Slot precedente:** CTX-1 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert #3 HITL APERTO — **NON toccato**

---

## Esito

**TEST OK**

- GET/PUT `/companies/:id` include `ai_context` (`scoreCompanyContext`, company-v1)
- Badge % + livello + checklist missing su CompanyDetail → Anagrafica
- Anteprima live via mirror FE `company-v1` in `aiContextRubrics.js`
- HITL: salvataggio solo su «Salva anagrafica»
- L1: Jest controller + Vitest FE + build OK
- Deploy VPS OK (PID restart + health 200); smoke API `ai_context.version=company-v1`
- Alert #3 non toccato
- PR create 403 → compare URL sopra

## File toccati

- `backend/src/controllers/company.controller.js` (+ `company.controller.aiContext.test.js`)
- `app/src/data/aiContextRubrics.js` (+ test company-v1)
- `app/src/pages/CompanyDetailPage.jsx`
- `app/src/tests/companyAiContextWizard.test.jsx`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`

## Cosa NON toccato

- `qualificationAlert.service.js` / Alert UI / `DEPUTYTASK.md` (HITL #3)
- Auth / sync / JWT / migrazioni
- `computeProfileCompleteness` / ADR-018
- Studio CTX-1 / JSON / enrichment / OAuth

## Bozza hub (parallelo HITL — sync dopo merge)

Roadmap § Stato attuale: priorità #1 → CTX-2 ✅ / next CTX-3; sessione «CTX-2 badge/wizard azienda».  
GUIDA: nessuna lezione nuova (riuso pattern CTX-1).
