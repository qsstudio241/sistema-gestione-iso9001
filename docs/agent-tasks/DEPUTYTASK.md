# DEPUTYTASK — Ingest archivio IA-5 (screening + posa)

**Stato:** APERTO  
**Aperto:** 20/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Rischio:** Medio — Cloud **non** mergia. Nessuna migrazione.

Gate «pronta»: CI + Bugbot + Security Review letti su questa revisione (regola 20/08).

---

## Slice unica: IA-5

**Obiettivo (parole povere)**: dopo «Estrai testo», un pulsante **Screening e posa** legge nome/cartella/poco testo, decide il tipo e, se è chiaro, mette il PDF nello scaffale azienda. I tipi dubbi restano in coda. Le qualifiche **non** diventano da sole una riga registro (resta Commit a Qualifica). Senza azienda: classifica, non posa.

### DoD

- [ ] Helper `screenImportFile` (path + nome + testo corto)
- [ ] `POST /import-jobs/:id/screen-and-place`
- [ ] Auto-posa solo `confidence=high` + tipo mappato + azienda + non-qualifica
- [ ] Guess salvata in `ai_extraction_json.screening`
- [ ] Pulsante in Import PDF
- [ ] **Non** caso Riesame (IA-6), **Non** coda admin (IA-5b), **Non** OCR nuovo

### Cosa NON toccare

`contractReview.*`, ingest staging, MC, SAL, GUIDA, `PROJECT_ROADMAP.md` § Stato attuale, `PROJECT_CONTEXT.md`, mappe 4.3 vs 4.5.

### File previsti

- `backend/src/utils/importScreening.js` + test
- `backend/src/controllers/importJobs.controller.js`
- `backend/src/routes/importJobs.routes.js`
- `backend/scripts/deploy-manifest.json`
- `app/src/pages/ImportJobsPage.jsx`
- `app/src/services/apiService.js`
- PLAN + questo brief
