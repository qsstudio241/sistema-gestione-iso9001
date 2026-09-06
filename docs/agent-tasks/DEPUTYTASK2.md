# DEPUTYTASK2 — SB-4: aggregati «Tutto lo studio»

**Stato:** CHIUSO — TEST OK  
**Aperto:** 06/09/2026  
**Chiuso:** 06/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § SB-4  
**Rischio:** Medio — service/controller additivi, UI Assistente; niente auth/sync/migrazioni  
**Branch:** `cursor/sb4-studio-aggregates-8269`  
**PR:** draft (vedi compare / ManagePullRequest)  
**Slot precedente:** SB-3 + SB-5 bozza CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** agent Compliance Map §8.2 — GUIDA/roadmap **non** aggiornati in questa PR (bozza sotto).

---

## Esito

**TEST OK**

- `loadAmbitoFacts(null)` → `scope: 'studio'`: totali NC/qualifiche/docs + `topCompanies` (urgenza), filtro `organization_id` + `auditor_org_id`
- `formatAmbitoFactsPromptBlock` studio: blocco FATTI STUDIO (solo aggregati/ranking)
- `POST /ai/chat` senza Ambito: inject aggregati; `searchKnowledge(..., studioSafeOverview: true)` → `company_id IS NULL` (no mescolanza testi clienti)
- `AmbitoFactsBar`: card non vuota su «Tutto lo studio»; ranking; nav deep-link liste filtrate studio-safe
- L1 BE: `ambitoFacts.service.test` + `aiChat.controller.test` (21) verdi
- L1 FE: `AmbitoFactsBar.test.jsx` (5) + `npm run build` OK

## File toccati

- `backend/src/services/ambitoFacts.service.js` (+ test)
- `backend/src/controllers/aiChat.controller.js` (+ test)
- `backend/src/services/knowledgeIndexer.service.js`
- `app/src/components/AmbitoFactsBar.jsx` (+ test)
- `app/src/pages/AiAssistantPage.css`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`

## Cosa NON toccato

- Compliance Map / wiki / GUIDA / roadmap
- Auth / sync
- Dashboard 3834 / Home
- Write autonome NC

## Bozza hub (dopo merge — parallelo Compliance Map)

**Roadmap § Stato:** Second Brain SB-4 ✅; prossima SB-2 o SB-6. Priorità #10 aggiornare a SB-2/SB-6.  
**GUIDA:** nessuna lezione nuova (L1 verde; RAG studio-safe già documentabile in una riga se serve).
