# DEPUTYTASK — API complete Riesame requisiti (chiuso)

**Stato:** CHIUSO — **TEST OK** (02/06/2026)  
**Branch:** `cursor/contract-review-api-complete-5351`  
**PR:** https://github.com/qsstudio241/sistema-gestione-iso9001/pull/79 (draft)

## Esito

- Backend: workflow gate, inbox/summary, chiarimenti, documenti, allegati, analisi AI caso
- Migrazione **068** + script VPS `run-migration-068-vps.js`
- Frontend: slide UI + integrazione API in `ContractReviewPage`
- Test: Jest backend + Vitest labels

## Smoke L3 (manuale)

Menu **Riesame Requisiti** → inbox → apri caso → tab Workflow/Checklist → transizione con gate visibile se checklist incompleta.
