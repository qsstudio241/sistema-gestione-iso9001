# Piano slice — Ingest documenti scalabile + auto-apprendimento

> **Stato**: IG-1 completata (codice + test) 28/06/2026. Prossima: **IG-2**.

Vedi sezione completa in commit precedente su branch `cursor/fix-qualification-batch-personnel-id-68c3` o ricostruire da DEPUTYTASK.

## Slice

| ID | Contenuto | Stato |
|---|---|---|
| IG-1 | `documentIngestPipeline` + OCR deps + jsonRepair + regex | ✅ |
| IG-2 | Unifica batch WPQR/patentini | prossima |
| IG-3 | UI revisione pre-commit | attesa |
| IG-4 | Tabella `import_extraction_feedback` | attesa |
| IG-5 | Few-shot da feedback org | attesa |
| IG-6 | Nuovi tipi via schema only | attesa |

## Architettura (sintesi)

Upload → testo (pdf-parse/OCR) → regole → AI → merge → staging → commit → learning loop.

## Riferimenti

- `backend/src/services/documentIngestPipeline.service.js`
- `backend/src/utils/jsonRepair.js`
- `backend/src/utils/ruleFieldExtractors.js`
