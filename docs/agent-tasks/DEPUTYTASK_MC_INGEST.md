# DEPUTYTASK — Material Compliance ingest (MC-I4)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 16/09/2026 (dopo hub; MC-I3 CHIUSO [#488](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/488))  
**Chiuso:** 16/09/2026  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-I4  
**Rischio:** Medio — extract + endpoint split + UI HITL; nessuna migrazione; Cloud **non** mergia  
**Stream:** stesso file epic ingest. **Non** sovrascrivere `DEPUTYTASK.md`.  
**Parallelo:** ISO-4b / shell dialog — file disgiunti (solo Materiali).

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: EN 10168 B07 (colata/lotto) già in extract MC-I2; DDT ≠ mill MC-I3
- Mancanti: nessuna soglia normativa nuova (split è meccanica PDF→righe)
- Si parte su: split per colata + HITL esplicito (non split pagine PDF)
```

## Slice unica: MC-I4 — 1 PDF → N certificati (busta)

### Decisione (nebbia chiusa)

- **Split per colata** (etichette Colata/Heat/B07/Lotto + eventuali `certificate_segments` AI)
- **HITL esplicito**: Estrai propone `split_candidates`; l’operatore clicca «Dividi in N righe»
- **Non** spezzare il PDF in pagine (testo specchiato / OCR inaffidabile sui confini)
- Righe sorelle condividono lo stesso `storage_path` / job; ciascuna ha la propria `heat_or_lot_no`

### DoD

- [x] Extract mill con ≥2 colate etichettate → `split_candidates` in JSON + risposta
- [x] `POST /material-certificates/:id/split` crea N−1 sorelle; parent tiene la prima colata
- [x] DDT / già divisa → 409; meno di 2 colate → 400
- [x] UI: pulsante «Dividi in N righe» (visibile; disabled se <2 candidati)
- [x] L1 BE + Vitest FE + build
- [x] Brief CHIUSO TEST OK; PR draft; Cloud non mergia

### File toccati

- `backend/src/controllers/materialCertificates.controller.js` (+ test)
- `backend/src/routes/materialCertificates.routes.js`
- `backend/src/data/documentTypeSchemas.js`
- `app/src/data/documentTypeSchemas.js`
- `app/src/services/apiService.js`
- `app/src/pages/MaterialCertificatesPage.jsx`
- `app/src/utils/materialCertificateFilters.js` (+ test)
- `app/src/tests/materialCertificatesPage.test.jsx`
- `docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK_MC_INGEST.md`

### Cosa NON toccare

- OCR / `ocrExtractor`, Rule Engine soglie, MC-7 feedback, ISO-4 / Word RDP
- Auth / JWT / sync / migrazioni
- `IngestDialogShell` / shell dialog

### Prossima ingest

**MC-7** (recordFeedback → few-shot ADR-017).
