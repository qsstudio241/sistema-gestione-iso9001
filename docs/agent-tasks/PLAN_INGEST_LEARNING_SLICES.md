# Piano slice — Ingest documenti scalabile + auto-apprendimento

> **Stato**: IG-1 completata e mergiata (#181) 28/06/2026. **Prossima: IG-2**.

> **Obiettivo**: affidabilità ingest (patentini, WPQR, WPS, NDT, …) con pipeline unica, revisione umana e miglioramento progressivo dai feedback operatore.
> **Fonti**: Sprint 9–10 roadmap, `documentTypeSchemas.js`, `importAiExtraction.service.js`, ADR-010, tabella `ai_feedback` (055).

---

## Risposta sintetica: si puo fare?

**Si.** Non serve reinventare: si unifica cio che esiste (import jobs + schemi tipo + adapter AI) e si aggiunge un **anello di feedback** sulle correzioni umane — stesso pattern gia usato per le conclusioni audit (Livello B/C in GUIDA_CONSOLIDATA).

Limiti realistici:
- L'apprendimento e **per organizzazione** (e opzionalmente per `doc_type`), non un modello custom addestrato.
- Meccanismo: **few-shot + regole estratte** dalle correzioni, non fine-tuning GPU.
- Ogni nuovo tipo documento = nuova voce in `documentTypeSchemas.js` + test L1 — nessun fork del motore.

---

## Architettura target (unica pipeline)

```
Upload (batch o import job)
        |
        v
+------------------+
| 1. TESTO         |  pdf-parse  -->  OCR fallback (tesseract+pdf2pic)
+------------------+
        |
        v
+------------------+
| 2. REGOLE        |  regex/heuristiche per campo (da schema.tipo)
+------------------+
        |
        v
+------------------+
| 3. AI            |  extractStructuredByDocType(docType)
|                  |  + few-shot da feedback org (slice IG-5)
+------------------+
        |
        v
+------------------+
| 4. MERGE         |  per ogni campo: max(confidence), AI vs regole
|                  |  JSON repair + 1 retry se parse fallisce
+------------------+
        |
        v
+------------------+
| 5. STAGING       |  bozza revisionabile (import_job_files o ingest_staging)
|                  |  confidence per campo (verde/giallo/rosso)
+------------------+
        |
        v  [operatore: conferma / corregge / scarta]
+------------------+
| 6. COMMIT        |  qualifications | wpqr_records | document_registry
+------------------+
        |
        v
+------------------+
| 7. LEARNING      |  salva delta AI vs finale umano --> few-shot futuro
+------------------+
```

**Regola scalabilita**: aggiungere un tipo = aggiungere schema in `app/src/data/documentTypeSchemas.js` + mirror backend `backend/src/data/documentTypeSchemas.js`. Zero duplicazione prompt in `wpqrIngest.service.js` / `qualificationIngest.service.js` (da dismettere dopo IG-2).

---

## Slice sequenziali

### IG-1 — Motore ingest robusto (fondazione)

**Scope**
- Nuovo `backend/src/services/documentIngestPipeline.service.js`
- `backend/src/utils/jsonRepair.js` — strip fence, retry parse, estrazione `{...}` da testo sporco
- `backend/src/utils/ruleFieldExtractors.js` — regex condivise (date, ISO 4063, gruppi materiale, ref WPQR)
- Dipendenze VPS: `tesseract.js`, `pdf2pic` in `package.json` + `npm install` su VPS
- Test Jest: JSON rotto, PDF testo minimo, merge regole+AI mock

**DoD**
- [x] Pipeline estrae testo + produce `{ fields, confidence, warnings }` per `docType=wpqr|patentino_saldatore`
- [x] JSON malformato AI: almeno 1 retry o fallback regole (no crash)
- [x] Deploy VPS + smoke health
- [x] Nessun cambio UX obbligatorio (backend-only)

**Stato**: ✅ PR #181 mergiata 28/06/2026.


---

### IG-2 — Unificare upload batch su pipeline

**Scope**
- Refactor `wpqrIngest.service.js` e `qualificationIngest.service.js` → delegano a `documentIngestPipeline`
- Usare `extractStructuredByDocType` + schemi esistenti
- Aumentare `maxTokens` WPQR (1500–2000)
- Allineare campi commit con `aiExpectedSchema`

**DoD**
- [x] Upload batch patentini e WPQR usano stesso motore di Import PDF
- [x] Test L1 su ingest WPQR con JSON AI mock rotto → warning ma campi regex riempiti
- [x] Fix `personnelId` (#175) nel commit path qualifiche
- [ ] Deploy VPS post-merge

**Stato**: implementato 28/06/2026 — PR IG-2.

---

### IG-3 — Revisione umana pre-commit (staging UI)

**Scope**
- Estendere `ImportJobsPage` **oppure** modale revisione su batch upload (WPQR/qualifiche)
- Mostra campi estratti con badge confidence (da pipeline)
- Azioni: **Conferma**, **Correggi e salva**, **Scarta**
- Record resta `approval_status=bozza` / `import_status=ai_draft` fino a conferma
- Migrazione DB (094+): colonne su `import_job_files` se servono — `staged_fields_json`, `field_confidence_json`, `review_status`

**DoD**
- [ ] Operatore vede preview campi prima del commit definitivo
- [ ] Scarta non crea record registry (o marca rejected)
- [ ] Conferma crea record come oggi ma con dati revisionati
- [ ] Smoke L3: upload → revisione → commit → record visibile in registro

**Rischio**: medio-alto (UX + DB). Prerequisito IG-1/IG-2.

---

### IG-4 — Cattura feedback operatore (learning dati)

**Scope**
- Migrazione **095**: tabella `import_extraction_feedback`
  - `organization_id`, `company_id`, `doc_type`, `source` (batch|import_job)
  - `ai_payload_json`, `human_payload_json`, `action` (accepted|corrected|rejected)
  - `field_diffs_json` (solo campi cambiati), `file_name`, `model_used`, `created_by`
- `ingestFeedback.service.js` — `recordFeedback()`, `getFieldDiff()`
- Hook su conferma/scarto in IG-3 e su commit import job esistente

**DoD**
- [ ] Ogni conferma con correzioni salva delta campo-per-campo
- [ ] Ogni scarto salva motivo + payload AI per analisi
- [ ] Indice per query `(organization_id, doc_type, created_at DESC)`
- [ ] Test L1 record + diff

**Rischio**: basso (tabella nuova, no breaking).

---

### IG-5 — Auto-apprendimento operativo (few-shot)

**Scope**
- `ingestLearning.service.js`
  - `buildFewShotExamples(orgId, docType, limit=3)` — ultimi N **accepted/corrected** con alta qualita
  - Inietta esempi in prompt `extractStructuredByDocType` (sezione "Esempi dalla tua organizzazione")
- Metriche admin leggere: `GET /import-jobs/learning-stats?doc_type=wpqr` (opzionale, slice minima)
- Soglia: usare esempio solo se `human_payload` completo su campi obbligatori schema

**DoD**
- [ ] Dopo 3+ conferme corrette stessa org, prompt include esempi
- [ ] Nessun dato cross-tenant (sempre `organization_id`)
- [ ] Test: mock feedback → prompt contiene esempio
- [ ] Documentato in GUIDA_CONSOLIDATA (sezione Esperienza)

**Rischio**: basso. Miglioramento graduale, non bloccante.

---

### IG-6 — Estensione tipi documento (scalabilita)

**Scope**
- Completare schemi: `cert_ndt`, `dichiarazione_ce`, `cert_taratura` (se mancanti)
- Endpoint batch WPS (backlog DEPUTYTASK) su stessa pipeline
- Checklist "aggiungi tipo": schema FE+BE, test estrazione, 1 PDF golden file in `backend/tests/fixtures/`

**DoD**
- [ ] Nuovo tipo = solo schema + test + route commit (no nuovo service ingest)
- [ ] Almeno WPS aggiunto come terzo tipo saldatura
- [ ] Tabella tipi supportati aggiornata in PROJECT_ROADMAP

**Rischio**: basso per tipo, incrementale.

---

## Sequenza e dipendenze

```
IG-1 (motore) --> IG-2 (unifica batch) --> IG-3 (UI revisione)
                                              |
                                              v
                                        IG-4 (feedback DB)
                                              |
                                              v
                                        IG-5 (few-shot)
                                              |
                                              v
                                        IG-6 (nuovi tipi, iterativo)
```

**Non saltare slice.** IG-3 senza IG-1/2 riproduce UX su motore fragile. IG-5 senza IG-4 non ha dati.

---

## Comando deputy (slice corrente)

Al termine di ogni slice: aggiornare stato qui + `DEPUTYTASK.md` + riga in `GUIDA_CONSOLIDATA.md` (Esperienza).

**Prossima slice attiva**: **IG-2**

---

## Metriche di successo (affidabilita)

| Metrica | Target post IG-5 |
|---|---|
| Upload batch con status ok senza warning critico | > 70% PDF digitali |
| Campi obbligatori compilati senza intervento umano | > 50% (tipi saldatura) |
| JSON AI invalido senza recovery | < 5% (dopo repair+retry) |
| Tempo medio revisione operatore | in calo dopo 20+ feedback/org |

---

## Riferimenti codice esistente

| Asset | Ruolo |
|---|---|
| `importAiExtraction.service.js` | AI strutturata + schemi tipo |
| `documentTypeSchemas.js` (app + backend) | Fonte unica campi/prompt |
| `importJobs.controller.js` + `commitToQualification` | Pattern commit umano |
| `ai_feedback` (055) | Precedente per conclusioni audit — non riusare per ingest (payload diverso) |
| `ocrExtractor.js` | OCR fallback (da attivare con npm) |
| `wpqrIngest.service.js` / `qualificationIngest.service.js` | In refactor IG-2 |
