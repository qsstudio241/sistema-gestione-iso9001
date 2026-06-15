# DEPUTYTASK — Flusso Mason: audit 2ª parte + anagrafica fornitori

**Stato:** **CHIUSO — TEST OK** (L1 backend + frontend verdi; smoke L3 da eseguire su preview)

**Branch:** `feat/mason-audit-seconda-parte-suppliers`

---

## Esito implementazione

| Slice | Stato | Note |
|-------|--------|------|
| 1 — `GET /suppliers?company_id=` | ✅ | Filtro + 400 su id invalido; Jest 3/3 pass |
| 2 — Anagrafiche `company_id` | ✅ | Dropdown committente in SupplierForm + colonna tabella |
| 3 — Audit UI suppliers | ✅ | AuditSelector + AuditAccordionLayout usano fornitori filtrati |
| 4 — `fornitoreSupplierId` sync | ✅ | audit_extra_data + StorageContext + syncService + controller |
| 5 — Test L1 | ✅ | `suppliers.controller.test.js` + `auditDataModel.createNewAudit.test.js` |

## Test L1 eseguiti

```text
Backend:  suppliers.controller.test.js — 3 passed
Frontend: auditDataModel.createNewAudit.test.js — 5 passed
```

## Smoke L3 (da committente su preview post-merge)

Passi 1–6 in DEPUTYTASK originale — annotare esito prima del deploy VPS backend.

## Deploy post-merge

```powershell
.\backend\scripts\vps-preflight.ps1
.\backend\scripts\deploy-controllers-to-vps.ps1
curl -sk https://www.fr-busato.it:8443/api/v1/health
```

---

## Comando deputy (archivio)

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
