# DEPUTYTASK — Material Compliance ingest (MC-7)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 17/09/2026 (dopo MC-I4 CHIUSO)  
**Chiuso:** 17/09/2026  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-7  
**Rischio:** Medio — hook feedback su PATCH/approve; nessuna migrazione; Cloud **non** mergia  
**Stream:** stesso file epic ingest. **Non** sovrascrivere `DEPUTYTASK.md`.

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: ADR-017 livelli B/C (privacy allowlist + few-shot org)
- Mancanti: nessuna soglia normativa nuova
- Si parte su: produce feedback da PATCH/approve MC → stesso anello WPQR/qualifiche
```

## Slice unica: MC-7 — Feedback ADR-017

### Decisione (nebbia chiusa)

- Stesso anello di WPQR/qualifiche: `recordFeedback` → `import_extraction_feedback` → `buildIngestLearningPromptSection` → extract
- **Niente** secondo store `lessons/`, niente fine-tuning, niente Document Registry
- Livello B: PII vietata resta fuori da `REFERENCE_PATTERN_ALLOWLIST` (heat/certificate_no non federati)
- Feedback fallito non blocca PATCH/approve

### DoD

- [x] PATCH MC (con `extracted_json`) chiama `recordFeedback` (`doc_type=material_certificate`)
- [x] Approve MC chiama `recordFeedback` (human = `corrected_json` o extracted)
- [x] Extract già passa `organizationId` (MC-I2) — nessun rifacimento extract
- [x] L1 BE mirato (48 test controller + feedback/pattern)
- [x] Brief CHIUSO TEST OK; PR draft; Cloud non mergia

### File toccati

- `backend/src/controllers/materialCertificates.controller.js` (+ test)
- `backend/src/services/ingestReferencePattern.service.test.js` (assert no PII heat/cert)
- `docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md`
- `docs/PROJECT_ROADMAP.md` § Stato

### Cosa NON toccato

- OCR / Rule Engine / Document Registry / auth / sync / JWT / migrazioni / MC-I4 / FE

### Esito

**TEST OK** — PATCH e approve MC producono feedback ADR-017; few-shot al prossimo extract via anello esistente.
