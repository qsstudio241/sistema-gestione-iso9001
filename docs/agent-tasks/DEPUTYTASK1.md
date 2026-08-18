# DEPUTYTASK1 — ISO-6: ponte NC ↔ commessa (`project_id` opzionale)

**Stato:** APERTO  
**Aperto:** 18/08/2026 (Lead — altri punti 3834 dopo merge wayfinder MC ingest #462)  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio — migrazione nullable + NC; PR + gate Bugbot; Cloud **non** mergia  
**Ambiente:** migrazione **prima su TEST** (`SGQ_MIGRATION_TARGET=test`). Produzione solo su richiesta.

---

## Slice

Una NC può (non deve) essere collegata a una commessa ISO 3834. Stesso pattern del Welding Book: picker dopo l'azienda, `project_id` NULL ammesso.

### File

- `database/migrations/153_nc_project_id.sql` + `backend/scripts/run-migration-153-vps.js`
- `backend/src/controllers/nc.controller.js` (+ test)
- `app/src/utils/ncCreateHelpers.js`, `NcCreateModal.jsx`, `NcDetailPanel.jsx`, `NCPage.jsx`

### DoD

- Create/update accettano `project_id` opzionale
- 400 `PROJECT_COMPANY_MISMATCH` se la commessa non è dell'azienda NC/audit
- Lista/dettaglio espongono `project_code`
- Picker **Commessa** visibile, `disabled` senza azienda
- **Non** rendere `project_id` obbligatorio

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a)
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md` (deputy ingest in altra chat)
- Ingest MC, SAL, Materiali, ISO-4 (file Mason assente)

---

## Esito (da compilare in chiusura)

- …
