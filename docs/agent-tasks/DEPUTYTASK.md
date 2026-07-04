# DEPUTYTASK — IG-N: norme nella pipeline ingest unificata

> **Creato**: 04/07/2026  
> **Stato**: APERTO — dipende da merge PR ADR-017 + norm catalog  
> **ADR**: [`docs/adr/ADR-017-ingest-reference-network.md`](../adr/ADR-017-ingest-reference-network.md)

---

## Obiettivo

Allineare upload norme al pattern patentini: `documentIngestPipeline` → `ingest_staging` → `IngestReviewDialog` (PDF affiancato) → commit `document_registry` + lookup UNI.

---

## Prerequisiti

- [ ] Merge PR con ADR-017, `uniStoreConnector`, `ingestReferencePattern`, mig. **120** su VPS
- [ ] `npm test` backend servizi ingest + norm

---

## Slice IG-N1 (backend)

1. Aggiungere `norma` a `SUPPORTED_DOC_TYPES` in `documentIngestPipeline.service.js`
2. Nuovo endpoint staging upload norme (o refactor `normUpload.controller` → staging only, commit separato)
3. Lookup catalogo UNI in pipeline pre-staging; `catalog_lookup` in payload staging
4. `buildNormTypeSpecificData` + `standardCodeNormalizer` al commit

## Slice IG-N2 (frontend)

1. `NormUploadButton` → flusso come `QualificationUploadButton` (review dialog)
2. Warning catalogo / scelta candidati UNI se `ambiguous_match`
3. Badge `da_verificare` coerente albero + pannello

## DoD

- Upload ISO/TR 15608: codice normalizzato, vigore da UNI, review solo se ambiguous
- Test L1 pipeline norma + commit
- Mig. 120 eseguita VPS: `node /tmp/run-migration-120-vps.js`

---

## Chiusura deputy

`Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
