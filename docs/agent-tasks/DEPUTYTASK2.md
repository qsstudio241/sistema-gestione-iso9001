# DEPUTYTASK2 — SB-6: Fatti SAL nello snapshot Ambito

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge SB-2 #660; Alert #3 HITL senza risposte → skip Alert)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § SB-6  
**Rischio:** Medio — BE additivo `ambitoFacts` + UI card/nav; riuso `gapAnalysis`; niente auth/sync/migrazioni  
**Branch:** `cursor/sb6-fatti-sal-8269`  
**PR:** create bloccato 403 — apri compare: https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/sb6-fatti-sal-8269?expand=1  
**Slot precedente:** SB-2 CHIUSO su `origin/main` (sovrascrittura consentita)

---

## Esito

**TEST OK**

- `getSalSummary` in `gapAnalysis.service` (matrice macro senza enrich evidenze) + export `buildSalSummary`
- `loadAmbitoFacts` company: `salOpenGaps` (= discussed+in_progress), `salToValidate`; studio = null
- Prompt chat: righe SAL se presenti; studio dichiara non aggregato
- UI: card «SAL aperti» + nav «Apri SAL» → `/sal` (solo azienda ready)
- L1 BE: ambitoFacts + gapAnalysis (31) · FE: AmbitoFactsBar (6) + SB-2 (3) · `npm run build` OK
- Alert HITL non toccato (`DEPUTYTASK.md` resta APERTO)

## File toccati

- `backend/src/services/gapAnalysis.service.js` (+ test)
- `backend/src/services/ambitoFacts.service.js` (+ test)
- `app/src/components/AmbitoFactsBar.jsx`
- `app/src/tests/AmbitoFactsBar.test.jsx`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`
- `docs/PROJECT_ROADMAP.md`

## Cosa NON toccato

- `qualificationAlert.service.js` / Alert UI (HITL)
- Auth / sync / JWT / migrazioni
- MC-I4 / ING-5 / Compliance Map
- Comportamento API `getGapMatrix` (refactor interno condiviso `loadSalMacroRows`)
