# DEPUTYTASK — ING-3: Segnale evadibilità da docs organizzati

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § ING-3  
**Rischio:** Medio — util FE + UI su Riesame requisiti; riuso report capacità VC-1 + catalogo ING-2 + checklist; niente migrazione; niente auth/sync  
**Branch:** `cursor/ing3-evadibilita-signal-1c5d`  
**PR:** compare https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/ing3-evadibilita-signal-1c5d?expand=1  
**Dipende da:** ING-2 (#626) + VC-1 + ING-4 (#625) su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito deputy

**TEST OK** — segnale sintetico `evadibile` | `gap` | `need_input` da catalogo + report VC-1 + checklist; pannello Workflow; non ING-5.

| Voce | Dettaglio |
|------|-----------|
| Util / API sottile | `deriveOrderEvadibilitySignal` in `orderEvadibilitySignal.js` (riusa `getCatalogAnalyzeGate` + `summary.status`) |
| UI | Pannello «Evadibilità ordine» sopra Report studio (stessi `.cr-studio-status*`) |
| Storage | Nessuno nuovo |
| Test L1 | `orderEvadibilitySignal.test.js` 13/13 + `npm run build` OK |
| Ops | mig 162 già su VPS; deploy BE #625 (routes template) eseguito in sessione |

**Prossima slice:** ING-5 solo con wayfinder (non monolite); oppure ponte gap→checklist (priorità #3 piano).

---

## Cosa fa l'utente in UI

1. Riesame requisiti → caso con allegati catalogati.
2. Slide **Workflow**: vede il pannello **Evadibilità ordine** (verde / rosso / ambra).
3. Reasons elencano catalogo, report capacità e checklist senza inventare norme.
