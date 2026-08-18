# DEPUTYTASK — Material Compliance MC-4 (API)

**Stato:** APERTO — TEST OK, attesa PR/merge  
**Aperto:** 17/08/2026 (dopo merge MC-3 #454)  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-4  
**Spec:** [`MATERIAL_COMPLIANCE_API.md`](../specs/MATERIAL_COMPLIANCE_API.md) · [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md)  
**Rischio:** Medio — backend additivo, nessuna migrazione; PR + gate Bugbot; Cloud **non** mergia  
**Ambiente:** TEST (nessun SQL nuovo; schema MC-1 / mig. **149** già TEST+PROD). Non toccate 149/151/152.  
**Non toccare:** [`DEPUTYTASK.md`](DEPUTYTASK.md) (SAL S1a)

---

## Fonti Markdown (dichiarare, poi partire)

```text
Fonti Markdown:
- Coperte: EN 10204, EN 10168, ISO 10474/404/6929, EN 10025-2, EN 10210-1, EN 10219-1, ISO/TR 15608, ISO 14341 (classificazione)
- Mancanti (non bloccano): ISO 2560 / 17632 / 14174
- Si parte su: API lista/dettaglio/upload + extract (ingest) + evaluate (motore MC-3 persistito); skip se manca livello ADR-021 o soglie apporto
```

## Esito

- Prefisso `/api/v1/material-certificates` (JWT + AND `saldatura`/`ai_import`)
- Extract: `documentTextExtractor` + `importAiExtraction` (`logAiInteraction`); senza testo → `text_ready` / `ocr_skipped`, non 500; **409** se già `compliant`/`archived`/`pending_review`
- Evaluate: `evaluateMaterialCertificate` → transazione DELETE+INSERT checks + `pending_review`; azzera `reviewed_by`/`reviewed_at`/`review_notes`
- `compliant` solo da POST approve (HITL). PATCH rifiuta `workflow_status`. Reject solo da `pending_review`
- Tenant: `companyBelongsToOrg` su create/list/stats
- L1: 46/46 (`materialCertificates.controller.test.js` + seam licenza)
- Nessuna migrazione (schema 149 basta)

Bugbot (branch): extract non degrada HITL; evaluate pulisce i timbri di revisione. Prossima: **MC-5** UI dopo merge. `DEPUTYTASK.md` (SAL S1a) non toccato.
