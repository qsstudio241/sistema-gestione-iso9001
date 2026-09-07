# DEPUTYTASK2 — SB-6: Fatti SAL nello snapshot Ambito

**Stato:** APERTO  
**Aperto:** 07/09/2026 (post-merge SB-2 #660; Alert #3 HITL senza risposte → skip Alert)  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § SB-6  
**Rischio:** Medio — BE additivo `ambitoFacts` + UI card/nav; riuso `gapAnalysis`; niente auth/sync/migrazioni  
**Branch:** `cursor/sb6-fatti-sal-8269`  
**Slot precedente:** SB-2 CHIUSO su `origin/main` (sovrascrittura consentita)

---

## Perché

Lo snapshot Ambito (SB-1/SB-4) espone NC / qualifiche / documenti. La destinazione Second Brain include anche i **gap SAL**. SB-2 chiuso (#660): Ambito header unico. Prossima slice AFK: fatti SAL senza nuovo LLM.

## Cosa fare

1. `getSalSummary(org, companyId)` in `gapAnalysis.service` — stessa matrice macro di `getGapMatrix`, **senza** `enrichRowsWithEvidence`; riusa `buildSalSummary`
2. `loadAmbitoFacts` (solo scope azienda): aggiunge `counts.salOpenGaps` (= discussed + in_progress) e `counts.salToValidate`; studio = null (SAL per-azienda)
3. `formatAmbitoFactsPromptBlock`: righe SAL se presenti
4. `AmbitoFactsBar`: card «SAL aperti» + nav «Apri SAL» → `/sal` (gated come gli altri; solo con azienda ready)
5. Test L1 BE + FE; build `app/`

## DoD

- [ ] Company Ambito: API fatti include conteggi SAL coerenti con summary gapAnalysis
- [ ] Studio Ambito: niente conteggi SAL inventati
- [ ] Prompt chat include i numeri SAL solo se ready + company
- [ ] UI: card + nav; test Vitest aggiornati
- [ ] PR Medio; Alert HITL non toccato

## File previsti

- `backend/src/services/gapAnalysis.service.js` (+ test)
- `backend/src/services/ambitoFacts.service.js` (+ test)
- `app/src/components/AmbitoFactsBar.jsx`
- `app/src/tests/AmbitoFactsBar.test.jsx`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`
- `docs/PROJECT_ROADMAP.md` § Stato

## Cosa NON toccare

- `DEPUTYTASK.md` / Alert / `qualificationAlert.service.js` (HITL aperto)
- Auth / sync / JWT / migrazioni
- MC-I4 / ING-5 / VC-5 / Compliance Map
- `getGapMatrix` comportamento API pubblico (solo riuso + helper leggero)
