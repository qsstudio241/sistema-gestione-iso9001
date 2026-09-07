# DEPUTYTASK2 — SB-2: Ambito header = unico input Assistente

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CM-5 #659 + deploy VPS)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § SB-2  
**Rischio:** Medio — solo FE Assistente; niente auth/sync/migrazioni  
**Branch:** `cursor/sb2-ambito-header-unico-8269`  
**Slot precedente:** SB-4 CHIUSO su `origin/main` (sovrascrittura consentita)

---

## Esito

**TEST OK**

- `AiAssistantPage` usa `useCompanyScope` per `companyId` / nome (niente stato locale azienda)
- Chip Ambito = mirror read-only (`ai-context-chip--readonly`); title punta al selettore header
- `aiChat` / figure / WPS ricevono lo stesso `companyId` dello scope (null = studio)
- Cambio Ambito header → separatore `Contesto: …`
- L1: `AiAssistantSb2Scope.test.jsx` (3) + `AmbitoFactsBar` (5) + `npm run build` OK

## File toccati

- `app/src/pages/AiAssistantPage.jsx`
- `app/src/pages/AiAssistantPage.css`
- `app/src/tests/AiAssistantSb2Scope.test.jsx`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`
- `docs/PROJECT_ROADMAP.md`
- `docs/agent-tasks/DEPUTYTASK.md` (Alert #3 HITL brief APERTO, file disgiunti)

## Cosa NON toccato

- Auth / sync / JWT
- `qualificationAlert.service.js` (codice Alert bloccato da HITL)
- Compliance Map / MC / ING-5
- Backend

## Contesto post CM-5

- Deploy VPS OK · smoke login/nc/qualifiche OK · epic CM CHIUSA
