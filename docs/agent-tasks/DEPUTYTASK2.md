# DEPUTYTASK2 — CTX-1: Badge % + wizard contesto studio (Il mio Studio)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CTX-0 #663)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § CTX-1  
**Rischio:** Medio — API additiva su `organizations/me` + UI Studio; niente auth/sync/migrazioni  
**Branch:** `cursor/ctx1-badge-wizard-studio-8269`  
**Slot precedente:** CTX-0 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert #3 HITL APERTO — **NON toccato**

---

## Esito

**TEST OK**

- GET/PATCH `/organizations/me` include `ai_context` (`scoreStudioContext`, studio-v1)
- Badge % + livello + checklist missing su Il mio Studio → Contesto Assistente AI
- Anteprima live via mirror FE `app/src/data/aiContextRubrics.js`
- HITL: salvataggio solo su «Salva personalizzazioni»
- L1: Jest org controller + rubriche; Vitest FE (6) + build OK
- Alert #3 non toccato

## File toccati

- `backend/src/controllers/organization.controller.js` (+ test aiContext)
- `app/src/pages/StudioSettingsPage.jsx` / `.css`
- `app/src/data/aiContextRubrics.js` (+ test)
- `app/src/tests/studioAiContextWizard.test.jsx`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`

## Cosa NON toccato

- `qualificationAlert.service.js` / Alert UI (HITL)
- Auth / sync / JWT / migrazioni
- `computeProfileCompleteness` / ADR-018
- Wizard azienda `company-v1` / CTX-2…4
- OAuth
