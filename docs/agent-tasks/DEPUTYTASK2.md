# DEPUTYTASK2 — CTX-3: Enrichment fonti pubbliche + proposte citate (HITL)

**Stato:** APERTO  
**Aperto:** 07/09/2026 (post-merge CTX-2 #665)  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § CTX-3  
**Rischio:** Medio — API search registry additiva (sector/source_url) + UI HITL; niente auth/sync/migrazioni  
**Branch:** `cursor/ctx3-enrich-cited-proposals-8269`  
**Slot precedente:** CTX-2 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert #3 HITL APERTO — **NON toccare**

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Perché

CTX-2 guida i campi mancanti; manca l’arricchimento da fonti pubbliche con citazione URL e conferma admin. Pattern già collaudato: `CompanyRegistrySearch` (lista → scelta → form → Salva). Serve anche **no overwrite silenzioso** sui campi già compilati.

## DoD

- [ ] Candidati registro espongono `sector` (ATECO), `source`, `source_url` citabile
- [ ] Modulo puro proposte citate JSON (`buildCitedProposals` / `applySelectedProposals`) — conflict → unchecked
- [ ] UI: step review con checkbox + link URL; applica solo selezionati; Salva resta HITL
- [ ] Test L1 BE+FE + build; deploy VPS se BE
- [ ] Alert #3 / `DEPUTYTASK.md` non toccati
- [ ] PLAN § CTX-3 marcato ✅

## File previsti

- `backend/src/data/aiContextEnrichment.js` (+ test)
- `backend/src/services/openapiCompanyLookup.service.js` (+ test)
- `backend/scripts/deploy-manifest.json`
- `app/src/data/aiContextEnrichment.js` (+ test)
- `app/src/components/CompanyRegistrySearch.jsx` (+ test)
- `app/src/pages/CompanyDetailPage.jsx` (currentValues + patch selettivo)
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`

## Cosa NON toccare

- `qualificationAlert.service.js` / Alert UI / `DEPUTYTASK.md` (HITL #3)
- Auth / sync / JWT / migrazioni / OAuth email-Drive (CTX-4)
- `computeProfileCompleteness` / ADR-018 profilo legale (tab Profilo)
