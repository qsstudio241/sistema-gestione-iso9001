# DEPUTYTASK — RBAC Fase 2 (NC, allegati, registry)

**Stato:** ✅ **TEST OK** — chiuso 31/05/2026 (deputy)  
**Branch:** `feat/rbac-phase-2-nc-attachments-registry`

## Esito

Esteso `studioScopeClause` / `documentRegistryScopeClause` da `auditListRbac.service.js` a write path audit, NC, allegati e document registry. Test L1: **22/22 verdi**. Deploy VPS 31/05/2026 — health OK, MainPID rinnovato (restart 10:42 UTC).

## Slice completate

| Slice | Esito |
|-------|--------|
| A — Audit write path | ✅ update/delete/stats/upsert/complete/approve/bulk/pending/sync |
| B — NC | ✅ delete, azioni NC, push/undo NC register + test estesi |
| C — Allegati | ✅ list/get/upload/download/delete/view/replace + 3 test Jest |
| D — Document registry | ✅ list/get/stats/update/delete/release con `documentRegistryScopeClause` |

## Checklist DoD

- [x] Slice A–C: scope studio su endpoint radice audit
- [x] Test Jest verdi (auditListRbac, nc.controller, attachment.controller)
- [x] Deploy VPS + health `GET /api/v1/health` 31/05/2026
- [x] `GUIDA_CONSOLIDATA.md` aggiornata (esperienza RBAC Fase 2)
- [x] Commit su branch feature (merge su `main` → lead committente)

## Comando deputy (archivio)

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
