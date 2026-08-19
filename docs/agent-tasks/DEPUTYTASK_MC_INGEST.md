# DEPUTYTASK — Material Compliance ingest (MC-B)

**Stato:** APERTO  
**Aperto:** 19/08/2026 (dopo merge MC-I1 [#473](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/473))  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-B  
**Spec:** [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md) § OCR `text_extract_reason` · ADR-024  
**Rischio:** Medio — mapping extract + tag `ocr_ok` sull’estrattore già in `main`; nessuna migrazione; PR + **un** Bugbot a slice chiusa; Cloud **non** mergia  
**Ambiente:** backend VPS dopo merge (S1a è in `main` ma serve deploy se TEST/PROD non hanno ancora l’OCR nell’estrattore). Record ADA DDT `000775RE` / azienda 179 = prova già fatta (`ocr_skipped`).  
**Stream:** stesso file epic ingest. Non riusare per un altro modulo.

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: DATA_MODEL text_extract_reason (ocr_ok / ocr_unavailable / ocr_failed / ocr_skipped / text_layer)
- Si parte su: collegare Estrai MC all’OCR già in documentTextExtractor (S1a #471); skip split PDF, skip few-shot, skip soglie apporto
```

## Slice unica di questa sessione: MC-B — OCR scan (riuso, non un secondo motore)

**Obiettivo**: un PDF scansionato (DDT senza strato testo) in Estrai produce testo (anche rumoroso) e `text_extract_reason` **non** è `ocr_skipped` se l’OCR gira. Se l’OCR fallisce: `ocr_failed` / `ocr_unavailable`, HTTP 200, mai 500.

### Causa già letta (non riscoprire)

- `extractCertificate` chiama già `extractDocumentText`. S1a ([#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471)) tenta `ocrExtractor` se lo strato è vuoto/sotto soglia. **Non** copiare OCR nel controller MC.
- Dopo S1a l’estrattore **non** emette più `pdf_no_text_layer`. OCR ok oggi torna `{ text }` **senza** `reason` → MC lo etichetta `text_layer`. OCR assente (`ocr_unavailable`) è mappato a **`ocr_skipped`** (sbagliato: skipped = formato non PDF).
- ADA `000775RE`: `ocr_skipped` perché a suo tempo l’estrattore si fermava a `pdf_no_text_layer`.

Vocabolario DATA_MODEL (non inventare valori): `text_layer` | `ocr_ok` | `ocr_poor` | `ocr_unavailable` | `ocr_failed` | `ocr_skipped`.

### DoD

1. OCR ok (testo ≥ soglia MC) → persistito, `text_extract_reason: ocr_ok` (non `ocr_skipped`, non `text_layer`)
2. `ocr_unavailable` e `ocr_failed` restano tali, 200, stato `text_ready`, mai 500
3. `ocr_skipped` solo per formato non PDF (`unsupported` / `unsupported_format`)
4. Nessun secondo motore; `ocrExtractor` non importato nel controller MC
5. Test L1: `materialCertificates.controller.test.js` + `documentTextExtractor.service.test.js` (reason `ocr_ok`)
6. Un Bugbot a slice chiusa

### File previsti (disgiunti da PR aperte #474 ISO-7 e #475 MR-2)

- `backend/src/controllers/materialCertificates.controller.js` (`mapTextReason` / extract)
- `backend/src/controllers/materialCertificates.controller.test.js`
- `backend/src/services/documentTextExtractor.service.js` (solo `reason: 'ocr_ok'` se OCR produce testo — niente nuovo motore)
- `backend/src/services/documentTextExtractor.service.test.js`
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md` (questo brief)
- `docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md` (stesso epic)

**Non** in questa PR (parallelo MR-2 / ISO-7): `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md`. Bozza sotto; sync hub dopo merge.

### Cosa NON toccare

- [`DEPUTYTASK.md`](DEPUTYTASK.md) (scontrino S1a) e [`DEPUTYTASK5.md`](DEPUTYTASK5.md) (MR-2 APERTO)
- `ocrExtractor.js` (solo riuso via estrattore)
- ISO-4 / Welding Book / RDP / NDT / Assistente AI
- MC-I2…I4, MC-7, MC-6, soglie apporto, split PDF
- `ocr_running` async (extract resta sincrono)

### Test

```bash
cd backend && npx jest src/controllers/materialCertificates.controller.test.js src/services/documentTextExtractor.service.test.js --forceExit
```

Dopo merge + deploy VPS: Estrai su DDT scansionato azienda 179 → testo + reason `ocr_ok` (o `ocr_failed`/`ocr_unavailable` se il motore manca sul server), mai `ocr_skipped` su un PDF.

### Bozza GUIDA / roadmap (dopo merge, chat hub)

- GUIDA: `ocr_skipped` ≠ `ocr_unavailable`. Skipped = non è un PDF. OCR ok = `ocr_ok` sull’estrattore, non `text_layer`.
- Roadmap: MC-B OCR scan PR (questo numero). Prossima ingest **MC-I2** (colata/DDT/norma 3.1).

### Comando per il deputy

`Leggi docs/agent-tasks/DEPUTYTASK_MC_INGEST.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
