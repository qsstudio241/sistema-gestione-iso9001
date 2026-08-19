# DEPUTYTASK — Material Compliance ingest (MC-B)

**Stato:** CHIUSO — TEST OK (19/08/2026, [PR #476](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/476))  
**Aperto:** 19/08/2026 (dopo merge MC-I1 [#473](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/473))  
**Chiuso:** 19/08/2026 — L1 47/47 (`materialCertificates.controller` + `documentTextExtractor`)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-B  
**Spec:** [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md) § OCR `text_extract_reason` · ADR-024  
**Rischio:** Medio — mapping extract + tag `ocr_ok`; nessuna migrazione; Cloud **non** mergia  
**Stream:** stesso file epic ingest.

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: DATA_MODEL text_extract_reason (ocr_ok / ocr_unavailable / ocr_failed / ocr_skipped / text_layer)
- Si parte su: collegare Estrai MC all’OCR già in documentTextExtractor (S1a #471)
```

## Slice unica: MC-B — OCR scan

### Fatto

- `extractDocumentText`: OCR ok → `{ text, reason: 'ocr_ok' }` (niente secondo motore)
- `mapTextReason`: `ocr_ok` / `ocr_unavailable` / `ocr_failed` restano; `ocr_skipped` solo `unsupported(_format)`
- `pdf_no_text_layer` legacy → `ocr_unavailable` (l’estrattore non lo emette più)

### File toccati

- `backend/src/controllers/materialCertificates.controller.js` (+ test)
- `backend/src/services/documentTextExtractor.service.js` (+ test)
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md`
- `docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md`

### Non toccato

- GUIDA / roadmap (bozza sotto; parallelo MR-2 #475 e ISO-7 #474)
- `ocrExtractor.js`, ISO-4, Assistente AI, RDP/NDT

### Test

```bash
cd backend && npx jest src/controllers/materialCertificates.controller.test.js src/services/documentTextExtractor.service.test.js --forceExit
# 47/47
```

Dopo merge + **deploy backend** VPS: Estrai su DDT scansionato azienda 179 → `ocr_ok` (o `ocr_failed`/`ocr_unavailable` se manca Ghostscript/tesseract), mai `ocr_skipped` su un PDF.

### Bozza GUIDA / roadmap (hub dopo merge)

- GUIDA: `ocr_skipped` ≠ `ocr_unavailable`. OCR ok = `ocr_ok` sull’estrattore, non `text_layer`.
- Roadmap: MC-B OCR scan PR #476. Prossima ingest **MC-I2**.

### Prossima slice

**MC-I2** — 3.1 singolo: colata / DDT / norma (Tecnovespa `12174/2026`). Nuovo brief APERTO su questo stream prima del deputy.
