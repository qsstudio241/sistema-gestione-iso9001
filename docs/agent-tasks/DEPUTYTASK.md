# DEPUTYTASK — Import cartella: piano ancorato alla company del picker

**Stato:** APERTO  
**Aperto:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Rischio:** Medio — solo FE; gate azienda e tetto 80 invariati; Cloud **non** mergia.  
**Branch:** `cursor/import-plan-company-d492`  
**Origine:** Bugbot HIGH post-merge PR #517 (`Folder plan wrong company_id`)

---

## Perché

Il piano di carico resta in memoria se l’utente cambia job nella lista. `handleConfirmFolderPlan` leggeva `company_id` da `detail.job` al click: i lotti nuovi potevano finire sotto un’altra azienda.

## File previsti

- `app/src/pages/ImportJobsPage.jsx`
- `app/src/tests/importJobsPage.folderPlan.test.jsx`
- `docs/agent-tasks/DEPUTYTASK.md`

## Cosa NON toccare

GUIDA, roadmap, `PROJECT_CONTEXT.md`, backend, tetto 80, `reuseId`, IA-5b, contractReview, MC, SAL.

## Slice

1. Catturare `company_id` in `handleFolderPicked` (quando si costruisce il piano).
2. `handleConfirmFolderPlan` usa **quella** company + `isClientCompanyId`. Se manca: errore, nessun upload.
3. Reset del piano al cambio `selectedId` (niente piano orfano). Non resettare durante l’upload lotti (il confirm aggiorna `selectedId`).
4. Ogni lotto resta `createImportJob` con title + hint + company catturata.

## Esito atteso

Piano costruito sul job A (company X) → utente seleziona job B (company Y) → il piano sparisce e non si carica su Y. Confirm sul piano originale usa sempre X.
