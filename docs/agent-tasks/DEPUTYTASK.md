# DEPUTYTASK — VC-3: Pipeline catalogo → analisi → refresh report (un click studio)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 01/09/2026  
**Chiuso:** 01/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § VC-3  
**Rischio:** Medio — BE additivo (hook refresh dopo analyze / conferma requisiti) + FE reload report; niente migrazione; niente auth/sync breaking  
**Branch:** `cursor/vc3-catalog-analyze-refresh-1c5d`  
**PR:** draft non creabile da Cloud Agent (`gh` GraphQL Resource not accessible) — compare: https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/vc3-catalog-analyze-refresh-1c5d?expand=1  
**Push:** branch remoto aggiornato (`origin/cursor/vc3-catalog-analyze-refresh-1c5d`)  
**Dipende da:** VC-1 (#619) + VC-2 (#620)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito deputy

**TEST OK** — dopo analisi allegato (done) o HITL conferma/modifica/rifiuto requisiti, refresh best-effort dello snapshot report studio (VC-1).

| Voce | Dettaglio |
|------|-----------|
| Helper | `maybeRefreshCapabilityGapReport` — skip `no_company` / `not_found`, non lancia |
| Hook analyze | `caseDocumentAnalysis` al completamento pipeline → refresh + `report_refresh` sul job |
| Hook HITL | `reviewRequirement` su confirmed/edited/rejected → refresh |
| UI | `StudioReportPanel` `reloadKey` dopo polling `done` / conferma requisiti |
| Test L1 | BE: gap report + analysis + drawingExtraction (32); FE: `npm run build` OK |
| Migrazione | nessuna |

**Prossima slice:** VC-4 (export report studio).

---

## Perché (prodotto)

Dopo catalogazione (VC-2) e report persistito (VC-1), lo studio chiude il percorso **catalogo → Analizza documenti → snapshot report aggiornato** senza un secondo click obbligatorio su «Genera report».

## Obiettivo

Orchestrazione sottile: riuso `regenerateAndPersistCapabilityGapReport` in best-effort dopo analisi / conferma requisiti.

## DoD

1. Helper BE `maybeRefreshCapabilityGapReport` ✅
2. Hook analyze + reviewRequirement ✅
3. FE reload Report studio ✅
4. Test L1 + build ✅
5. Nessuna migrazione / VC-4+ / auth-sync ✅

## File previsti (toccati)

- `backend/src/services/caseCapabilityGapReport.service.js` (+ test)
- `backend/src/services/caseDocumentAnalysis.service.js` (+ test)
- `backend/src/controllers/drawingExtraction.controller.js` (+ test)
- `app/src/pages/ContractReviewPage.jsx`
- `docs/agent-tasks/DEPUTYTASK.md` / `PLAN_VALUTAZIONE_COMMESSE_SLICES.md`

## Cosa NON toccare

- VC-4+, auth/JWT, sync, migrazioni, SAL, Import Jobs engine
