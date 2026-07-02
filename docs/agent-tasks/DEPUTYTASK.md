# DEPUTYTASK — SAL Fase 3: integrazioni audit + NC sal_gap

> **Creato**: 02/07/2026  
> **Stato**: IN CORSO  
> **Spec**: [`docs/specs/MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 3  
> **Base**: branch `cursor/sal-fase3-integrations-3971` (include Fase 2 + merge main/Welding Book)

---

## Obiettivo

Integrare il motore SAL con audit e Piano Azioni: `conformity_hint` da ultimo audit completato, azioni NC con `source_category='sal_gap'`.

**Non toccato** (lavoro parallelo committente/VPS): Welding Book (`weldingBooks.*`, mig. 110), `ContractReviewPage`, drawing extraction.

---

## Deliverable

| Voce | Esito |
|------|-------|
| Migrazione **118** — `CK_nc_source_category` include `sal_gap` | ⏳ |
| `syncAuditConformityHints` + `POST .../gap-matrix/sync-audit-hints` | ⏳ |
| Colonna hint audit + pulsante sync in `SALModule` | ⏳ |
| Categoria NC `sal_gap` + modal azione da gap SAL | ⏳ |
| Test L1 backend + frontend | ⏳ |

**Deploy VPS** (dopo merge): mig. 118 → `deploy-controllers-to-vps` → restart backend. **Non** interferisce con mig. 110 Welding Book.

---

## Chiusura

_(TEST OK da aggiornare a fine slice)_
