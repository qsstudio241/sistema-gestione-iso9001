# DEPUTYTASK — Albero documentale per-azienda (org QS 1002)

**Stato:** IN CORSO — implementazione + migrazione VPS  
**Obiettivo:** un albero per ogni azienda cliente; isolamento documenti con Ambito = azienda.

## Piano operativo

| # | Azione | Stato |
|---|--------|-------|
| A | Filtro API albero stretto `company_id` | ✅ codice |
| B | Script migrazione org 1002 | ✅ script in repo |
| C | Test Jest `documentTreeCompanyScope` | ✅ 4/4 |
| D | Migrazione VPS `DRY_RUN` → apply | ⏳ |
| E | Deploy `documentTree.controller.js` + restart | ⏳ |
| F | Smoke: Ambito SAVECO/RIVIAL → 15 radici, no duplicati | ⏳ |

## Comando deputy (smoke post-deploy)

```
Verifica Registro documenti → Albero con Ambito SAVECO e RIVIAL: 15 cartelle radice, nessun duplicato.
Chiudi con TEST OK o FIX NON APPLICABILI.
```
