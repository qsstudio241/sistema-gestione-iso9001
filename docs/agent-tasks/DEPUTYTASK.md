# DEPUTYTASK — Ingest archivio IA-4 (picker cartella radice)

**Stato:** CHIUSO — TEST OK L1 (20/08/2026)  
**Aperto:** 20/08/2026  
**Chiuso:** 20/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Nota:** stessa linea PR #506 (IA-1 + IA-2/IA-3 + IA-4).  
**Rischio:** Medio — Cloud **non** mergia. Nessuna migrazione: path relativo in `original_name`.

---

## Esito IA-4

- Secondo controllo «Carica cartella» (`webkitdirectory` via `bindDirectoryPicker`)
- `relative_paths[]` in FormData; server sanitizza (`..`, path assoluti, solo PDF)
- Path in `import_job_files.original_name` (NVARCHAR 500) — **niente colonna nuova**
- Limite 80 PDF (FE + multer); non-PDF della cartella ignorati
- Titolo commit / nome allegato = basename; lista file mostra il path
- **Non** screening, **non** alloca, **non** ZIP, **non** caso Riesame
- Bugbot: senza azienda, commit tipo mappato → `400 COMPANY_REQUIRED_FOR_FOLDER` (non più 404). Mappa FE 4.3 vs BE 4.5 **non** allineata (debito già in piano).

### Test

- Backend: `importRelativePath` + `importJobs.controller` (35 verdi con folder + registry)
- Frontend: `importFolderUpload` + `importNormCommit` + `documentTypesAlignment`

### File

- `app/src/pages/ImportJobsPage.jsx` + CSS
- `app/src/services/apiService.js`
- `app/src/utils/importFolderUpload.js` + test
- `app/src/utils/importNormCommit.js` (basename titolo)
- `backend/src/utils/importRelativePath.js` + test
- `backend/src/controllers/importJobs.controller.js`
- `backend/src/routes/importJobs.routes.js`
- `backend/scripts/deploy-manifest.json`
- PLAN + questo brief

---

## Bozza sync hub (dopo merge)

- Roadmap: IA-4 picker cartella in Import PDF; path in `original_name`; prossima IA-5 screening+alloca.
- GUIDA: in Import PDF si può caricare una cartella; i nomi delle sottocartelle restano visibili. Lo screening automatico non è ancora attivo.
