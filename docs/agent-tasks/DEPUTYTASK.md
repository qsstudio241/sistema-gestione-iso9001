# DEPUTYTASK — Piano ingest + learning (28/06/2026)

## Slice IG-1 — TEST OK (codice)

**Implementato**:
- `documentIngestPipeline.service.js` — pipeline testo → regole → AI → merge + confidence
- `jsonRepair.js` — parser JSON difensivo (+ integrato in `importAiExtraction`)
- `ruleFieldExtractors.js` — regex WPQR/patentino
- `package.json`: `tesseract.js`, `pdf2pic`
- Test Jest: 19/19 verdi (`documentIngestPipeline` + `importAiExtraction`)

**Deploy VPS pendente** (dopo merge PR): `deploy-to-vps.sh` + `npm install` in `/var/www/sgq-backend`

**Deploy VPS**: eseguito 28/06/2026 — PID 205303, health OK, `npm install` tesseract.js + pdf2pic su VPS.

---

## Slice attiva: **IG-2**

### Obiettivo
Collegare upload batch WPQR e patentini a `runDocumentIngest()` — eliminare logica duplicata in `wpqrIngest` / `qualificationIngest`.

### File
- `backend/src/services/wpqrIngest.service.js`
- `backend/src/services/qualificationIngest.service.js`
- Test integrazione batch

### DoD
- Upload batch usa pipeline unificata
- Warning JSON AI ridotti (retry + regole)
- Smoke 1 WPQR + 1 patentino

### Comando deputy
```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

## Piano completo

[`PLAN_INGEST_LEARNING_SLICES.md`](PLAN_INGEST_LEARNING_SLICES.md)

| Slice | Stato |
|---|---|
| IG-1 | ✅ codice + test |
| IG-2 | **PROSSIMA** |
| IG-3–IG-6 | in attesa |
