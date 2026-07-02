# DEPUTYTASK — SAL Fase 3: integrazioni audit + NC sal_gap

> **Creato**: 02/07/2026  
> **Stato**: COMPLETATO — TEST OK  
> **Spec**: [`docs/specs/MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 3  
> **Branch**: `cursor/sal-fase3-integrations-3971` (include Fase 2 + merge main/Welding Book)

---

## Obiettivo

Integrare SAL con audit e Piano Azioni senza toccare Welding Book (ADR-016, mig. 110 sul VPS).

---

## Deliverable

| Voce | Esito |
|------|-------|
| Migrazione **118** — `sal_gap` in `CK_nc_source_category` | ✅ |
| `syncAuditConformityHints` + API `POST .../sync-audit-hints` | ✅ |
| Colonna hint audit + pulsante sync in SAL | ✅ |
| NC `sal_gap` + modal azione da gap | ✅ |
| Test L1 backend (16) + frontend (6) | ✅ PASS |

---

## Deploy VPS (ordine consigliato)

1. Mig. **110** Welding Book (se non già fatta sul tuo VPS)
2. Mig. **117** SAL Fase 0 (se non già fatta)
3. Mig. **118** SAL Fase 3:
   ```powershell
   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-118-vps.js
   ```
4. `deploy-controllers-to-vps.ps1` + restart `sgq-backend`

---

## Chiusura

TEST OK — Fase 3 completata. Prossimo: **Fase 4** feed Riesame §9.3.
