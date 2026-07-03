# Piano slice — Ingest documenti scalabile + auto-apprendimento

> **Stato**: IG-1 ✅ (#181) … IG-6 ✅ (#186) — **piano completato** 28/06/2026.

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

**Stato**: ✅ PR #182 mergiata 28/06/2026.

---

## Gap tracker ingest 3834 (fonte unica — aggiornare ad ogni slice)

> **Regola**: ogni gap va chiuso in una slice assegnata. Non bloccare IG-3 per gap di tipi non ancora in batch (WPS, CE, NDT).

| ID | Gap | Impatto | Slice | Blocca IG-3? |
|---|---|---|---|---|
| G-01 | Schema AI WPQR (6 campi) vs colonne `wpqr_records` (~15 campi) — commit batch mappa sottoinsieme | Campi DB spesso vuoti dopo upload; revisione mostra solo 6 campi | **IG-3** (espandere form revisione) + **IG-6** (allineamento schema completo) | Parziale — IG-3 può partire con 6 campi, espansione in sotto-task |
| G-02 | `fieldConfidence` dalla pipeline non esposto in API batch né in UI | Operatore non vede verde/giallo/rosso | **IG-3** | **Sì** |
| G-03 | Batch WPQR/patentini committa subito in bozza senza step revisione | Nessun controllo pre-salvataggio | **IG-3** | **Sì** (obiettivo slice) |
| G-04 | Patentino: schema FE ricco (ISO 9606-1) vs mapping `qualifications` parziale | Campi estratti persi al commit | **IG-3** + regola GUIDA end-to-end | Parziale |
| G-05 | WPS: schema definito, **nessun endpoint batch** | Tipo non usabile in upload multiplo | **IG-6** ✅ | No |
| G-06 | `dichiarazione_ce`, `report_ndt` in catalogo tipi, **senza schema AI** | Import guidato non funziona | **IG-6** ✅ schema base | No |
| G-07 | `cert_ndt`: schema AI base, senza batch né commit dedicato | Solo import job manuale | **IG-6** | No |
| G-08 | OCR attivo ma non testato L3 su PDF scansionati reali | Patentini foto/scansione | Smoke post IG-3 | No |
| G-13 | Revisione ingest senza anteprima PDF affiancata | Operatore non può verificare campi vs documento | **IG-3b** ✅ anteprima split | No |
| G-09 | Feedback correzioni umane non persistito | Nessun apprendimento | **IG-4** ✅ | No |
| G-10 | Few-shot da feedback org assente | AI non migliora nel tempo | **IG-5** ✅ | No |
| G-11 | `ImportJobsPage` ha revisione; batch WPQR/qualifiche no — **due UX parallele** | Inconsistenza operatore | **IG-3** (unificare pattern) | **Sì** |
| G-12 | Migrazione DB staging (`ingest_staging` mig. 114) | Persistenza bozza revisionabile | **IG-3** ✅ | — |

**Strategia consigliata**: IG-3 verticale su **wpqr + patentino_saldatore** (tipi batch attivi), chiudendo G-02, G-03, G-11, G-12 e parte di G-01/G-04. G-05…G-10 restano in coda IG-4→IG-6.

---

### IG-3 — Revisione umana pre-commit (staging UI)

**Scope**
- Estendere `ImportJobsPage` **oppure** modale revisione su batch upload (WPQR/qualifiche)
- Mostra campi estratti con badge confidence (da pipeline)
- Azioni: **Conferma**, **Correggi e salva**, **Scarta**
- Record resta `approval_status=bozza` / `import_status=ai_draft` fino a conferma
- Migrazione DB **114**: tabella `ingest_staging` (`staged_fields_json`, `field_confidence_json`, `review_status`)

**DoD**
- [x] Operatore vede preview campi prima del commit definitivo
- [x] Scarta non crea record registry (o marca rejected)
- [x] Conferma crea record come oggi ma con dati revisionati
- [x] Smoke L3: upload → revisione → commit → record visibile in registro (API E2E + UI Deploy Preview #186, test-api, 28/06/2026)

**Stato**: ✅ PR #184 — smoke TEST OK 28/06/2026.

**Rischio**: medio-alto (UX + DB). Prerequisito IG-1/IG-2.

---

### IG-4 — Cattura feedback operatore (learning dati)

**DoD**
- [x] Ogni conferma con correzioni salva delta campo-per-campo
- [x] Ogni scarto salva motivo + payload AI per analisi
- [x] Indice per query `(organization_id, doc_type, created_at DESC)`
- [x] Test L1 record + diff

**Stato**: ✅ 28/06/2026

---

### IG-5 — Auto-apprendimento operativo (few-shot)

**DoD**
- [x] Dopo 1+ conferme stessa org, prompt include esempi (se payload completo)
- [x] Nessun dato cross-tenant (sempre `organization_id`)
- [x] Test: mock feedback → prompt contiene esempio
- [x] Documentato in GUIDA_CONSOLIDATA

**Stato**: ✅ 28/06/2026

---

### IG-6 — Estensione tipi documento (scalabilita)

**DoD**
- [x] WPS batch su pipeline + staging + UI
- [x] Schemi `dichiarazione_ce`, `report_ndt` backend
- [ ] Tabella tipi PROJECT_ROADMAP (opzionale)

**Stato**: ✅ 28/06/2026

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

**Prossima slice attiva**: nessuna — piano IG chiuso. Estensioni future: G-07 (cert_ndt batch), G-08 (OCR L3 scansioni).

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
