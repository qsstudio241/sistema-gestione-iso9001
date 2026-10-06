# DEPUTYTASK_INGEST_FE — Busy P0 + progresso per file su Import PDF

**Stato:** APERTO  
**Aperto:** 06/10/2026  
**Chiuso:**  
**Rischio:** Medio — solo FE additivo; nessun BE/API/migrazione; Cloud **non** mergia  
**Stream:** `DEPUTYTASK_INGEST_FE.md` (FE ingest ImportJobsPage). **Non** riusare `DEPUTYTASK_MC_INGEST.md`.  
**Branch:** `cursor/ingest-fe-busy-progress-c105`  
**PR:**  
**Dopo:** COV-1…COV-5 CHIUSE (`main` `1bcee5e7`, #710 mergiata)

---

## Obiettivo (una slice)

Su `ImportJobsPage` (GESTIONE → Impostazioni → Import PDF, `/settings/import-jobs`):

1. **Stato P0 busy** — appena parte ingestione/elaborazione/upload, segnale UI immediato e job non modificabile (edit/azioni conflittuali disabilitate mentre `busy`).
2. **Progresso per singolo file** — durante import/upload/elaborazione, lista file-by-file (fatto / in corso / in attesa), non solo un contatore globale.

## Scope

- Riuso di `busy` + `folderUpload` già in pagina. Nessun secondo motore di stato.
- Ambito = tenant (`organization_id`); **non** toccare selettori Ambito.
- Demoable: upload/elaborazione multi-file.

## File previsti

- `docs/agent-tasks/DEPUTYTASK_INGEST_FE.md`
- `app/src/pages/ImportJobsPage.jsx`
- `app/src/pages/ImportJobsPage.css`
- `app/src/utils/importFolderPlan.js`
- `app/src/tests/importFolderPlan.test.js`
- `app/src/tests/importJobsPage.busyProgress.test.jsx`

## Cosa NON toccare

- Backend, API, migrazioni, auth/JWT/sync, selettore Ambito
- `DEPUTYTASK.md` / altri stream epic
- Governance (`.cursor/rules/**`)
- GUIDA / roadmap (hub dopo merge se serve)

## Done when

- UI: banner busy immediato + lista progresso per file
- Test FE verdi + `npm run build` (app) OK
- PR **draft** (non undraft, non `bugbot run`, non merge)
- Brief CHIUSO / TEST OK
