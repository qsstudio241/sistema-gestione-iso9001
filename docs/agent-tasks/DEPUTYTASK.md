# DEPUTYTASK — Piano ingest + learning (28/06/2026)

## Chiuso

- PR **#175** mergiata su `main` — fix `personnelId` upload batch patentini
- PR **#181** — pipeline IG-1 (merge in corso)
- Deploy VPS IG-1: 28/06/2026, health OK, OCR installato

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
- Deploy VPS + test Jest

### Comando deputy
```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

## Piano slice

[`PLAN_INGEST_LEARNING_SLICES.md`](PLAN_INGEST_LEARNING_SLICES.md)

| Slice | Stato |
|---|---|
| IG-1 | ✅ mergiata (#181) |
| IG-2 | **IN CORSO** |
| IG-3–IG-6 | in attesa |
