# DEPUTYTASK — SAL Fase 1: UI griglia MVP `/sal`

> **Creato**: 01/07/2026  
> **Stato**: COMPLETATO — TEST OK  
> **Spec**: [`docs/specs/MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 1  
> **Base**: `main`

---

## Obiettivo

Sostituire `ModuleLocked` con pagina SAL operativa: griglia requisiti × stati, ambito azienda, API gap-matrix, test L1 frontend.

**Non toccato** (branch parallelo committente): `ContractReviewPage`, `contractReview.*`, `commercial_cases*`, drawing extraction.

---

## Deliverable

| Voce | Esito |
|------|-------|
| `SALModule.jsx` + `SALModule.css` — griglia `SgqDataGrid`, tab standard, seed, modal dettagli | ✅ |
| `salCompanyScope.js` — persistenza localStorage + auto-select singola azienda | ✅ |
| `salConstants.js` — stati/label/badge standard | ✅ |
| `apiService` — `getGapMatrix`, `updateGapStatus`, `seedGapMatrix` | ✅ |
| Route `/sal` → `SALModule`; menu sidebar senza lucchetto | ✅ |
| Test Vitest `salModule.test.jsx` + `salCompanyScope.test.js` (6 test) | ✅ PASS |
| Build Vite | ✅ OK |

**Fuori scope (Fasi 2+)**: export Word SAL, storico revisioni UI, integrazioni audit/NC, feed Riesame.

---

## Chiusura

TEST OK — Fase 1 UI completata. Prossimo step: **Fase 2 export Word + storico**.
