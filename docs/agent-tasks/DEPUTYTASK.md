# DEPUTYTASK — Piano ingest + learning (28/06/2026)

## Chiuso

- PR **#175** mergiata su `main` — fix `personnelId` upload batch patentini
- PR **#181** — pipeline IG-1 (merge in corso)
- Deploy VPS IG-1: 28/06/2026, health OK, OCR installato

---

## Slice attiva: **IG-3** — revisione umana pre-commit

### Obiettivo
- UI revisione campi estratti (confidence verde/giallo/rosso) prima del commit su batch WPQR e patentini
- Pattern allineato a `ImportJobsPage`
- Gap tracker: `PLAN_INGEST_LEARNING_SLICES.md` sezione **Gap tracker ingest 3834**

### Prerequisiti (ok)
- IG-1 ✅ #181, IG-2 ✅ #182, deploy VPS health OK

---

## Chiuso: IG-2

- `wpqrIngest.service.js` e `qualificationIngest.service.js` → `runDocumentIngest()`
- PR **#182** mergiata, test Jest 21/21

---

## Piano slice

[`PLAN_INGEST_LEARNING_SLICES.md`](PLAN_INGEST_LEARNING_SLICES.md)

| Slice | Stato |
|---|---|
| IG-1 | ✅ mergiata (#181) |
| IG-2 | ✅ #182 |
| IG-3 | **ATTIVA** |
