# DEPUTYTASK — VC-4: Export report studio (Word)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § VC-4  
**Rischio:** Medio — FE export Word da snapshot persistito + UI download; riuso pattern SAL/NC; niente migrazione; niente auth/sync breaking  
**Branch:** `cursor/vc4-export-report-studio-1c5d`  
**PR:** draft non creabile da Cloud Agent (`gh` GraphQL Resource not accessible) — compare: https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/vc4-export-report-studio-1c5d?expand=1  
**Push:** branch remoto aggiornato (`origin/cursor/vc4-export-report-studio-1c5d`)  
**Dipende da:** VC-1 (#619) + VC-3 (#621) mergiate; deploy VPS VC-3 OK (PID 1647143→1698905, health 200)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito deputy

**TEST OK** — export Word (.docx) dallo snapshot `capability_gap_report` + bottone «Scarica Word» in Report studio.

| Voce | Dettaglio |
|------|-----------|
| Formato | **Word** programmatico (`docx` FE) — pattern SAL/NC; nessun PDF consolidato più semplice; backend senza `docx` |
| Dati | Snapshot già caricato via `GET .../capability-gap-report` (VC-1); niente ricalcolo |
| Helper | `wordExportCapabilityGapReport.js` — blob + download + `exportCapabilityGapReportFromApi` |
| UI | `StudioReportPanel` — bottone secondario; disabled senza snapshot |
| Test L1 | Vitest 5/5 + `npm run build` OK |
| Migrazione | nessuna |

**Prossima slice:** VC-5 (chiarimenti da gap → workflow CLARIFICATION).

---

## Perché (prodotto)

Lo studio scarica lo snapshot gap capacità (VC-1) come documento Word leggibile, senza ricalcolare né inventare un motore export nuovo.

## Obiettivo

1. Export **Word** (.docx) programmatico da `capability_gap_report` persistito (pattern `wordExportSal` / NC).
2. Download dal pannello **Report studio** in `ContractReviewPage` (DNA `.cr-*` esistente).
3. Dati da endpoint GET snapshot già esistente (`getCapabilityGapReport`).
4. Test L1 FE sul builder blob OOXML.

## File toccati

| Layer | Path |
|-------|------|
| FE export | `app/src/utils/wordExportCapabilityGapReport.js` |
| FE test | `app/src/tests/wordExportCapabilityGapReport.test.js` |
| UI | `app/src/pages/ContractReviewPage.jsx` |
| Docs | questo brief + PLAN § VC-4 |

## Cosa NON toccato

VC-5+ · auth/JWT/sync · migrazioni · algoritmi coverage · CoveragePanel live · nuove dipendenze npm
