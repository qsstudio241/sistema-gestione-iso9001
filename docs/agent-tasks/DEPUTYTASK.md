# DEPUTYTASK — Piano ingest + learning (28/06/2026)

## Chiuso

- PR **#175** mergiata su `main` — fix `personnelId` upload batch patentini
- PR **#181** — pipeline IG-1 (merge in corso)
- Deploy VPS IG-1: 28/06/2026, health OK, OCR installato

---

## Slice attiva: **IG-2** — TEST OK (codice)

### Completato
- `wpqrIngest.service.js` e `qualificationIngest.service.js` delegano a `runDocumentIngest()`
- Test Jest wpqrIngest + pipeline (21 test)
- PR in attesa merge + deploy VPS

---

## Prossima slice: **IG-3** (revisione umana pre-commit)

---

## Piano slice

[`PLAN_INGEST_LEARNING_SLICES.md`](PLAN_INGEST_LEARNING_SLICES.md)

| Slice | Stato |
|---|---|
| IG-1 | ✅ mergiata (#181) |
| IG-2 | ✅ codice (PR in corso) |
| IG-3 | **PROSSIMA** |
