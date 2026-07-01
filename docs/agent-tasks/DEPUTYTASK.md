# DEPUTYTASK — SAL Fase 0: motore dati gap analysis operativa

> **Creato**: 01/07/2026  
> **Stato**: COMPLETATO — TEST OK  
> **Spec**: [`docs/specs/MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §D, §H Fase 0  
> **Base**: `main`

---

## Obiettivo

Implementare il **motore dati** SAL (Stato Avanzamento Lavori): tabelle persistite clausola-per-clausola, API CRUD scope-aware, seed da `norm_requirements`, test L1 backend.

**Non toccato** (branch parallelo committente): `ContractReviewPage`, `contractReview.*`, `commercial_cases*`, drawing extraction.

---

## Deliverable

| Voce | Esito |
|------|-------|
| Migration **117** `requirement_implementation_status` + `requirement_implementation_history` | ✅ applicata su produzione |
| `gapAnalysis.service.js` — `getGapMatrix`, `listStatuses`, `upsertStatus`, `seedForCompany` | ✅ |
| `gapAnalysis.controller.js` + `gapAnalysis.routes.js` (licenza `sal`) | ✅ |
| Test Jest `gapAnalysis.service.test.js` (10 test) | ✅ PASS |
| Deploy VPS controller | ✅ health OK |
| UI `/sal`, export Word, feed Riesame | ⏭️ Fasi 1–4 (fuori scope) |

---

## API (licenza `sal`)

| Metodo | Path | Descrizione |
|--------|------|-------------|
| GET | `/api/v1/companies/:companyId/gap-matrix?standardCode=&dateFrom=` | Matrice clausole N.N + stato |
| GET | `/api/v1/companies/:companyId/gap-statuses?standardCode=` | Solo righe seedate |
| PUT | `/api/v1/companies/:companyId/gap-statuses/:normRequirementId` | Upsert stato + storico |
| POST | `/api/v1/companies/:companyId/gap-matrix/seed` | Seed idempotente `{ standardCodes?: [] }` |

Stati ammessi: `discussed`, `in_progress`, `to_validate`, `completed`, `na`.

**Distinto** da `GET /api/v1/gap-analysis` (euristica documenti, licenza `ai_norms`).

---

## Script migrazione

```powershell
node backend/scripts/run-migration-117-local.js production
# VPS (se necessario):
.\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-117-vps.js
```

---

## Chiusura

TEST OK — Fase 0 backend completata. Prossimo step: **Fase 1 UI griglia `/sal`**.
