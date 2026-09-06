# DEPUTYTASK2 — SB-3 fatti Ambito nel prompt + bozza SB-5 navigazione

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026  
**Chiuso:** 06/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § SB-3 + bozza SB-5  
**Rischio:** Medio — endpoint/controller additivi, UI nav senza write autonome  
**Branch:** `cursor/sb3-fatti-prompt-sb5-nav-8269`  
**Slot precedente:** LUX-B CHIUSO su `origin/main` (sovrascrittura consentita)  
**Prerequisito:** SB-1 già in `main` (`ambitoFacts.service`, GET `/ai/ambito-facts`, `AmbitoFactsBar`)

---

## Esito

**TEST OK**

- **SB-3:** `formatAmbitoFactsPromptBlock` + inject in `POST /ai/chat` via `loadAmbitoFacts` (solo se `companyId` Ambito); isolamento org+company; senza Ambito nessun blocco.
- **SB-5 bozza:** pulsanti Apri NC / Qualifiche 30gg / Scadenze 30gg in `AmbitoFactsBar`; `disabled`+`title` senza azienda; navigate con query `status`/`situazione`/`due`; deep-link lettura su NC/Qualifiche/Deadlines. **Nessuna write autonoma.**
- L1 BE: `ambitoFacts.service.test` + `aiChat.controller.test` (20) verdi
- L1 FE: `AmbitoFactsBar.test.jsx` (4) + `npm run build` OK

## Gap residui

- SB-4 (vista studio aggregata) non in questa slice
- SB-5 completo: nessun tool create/update; solo nav HITL (come richiesto)

## File toccati

- `backend/src/services/ambitoFacts.service.js` (+ test)
- `backend/src/controllers/aiChat.controller.js` (+ test)
- `app/src/components/AmbitoFactsBar.jsx` (+ test)
- `app/src/pages/AiAssistantPage.css`
- `app/src/pages/NCPage.jsx`, `QualificationsPage.jsx`, `DeadlinesPage.jsx` (solo deep-link query)
- `docs/agent-tasks/DEPUTYTASK2.md`, `PLAN_SECOND_BRAIN_SLICES.md`
