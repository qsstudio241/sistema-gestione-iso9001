# DEPUTYTASK — Import: sempre un'azienda (niente Tutto lo studio)

**Stato:** CHIUSO — TEST OK L1 (21/08/2026)  
**Aperto:** 21/08/2026  
**Chiuso:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Rischio:** Medio — FE + BE additivo (`COMPANY_REQUIRED_FOR_UPLOAD`); Cloud **non** mergia.  
**PR:** [#514](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/514) mergiata 21/08/2026 · deploy PROD PID `1134642`→`1149359`, health 200

---

## Perché

Il committente ha annullato un popup da 1473 file, messo Ambito **«Tutto lo studio»**, poi «Carica cartella». Non deve essere consentito: serve sempre un'azienda cliente sul job. Condiviso.

## File previsti

- `app/src/utils/importFolderUpload.js`
- `app/src/tests/importFolderUpload.test.js`
- `app/src/pages/ImportJobsPage.jsx`
- `app/src/pages/ImportJobsPage.css`
- `app/src/tests/importJobsPage.companyGate.test.jsx`
- `backend/src/controllers/importJobs.controller.js`
- `backend/src/controllers/importJobs.controller.test.js`

## Cosa NON toccare

contractReview, ingest staging, MC, SAL, OCR, `PROJECT_CONTEXT.md`, tetto 80, mappe folder, GUIDA/roadmap (bozza sotto: altri agent IDLE sullo stesso repo).

## Slice

1. FE: Carica PDF / cartella / Estrai / Screening **visibili**, `disabled` + `title` se manca `company_id` sul job. Title: «Scegli un'azienda sul job (non Tutto lo studio)».
2. Create-job: prefill da CompanyScope **solo** se è un'azienda cliente (non `""` / `studio` / patrimonio omonimo, lezione PR #428). Pulsante + Nuovo job stesso gate.
3. BE: `createJob` / `uploadFiles` / `screenAndPlace` → 400 `COMPANY_REQUIRED_FOR_UPLOAD` se manca azienda (qualifiche: codice già esistente).
4. Annulla carico: pulsante visibile «Annulla caricamento» = elimina job + file, con conferma. Nessun purge prod. Nessuna schermata nuova.
5. Anti-errore basso rischio: avviso tetto 80 (già c'è); conferma «aggiungere?» se il job ha già file. Non alzare il tetto. Non unificare mappe. Non OCR.

## Bozza hub (dopo merge)

- GUIDA: Import PDF richiede azienda cliente; Ambito «Tutto lo studio» / Patrimonio non sblocca upload.
- Roadmap § Stato attuale: una riga su gate azienda Import.

## Esito

- FE: Carica PDF / cartella / Estrai / Screening visibili, `disabled` + title se manca `company_id`. Prefill da CompanyScope solo azienda cliente (non `""` / `studio`).
- BE: `createJob`, `uploadFiles`, `screenAndPlace` → 400 `COMPANY_REQUIRED_FOR_UPLOAD`.
- Annulla caricamento: pulsante in dettaglio + × in lista, conferma, elimina job e file (non purge registro).
- Anti-errore: tetto 80 + avviso; conferma se il job ha già file. Non alzato il tetto. Non mappe. Non OCR.

L1: `importFolderUpload` + `importJobsPage.companyGate` + `importJobs.controller` — verdi. Suite FE 1249 verdi. Build Vite OK.

GUIDA/roadmap: sync hub post-merge (nessun altro DEPUTYTASK APERTO). Deploy PROD PID `1134642`→`1149359`, health 200.
