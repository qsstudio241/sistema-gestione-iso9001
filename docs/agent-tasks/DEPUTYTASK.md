# DEPUTYTASK — Piano ingest + learning (27/06/2026)

## Stato sessione precedente — CHIUSA

- Fix `personnelId` upload batch patentini: PR **#175**, deploy VPS **27/06/2026**
- Errore WPQR `AI extraction fallita: Unterminated string in JSON` — **non bloccante**; record creato in bozza

---

## Piano approvato — esecuzione sequenziale

**Documento completo**: [`PLAN_INGEST_LEARNING_SLICES.md`](PLAN_INGEST_LEARNING_SLICES.md)

| Slice | Contenuto | Stato |
|---|---|---|
| **IG-1** | Motore `documentIngestPipeline` + OCR npm + JSON repair + regex fallback | **PROSSIMA** |
| IG-2 | Unifica batch WPQR/patentini sulla pipeline | in attesa |
| IG-3 | UI revisione umana pre-commit | in attesa |
| IG-4 | Tabella `import_extraction_feedback` + cattura correzioni | in attesa |
| IG-5 | Few-shot da feedback org (auto-apprendimento) | in attesa |
| IG-6 | Estensione tipi (WPS, NDT, …) solo via schema | in attesa |

---

## Slice attiva: IG-1

### Obiettivo
Pipeline ingest unica e difensiva (testo + regole + AI + merge), senza cambiare ancora la UI.

### File da creare/modificare
- `backend/src/services/documentIngestPipeline.service.js` (nuovo)
- `backend/src/utils/jsonRepair.js` (nuovo)
- `backend/src/utils/ruleFieldExtractors.js` (nuovo)
- `backend/package.json` — aggiungere `tesseract.js`, `pdf2pic`
- `backend/src/services/documentIngestPipeline.test.js` (nuovo)
- `backend/scripts/deploy-manifest.json` — includere nuovi file

### Criteri TEST OK
1. `npm test` in `backend/` — test pipeline verdi
2. JSON AI rotto in test → recovery o campi regex, nessun throw
3. Deploy VPS + health 200
4. Aggiornare riga in `GUIDA_CONSOLIDATA.md` (Esperienza)

### Comando deputy
```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

## Backlog (dopo piano ingest)

1. Dismettere ambiente test `/var/www/sgq-backend-test`
2. Hardening RBAC welding
3. MT/PT/UT template Word
