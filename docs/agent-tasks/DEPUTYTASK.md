# DEPUTYTASK — ING-2: Matching docs → ruoli catalogo / gate Analizza

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § ING-2  
**Rischio:** Medio — FE util + UI su catalogo VC-2/ING-1; riuso PATCH allegato; niente migrazione; niente auth/sync  
**Branch:** `cursor/ing2-catalog-role-matching-1c5d`  
**PR:** compare https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/ing2-catalog-role-matching-1c5d?expand=1  
**Dipende da:** ING-1 su `main` (#624)  
**Parallelo:** ING-4 PR #625 ancora OPEN — **mig 162 dopo merge #625** (non applicata in questa slice)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito deputy

**TEST OK** — matching confidence (nome/cartella/MIME) + gate Analizza con CTA batch; non duplica ING-1; file disgiunti da ING-4.

| Voce | Dettaglio |
|------|-----------|
| Util | `suggestCommercialDocRole` (confidence high/medium), `applyBatchSelectionMode`, `getCatalogAnalyzeGate` in `caseDocCatalog.js` |
| UI | Indizi inline su da-catalogare; toolbar Seleziona indizi forti / tutte le proposte; soft-warn Analizza + CTA |
| Storage | Nessuno nuovo — riuso `commercial_doc_role` |
| Test L1 | `caseDocCatalog.test.js` 15/15 + `npm run build` OK |
| Nota ops | **mig 162 dopo merge #625** (PR ING-4 ancora aperta al momento della chiusura) |

**Prossima slice:** ING-3 (gap evadibilità) o ING-4 se #625 non ancora mergiata.

---

## Cosa fa l'utente in UI

1. Riesame requisiti → caso con allegati → Documenti.
2. Nei «Da catalogare» vede indizi (forte/debole) inline.
3. **Suggerisci ruoli (batch)** → indizi forti già spuntati; può selezionare tutte le proposte.
4. **Applica selezionati** → catalogo aggiornato.
5. **Analizza**: se bloccato con indizi → CTA batch; se pronto ma restano da catalogare → soft-warn «Completa catalogo».
