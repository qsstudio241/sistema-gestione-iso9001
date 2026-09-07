# DEPUTYTASK2 — CTX-2: Badge % + wizard contesto azienda (CompanyDetail)

**Stato:** APERTO  
**Aperto:** 07/09/2026 (post-merge CTX-1 #664)  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § CTX-2  
**Rischio:** Medio — API additiva su GET/PUT companies + UI CompanyDetail; niente auth/sync/migrazioni  
**Branch:** `cursor/ctx2-badge-wizard-company-8269`  
**Slot precedente:** CTX-1 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert #3 HITL APERTO — **NON toccare**

---

## Obiettivo

Su **scheda azienda** (Anagrafica) mostrare score contesto AI vs rubrica `company-v1` e checklist campi mancanti. Zero LLM. Nessuna migrazione. HITL: salvataggio solo su «Salva anagrafica» (niente auto-save). Riuso UI da CTX-1 (`StatusBadge`, classi `studio-ai-context-*`).

## File previsti

- `backend/src/controllers/company.controller.js` (+ test `company.controller.aiContext.test.js`)
- `app/src/data/aiContextRubrics.js` (+ test company-v1)
- `app/src/pages/CompanyDetailPage.jsx` (badge + wizard in TabAnagrafica)
- `app/src/tests/companyAiContextWizard.test.jsx`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`

## Cosa NON toccare

- `qualificationAlert.service.js` / Alert UI / `DEPUTYTASK.md` (HITL #3)
- Auth / sync / JWT / migrazioni
- `computeProfileCompleteness` / ADR-018 (profilo legale ≠ contesto AI)
- Studio `studio-v1` / CTX-1 già chiuso
- Persistenza JSON strutturata / enrichment web / OAuth (outline successivo)
- `StudioSettingsPage` salvo riuso classi CSS già presenti

## DoD

- [ ] GET/PUT company include `ai_context` (`scoreCompanyContext`, company-v1)
- [ ] Badge % + livello + checklist missing su CompanyDetail → Anagrafica
- [ ] Anteprima live via mirror FE `company-v1`
- [ ] HITL: salvataggio solo su «Salva anagrafica»
- [ ] Test L1 FE + Jest controller; build FE
- [ ] Deploy VPS controller (se modificato)
- [ ] Alert #3 non toccato
