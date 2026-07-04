# DEPUTYTASK — IG-N: norme nella pipeline ingest unificata

> **Creato**: 04/07/2026  
> **Chiuso**: 04/07/2026  
> **Stato**: CHIUSO — TEST OK  
> **PR**: #219 mergiata su `main` il 04/07/2026  
> **Deploy VPS**: completato 04/07/2026 (`normIngest.service.js` + controller aggiornato, health OK)  
> **Branch**: `cursor/ig-n-norm-ingest-pipeline` (mergiato)  
> **ADR**: [`docs/adr/ADR-017-ingest-reference-network.md`](../adr/ADR-017-ingest-reference-network.md)

---

## Obiettivo

Allineare upload norme al pattern patentini: `documentIngestPipeline` → `ingest_staging` → `IngestReviewDialog` (PDF affiancato) → commit `document_registry` + lookup UNI.

---

## Stato slice

| Slice | Descrizione | Stato |
|-------|-------------|-------|
| IG-N1 | Backend: pipeline `norma`, staging, catalog lookup, commit | ✅ |
| IG-N2 | Frontend: `NormUploadButton` + `IngestReviewDialog` | ✅ |

---

## Prerequisiti

- [x] Merge PR con ADR-017, `uniStoreConnector`, `ingestReferencePattern`, mig. **120** su VPS (04/07/2026)
- [x] Test L1 backend servizi ingest + norm (deputy 04/07/2026)

---

## DoD verificato

- [x] `norma` in `SUPPORTED_DOC_TYPES` (`documentIngestPipeline.service.js`)
- [x] `normIngest.service.js`: estrazione + lookup UNI + commit `document_registry`
- [x] `normUpload.controller.js` → staging (+ auto-commit se catalogo deterministico)
- [x] `ingestStaging.service.js` supporta commit `norma` (modulo `documents`)
- [x] `NormUploadButton` → flusso review come patentini (`IngestReviewDialog`)
- [x] Warning catalogo / `da_verificare` su match ambiguo
- [x] Test L1: `normIngest.service.test.js` (5) + pipeline + ingest (26 totali suite ingest/norm)
- [x] Build Vite verde
- [x] `deploy-manifest.json` aggiornato con `normIngest.service.js`

---

## Output deputy

**TEST OK**

- Backend VPS: health `healthy`, database OK (04/07/2026)
- Frontend: merge `main` → deploy Netlify automatico (~2 min)
- Preview verificabile: https://deploy-preview-219--systemgest.netlify.app

---

## Prompt per lanciare il deputy

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
