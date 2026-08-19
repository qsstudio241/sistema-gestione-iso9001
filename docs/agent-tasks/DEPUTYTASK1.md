# DEPUTYTASK1 — ISO-7: ponte RDP/NDT ↔ commessa (`project_id` opzionale)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 19/08/2026  
**Chiuso:** 19/08/2026  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**PR:** [#474](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/474)  
**Rischio:** Medio — migrazione nullable + RDP/NDT; PR + 1 Bugbot a slice chiusa; Cloud **non** mergia

---

## Slice

Un verbale RDP o NDT può (non deve) essere collegato a una commessa ISO 3834. Stesso pattern di NC (ISO-6) e Welding Book. Il testo libero (`project_name` / `job_order`) resta.

### File

- `database/migrations/155_rdp_ndt_project_id.sql` + `backend/scripts/run-migration-155-vps.js`
- `backend/src/utils/resolveOptionalProjectId.js` (+ test)
- `backend/src/controllers/rdp.controller.js` (+ test)
- `backend/src/controllers/ndtReports.controller.js` (+ test)
- `app/src/pages/RDPModule.jsx`, `app/src/pages/NdtReportsPage.jsx`
- `backend/scripts/deploy-manifest.json`
- `docs/agent-tasks/PLAN_3834_SLICES.md`

### Cosa NON è stato toccato

- `docs/agent-tasks/DEPUTYTASK.md` (SAL S1a resta CHIUSO)
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md`
- `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md` (sync hub dopo merge)
- Ingest MC, Materiali, SAL, NC, ISO-4 (file Mason assente)

---

## Esito

- Colonne `project_id` nullable, FK `ON DELETE SET NULL`, indici. Niente CASCADE.
- Create/update: `project_id` opzionale; 400 `PROJECT_COMPANY_MISMATCH` se azienda diversa; 404 se commessa fuori org; omettere il campo in update non azzera.
- Lista/dettaglio: `project_code`. Picker visibile, `disabled` senza azienda.
- L1 backend: **36/36** (helper, migrazione 155, RDP, NDT).
- Bugbot (1 run, slice chiusa): rilievo su `project_id` stale se cambia azienda senza mandare il campo — **corretto** in update RDP/NDT (400 `PROJECT_COMPANY_MISMATCH`). Nessun secondo Bugbot.

Dopo merge: migrazione **155 applicata su TEST** (6/6). Backend TEST PID `981527`, health 200. Produzione solo su richiesta.

Prossima 3834: **ISO-5** Word Welding Book, oppure **ISO-4** se arriva il file Mason.
