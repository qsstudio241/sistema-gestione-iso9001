# DEPUTYTASK — Ingest archivio IA-2 (capitolato → 2.2)

**Stato:** CHIUSO — TEST OK L1 (20/08/2026)  
**Aperto:** 20/08/2026  
**Chiuso:** 20/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Nota:** la PR #505 ha mergiato solo la mappa. Il feat IA-1 è cherry-pick in questa stessa linea + IA-2/IA-3.  
**Rischio:** Medio — Cloud **non** mergia. Prossima: **IA-4** picker cartella radice.

---

## Esito IA-2 + preview IA-3

- Tipo registro `capitolato` (etichetta «Capitolato / RFQ / ordine»)
- Scaffale azienda `2.2` CAPITOLATI (mappe FE + provisioner + folder-suggestion)
- Alias backend `rfq` / `ordine` / `order` → stesso cassetto (se l’AI indovina così)
- Dialog Import PDF mostra «Scaffale azienda previsto: CAPITOLATI (2.2)»
- **Non** creato il caso Riesame (IA-6)

### Test

- Backend: `importJobs.controller` + `documentTreeProvisioner.folder` verdi
- Frontend: `documentTypesAlignment` + `uploadNormaE2E` 24 verdi

### File

- `app/src/data/documentTypes.js`
- `app/src/data/documentFolderMapping.js`
- `app/src/pages/ImportJobsPage.jsx`
- `app/src/tests/documentTypesAlignment.test.js`
- `backend/src/services/documentTreeProvisioner.service.js`
- `backend/src/services/documentTreeProvisioner.folder.test.js`
- `backend/src/controllers/document.controller.js` (solo chiave mappa)
- `backend/src/controllers/importJobs.controller.test.js`
- PLAN + questo brief

---

## Bozza sync hub (dopo merge)

- Roadmap: IA-1+IA-2: capitolato va in 2.2; preview scaffale in Import PDF. Prossima IA-4.
- GUIDA: tipo `capitolato` nel registro; non è il Riesame di direzione (cartella 14).
