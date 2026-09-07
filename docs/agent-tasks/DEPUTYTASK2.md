# DEPUTYTASK2 — CTX-3: Enrichment fonti pubbliche + proposte citate (HITL)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 07/09/2026 (post-merge CTX-2 #665)  
**Chiuso:** 07/09/2026  
**Piano:** [`PLAN_SECOND_BRAIN_SLICES.md`](PLAN_SECOND_BRAIN_SLICES.md) § CTX-3  
**Rischio:** Medio — API search registry additiva (sector/source_url) + UI HITL; niente auth/sync/migrazioni  
**Branch:** `cursor/ctx3-enrich-cited-proposals-8269`  
**Compare:** https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/ctx3-enrich-cited-proposals-8269?expand=1  
**Slot precedente:** CTX-2 CHIUSO su `origin/main` (sovrascrittura consentita)  
**Parallelo:** `DEPUTYTASK.md` Alert #3 HITL APERTO — **NON toccato**

---

## Esito

**TEST OK**

- Candidati OpenAPI: `sector` (ATECO), `source`, `source_url` citabile (Registro Imprese)
- `aiContextEnrichment`: `buildCitedProposals` / `applySelectedProposals` — conflict → defaultSelected false
- UI `CompanyRegistrySearch`: step review + checkbox + link URL; applica solo selezionati; Salva resta HITL
- L1: Jest enrichment+openapi (18) + Vitest enrichment+registry+regressione (15) + build FE OK
- Deploy VPS OK (PID 139295→153430, health 200); smoke modulo enrichment su VPS
- Alert #3 non toccato
- PR create 403 → compare URL sopra

## File toccati

- `backend/src/data/aiContextEnrichment.js` (+ test)
- `backend/src/services/openapiCompanyLookup.service.js` (+ test)
- `backend/scripts/deploy-manifest.json`
- `app/src/data/aiContextEnrichment.js` (+ test)
- `app/src/components/CompanyRegistrySearch.jsx` (+ test)
- `app/src/pages/CompanyDetailPage.jsx`
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK2.md`

## Cosa NON toccato

- `qualificationAlert.service.js` / Alert UI / `DEPUTYTASK.md` (HITL #3)
- Auth / sync / JWT / migrazioni / OAuth (CTX-4)
- `computeProfileCompleteness` / tab Profilo ADR-018

## Bozza hub (parallelo HITL — sync dopo merge)

Roadmap § Stato attuale: priorità #1 → CTX-3 ✅ / next CTX-4 HITL; sessione «CTX-3 enrich citato HITL».  
GUIDA: lezione breve — proposte da registro = checkbox per conflitti, mai overwrite silenzioso.
