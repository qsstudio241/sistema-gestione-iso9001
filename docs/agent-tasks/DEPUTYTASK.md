# DEPUTYTASK — Fix scadenzario equipRows (ReferenceError)

> **Creato**: 04/07/2026  
> **Chiuso**: 04/07/2026  
> **Stato**: CHIUSO — TEST OK  
> **PR**: [#179](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/179) mergiata su `main`  
> **Deploy VPS**: `deadlines.controller.js` copiato + restart `sgq-backend` (04/07/2026)  
> **Smoke**: `GET /deadline-items` → HTTP 200 (org test admin)

---

## Obiettivo

Correggere errore `Cannot access 'equipRows' before initialization` sulla pagina `/deadlines`.

## Esito

- Fix ordine dichiarazione `equipRows` / `equipRowsPrio` in `deadlines.controller.js`
- Merge su `main`, deploy backend VPS, health OK
- Documentazione aggiornata in `GUIDA_CONSOLIDATA.md`

## Prompt per lanciare il deputy

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
