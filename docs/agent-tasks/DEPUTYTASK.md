# DEPUTYTASK — ING-1: Classificazione / riordino allegati batch (caso commerciale)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § ING-1  
**Rischio:** Medio — FE util + UI HITL su catalogo VC-2; riuso PATCH allegato esistente; niente migrazione; niente auth/sync breaking  
**Branch:** `cursor/ing1-batch-doc-classify-1c5d`  
**PR:** compare https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/ing1-batch-doc-classify-1c5d?expand=1  
**Dipende da:** VC-2 catalogo ruoli su `main`; PLAN ING-* (#623 allineato nel branch)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito deputy

**TEST OK** — suggerimenti ruolo batch da nome/path + pannello HITL su catalogo allegati caso.

| Voce | Dettaglio |
|------|-----------|
| Util | `suggestCommercialDocRoleFromName` + `buildBatchRoleSuggestions` in `caseDocCatalog.js` (whitelist VC-2, senza LLM) |
| UI | Bottone «Suggerisci ruoli (batch)» → checkbox/select → «Applica selezionati» (PATCH esistente) |
| Storage | Nessuno nuovo — riuso `commercial_doc_role` / `updateContractReviewAttachment` |
| Test L1 | `caseDocCatalog.test.js` 9/9 + `npm run build` OK |
| Caso golden | Generico su qualsiasi caso; HITL: indicare `case_id` di prova (tenant ERAM 1004 noto per smoke coverage, non vincolante) |

**Prossima slice:** ING-2 (matching auto → ruoli catalogo / gate Analizza) o ING-4 in parallelo su slot disgiunto.

---

## Cosa fa l'utente in UI

1. Apri Riesame requisiti → caso con allegati → slide Documenti.
2. Clicca **Suggerisci ruoli (batch)**.
3. Rivedi indizi «dal nome», correggi select, spunta/deseleziona.
4. **Applica selezionati** → catalogo aggiornato → poi Analizza documenti se pronto.
