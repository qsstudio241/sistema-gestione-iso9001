# DEPUTYTASK — Material Compliance ingest (MC-I2)

**Stato:** CHIUSO — TEST OK (19/08/2026, [PR #481](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/481))  
**Aperto:** 19/08/2026 (dopo merge hub MC-B [#479](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/479))  
**Chiuso:** 19/08/2026 — L1 34/34 (`materialCertificates.controller`) + pagina Materiali 5/5  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-I2  
**Spec:** [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md) · EN 10168 B07  
**Rischio:** Medio — mapping extract + prompt; nessuna migrazione; Cloud **non** mergia  
**Stream:** stesso file epic ingest. **Non** sovrascrivere `DEPUTYTASK.md` (SAL S1a CHIUSO).

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: EN 10168 B07 = heat_or_lot_no (colata/lotto); dizionario EN-10168-layout; schema material_certificate ha heat_or_lot_no / material_standard
- Mancanti: soglie apporto (non questa slice); DDT non è codice 10168 — solo se stampato
- Si parte su: mapping anagrafica + prompt; skip split, skip OCR, skip few-shot, skip soglie inventate
```

## Slice unica: MC-I2 — 3.1 singolo: colata / DDT / norma

### Fatto

- `canonicalizeExtractedJson`: alias heat (`heat_number`/`colata`/`B07`/…) e norma (`steel_standard`/`filler_standard`) → chiavi canoniche anche in `extracted_json`
- DDT: `ddt_no` / `delivery_note_no` / `ddt` — **non** `purchaser_order_no` (A07)
- Extract SQL: `COALESCE` anche `ddt_no` / `ddt_date` (data `DD/MM/YYYY` → ISO)
- Fallback etichettato sul testo (`Colata` / `Heat No` / `B07`); niente regex cieca su `NNNN/YYYY`
- Alias droppati dopo la copia: PATCH che svuota il DDT non lo re-inietta da `delivery_note_no`
- Prompt BE+FE: colata come stampata; DDT solo se stampato
- HITL: `ddt_date` nel form PATCH

### File toccati

- `backend/src/controllers/materialCertificates.controller.js` (+ test)
- `backend/src/data/documentTypeSchemas.js`
- `app/src/data/documentTypeSchemas.js`
- `app/src/pages/MaterialCertificatesPage.jsx`
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md`
- `docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md`

### Non toccato

- `ocrExtractor.js`, Rule Engine, split (MC-I4), few-shot (MC-7), ISO-4, `DEPUTYTASK.md`

### Test L1

34/34 controller (alias heat → colonna; testo «Colata 12174/2026»; A07 ≠ DDT; persist `ddt_no`; PATCH non re-inietta DDT da alias). Pagina Materiali 5/5.

### DoD

- [x] L1 verdi
- [x] Brief CHIUSO TEST OK
- [ ] PR draft; Cloud non mergia — **dopo merge: deploy backend**, poi Estrai di nuovo sul 3.1 Tecnovespa (non riscoprire id 7 OCR)

### Prossima ingest

**MC-I3** — DDT ≠ 3.1.
