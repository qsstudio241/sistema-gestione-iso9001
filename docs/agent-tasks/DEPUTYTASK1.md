# DEPUTYTASK1 — ISO-7: ponte RDP/NDT ↔ commessa (`project_id` opzionale)

**Stato:** APERTO  
**Aperto:** 19/08/2026  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio — migrazione nullable + RDP/NDT; PR + 1 Bugbot a slice chiusa; Cloud **non** mergia

---

## Slice

Un verbale RDP o NDT può (non deve) essere collegato a una commessa ISO 3834. Stesso pattern di NC (ISO-6) e Welding Book. Il testo libero (`project_name` / `job_order`) resta.

### File

- `database/migrations/155_rdp_ndt_project_id.sql` + `backend/scripts/run-migration-155-vps.js`
- `backend/src/utils/resolveOptionalProjectId.js` (+ test) — helper condiviso
- `backend/src/controllers/rdp.controller.js` (+ test)
- `backend/src/controllers/ndtReports.controller.js` (+ test)
- `app/src/pages/RDPModule.jsx`, `app/src/pages/NdtReportsPage.jsx`
- `backend/scripts/deploy-manifest.json` (util nuova)
- `docs/agent-tasks/PLAN_3834_SLICES.md`

### Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a CHIUSO — non riaprire)
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md` (ingest in altra chat)
- `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md` (sync hub dopo merge)
- Ingest MC, Materiali, SAL, NC, ISO-4 (file Mason assente)

---

## Accettazione

- Colonne `project_id` nullable su `rdp_reports` e `ndt_reports`, FK `ON DELETE SET NULL`, indici. Niente CASCADE.
- Create/update: `project_id` opzionale; 400 `PROJECT_COMPANY_MISMATCH` se azienda diversa; 404 se commessa fuori org; omettere il campo in update non azzera.
- Lista/dettaglio: `project_code`. Picker visibile, `disabled` senza azienda.
- L1: helper + migrazione 155 + create mismatch RDP/NDT.

Dopo merge: migrazione **prima su TEST** (`SGQ_MIGRATION_TARGET=test node /tmp/run-migration-155-vps.js`). Produzione solo su richiesta.
