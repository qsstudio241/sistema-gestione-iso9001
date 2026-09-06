# DEPUTYTASK2 — SB-4: aggregati «Tutto lo studio»

**Stato:** APERTO  
**Aperto:** 06/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § SB-4  
**Rischio:** Medio — service/controller additivi, UI Assistente; niente auth/sync/migrazioni  
**Branch:** `cursor/sb4-studio-aggregates-8269`  
**Slot precedente:** SB-3 + SB-5 bozza CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** agent Compliance Map §8.2 — **non toccare** GUIDA / roadmap / Compliance Map / wiki. Bozza hub in questo brief.

> **Allineamento Git (autonomo)**: `git fetch origin main` + merge su feature branch prima di ogni push. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Perché

Con Ambito = «Tutto lo studio» (`companyId` null) la card fatti era vuota (`seleziona_azienda`). SB-4 chiude il percorso studio con **solo aggregati sicuri** (totali + top aziende per urgenza), senza mescolare testi/documenti di clienti diversi.

## File previsti

- `backend/src/services/ambitoFacts.service.js` (+ test)
- `backend/src/controllers/aiChat.controller.js` (+ test inject studio)
- `backend/src/services/knowledgeIndexer.service.js` (filtro studio-safe RAG se companyId null)
- `app/src/components/AmbitoFactsBar.jsx` (+ test)
- `app/src/pages/AiAssistantPage.css` (solo se serve ranking minimo)
- `docs/agent-tasks/DEPUTYTASK2.md` (questo brief)
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md` (checkbox SB-4 a chiusura)

## Cosa NON toccare

- Compliance Map / nuove tabelle wiki / `PLAN_COMPLIANCE_MAP*`
- Auth / sync / JWT
- Dashboard 3834 / Home (SB-4 solo card Assistente)
- `docs/GUIDA_CONSOLIDATA.md` / `docs/PROJECT_ROADMAP.md` (parallelo Compliance Map — bozza sotto)
- Write autonome NC

## DoD

1. Ambito studio → card NON vuota: totali NC / qualifiche 30gg / documenti 30gg
2. Ranking top aziende (nome + conteggi urgenza)
3. Prompt chat: blocco aggregati studio; **vietato** mescolare chunk client di aziende diverse
4. Nav HITL: gated o deep-link liste filtrate studio-safe; nessuna write NC
5. Multi-tenant: sempre `organization_id` (+ `auditor_org_id` se presente)
6. L1 BE + FE mirati; build FE

## Bozza hub (dopo merge — parallelo Compliance Map)

**Roadmap § Stato:** Second Brain SB-4 ✅; prossima SB-2/SB-6 o CTX. Priorità #10 aggiornare.  
**GUIDA:** nessuna lezione nuova se L1 verde senza sorprese encoding/deploy.

## Esito

_(da compilare a chiusura)_
