# DEPUTYTASK2 — CTX-1: Badge % + wizard contesto studio (Il mio Studio)

**Stato:** APERTO  
**Aperto:** 07/09/2026 (post-merge CTX-0 #663)  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § CTX-1  
**Rischio:** Medio — API additiva su `organizations/me` + UI Studio; niente auth/sync/migrazioni  
**Branch:** `cursor/ctx1-badge-wizard-studio-8269`  
**Slot precedente:** CTX-0 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert #3 HITL APERTO — **NON toccare**

---

## Perché

Dopo CTX-0 (rubrica + scorer zero-LLM) manca la UI: badge completezza contesto AI e guida (wizard) sui campi mancanti in **Il mio Studio**.

## File previsti

- `backend/src/controllers/organization.controller.js` — allega `ai_context` (score/level/missing) a GET/PATCH `/organizations/me`
- `app/src/pages/StudioSettingsPage.jsx` (+ CSS se minimo) — badge + checklist missing
- `app/src/data/aiContextRubrics.js` (+ test) — mirror FE per anteprima live (stessa rubrica `studio-v1`)
- `app/src/tests/studioAiContextWizard.test.jsx` — badge / missing
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md` — DoD CTX-1
- `docs/agent-tasks/DEPUTYTASK2.md` — questo brief

## Cosa NON toccare

- `qualificationAlert.service.js` / Alert UI (`DEPUTYTASK.md` HITL)
- Auth / sync / JWT / migrazioni
- `computeProfileCompleteness` / ADR-018 (non fondere)
- OAuth / CTX-3–4 / persistenza strutturata CTX-2
- Wizard azienda (`company-v1`) — slice successiva se serve
- `AiAssistantPage` (badge lì solo se tempo; non obbligatorio)

## DoD

- [ ] GET/PATCH `/organizations/me` restituisce `ai_context` da `scoreStudioContext` (zero LLM)
- [ ] Badge % + livello (`incompleto`/`parziale`/`pronto`) su tab Anagrafica → Contesto Assistente AI
- [ ] Checklist campi mancanti con label rubrica; anteprima live mentre si digita
- [ ] Salvataggio solo su conferma esplicita («Salva») — no auto-write
- [ ] Test L1 FE + build; deploy-manifest invariato se nessun `.js` nuovo in `backend/src/` oltre controller già listato
- [ ] Alert #3 non toccato

## HITL

Scrittura profilo/note: resta il pulsante **Salva personalizzazioni** (già presente). Non salvare su blur/keystroke.
