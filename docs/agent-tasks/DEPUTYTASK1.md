# DEPUTYTASK1 — ISO-6: ponte NC ↔ commessa (`project_id` opzionale)

**Stato:** CHIUSO  
**Aperto:** 18/08/2026  
**Chiuso:** 18/08/2026  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**PR:** [#465](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/465)  
**Rischio:** Medio — migrazione nullable + NC; PR + gate Bugbot; Cloud **non** mergia

---

## Slice

Una NC può (non deve) essere collegata a una commessa ISO 3834. Stesso pattern del Welding Book.

### File

- `database/migrations/153_nc_project_id.sql` + `backend/scripts/run-migration-153-vps.js`
- `backend/src/controllers/nc.controller.js` (+ test)
- `app/src/utils/ncCreateHelpers.js`, `NcCreateModal.jsx`, `NcDetailPanel.jsx`, `NCPage.jsx`

### Cosa NON è stato toccato

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a resta APERTO)
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md` (deputy ingest in altra chat)
- Ingest MC, SAL, Materiali, ISO-4 (file Mason assente)

---

## Esito

- Colonna `project_id` nullable, FK `ON DELETE SET NULL`, indice. Niente CASCADE.
- Create/update: `project_id` opzionale; 400 `PROJECT_COMPANY_MISMATCH` se azienda diversa; 404 se commessa fuori org.
- Lista/dettaglio: `project_code`. Griglia NC: colonna Commessa.
- Picker visibile, `disabled` senza azienda.
- L1: backend 26/26; frontend 31/31 (ncCreate, modal, detail).

Dopo merge: migrazione **prima su TEST** (`SGQ_MIGRATION_TARGET=test node /tmp/run-migration-153-vps.js`). Produzione solo su richiesta.

Prossima 3834: **ISO-7** (RDP/NDT ↔ commessa) oppure **ISO-4** se arriva il file Mason.
