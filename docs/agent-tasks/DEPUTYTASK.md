# DEPUTYTASK — Ingest archivio IA-4 (picker cartella radice)

**Stato:** APERTO  
**Aperto:** 20/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Nota:** stessa linea PR #506 (IA-1 cherry-pick + IA-2/IA-3). Slot precedente IA-2 CHIUSO su questo branch.  
**Rischio:** Medio — Cloud **non** mergia. Nessuna migrazione: path relativo in `original_name`.

HITL: cartella radice + sottocartelle (non ZIP). Screening/allocazione = **IA-5**, non questa slice.

---

## Slice unica: IA-4

**Obiettivo (parole povere)**: in Import PDF si può scegliere una cartella intera. I PDF tengono il percorso delle sottocartelle (es. `Rossi-2024/capitolato.pdf`). I file restano in coda sul server. Non si crea il caso Riesame e non si classifica in automatico.

### DoD

- [ ] Secondo controllo «Carica cartella» (`webkitdirectory`) accanto a «Carica PDF»
- [ ] `relative_paths[]` in FormData; server sanitizza (`..`, path assoluti, solo PDF)
- [ ] Path salvato in `import_job_files.original_name` (NVARCHAR 500) — **niente colonna nuova**
- [ ] Limite file alzato a 80 (FE + multer), non-PDF della cartella ignorati
- [ ] Titolo commit / nome allegato usano il basename (lista file mostra il path)
- [ ] **Non** screening, **non** alloca, **non** ZIP, **non** caso Riesame

### Cosa NON toccare

`contractReview.*`, `caseDocumentAnalysis`, OCR, ingest staging, MC, SAL, GUIDA, `PROJECT_ROADMAP.md` § Stato attuale, `PROJECT_CONTEXT.md`, mappe folder 4.3 vs 4.5.

### File previsti

- `app/src/pages/ImportJobsPage.jsx` + CSS
- `app/src/services/apiService.js`
- `app/src/utils/importFolderUpload.js` + test
- `app/src/utils/importNormCommit.js` (solo basename titolo)
- `backend/src/utils/importRelativePath.js` + test
- `backend/src/controllers/importJobs.controller.js`
- `backend/src/routes/importJobs.routes.js`
- `backend/scripts/deploy-manifest.json`
- PLAN + questo brief
