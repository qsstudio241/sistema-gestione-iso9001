# Piano slice — SAL AI evidenze (OCR + documento mancante)

> **Destinazione**: il suggeritore SAL AI (Fase 5-A/5-B) legge anche PDF scansionati e immagini (OCR riusabile), e quando manca evidenza per una clausola propone tipo documento tipico + candidati dal registro e chiede all’utente se collegare/caricare — **mai** auto-collegamento senza conferma (HITL).
> **Spec / ADR**: [`MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §C.1/C.2 · [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) (human-in-the-loop)
> **Epic chiusa** (29/08/2026): S1a [#471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471) · S1b [#603](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/603) · S2a [#605](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/605) · **S2b** UI HITL. Stream [`DEPUTYTASK_SAL_AI.md`](DEPUTYTASK_SAL_AI.md) **CHIUSO**. **S1c** (`.doc`) solo su richiesta. **Non** usare `DEPUTYTASK.md` (altro slot).
> **Mappa creata**: 15/08/2026 (Lead wayfinder A — Chart the map; nessuna implementazione in questa sessione)

---

## Fuori scope

- Scrittura automatica di `evidence_document_ids` o dello stato SAL senza conferma utente
- Motore giuridico che «certifica» un documento conforme a legge/norma (già escluso in §C.1)
- Riscrittura della pipeline ingest (`documentIngestPipeline`) — lì OCR PDF è già attivo
- Dashboard KPI / editor catalogo tipi documento
- OCR cloud a pagamento obbligatorio (preferire stack già in repo: `tesseract.js` + `pdf2pic`)
- Conversione batch massiva di tutto lo storico registro

---

## Non ancora specificato (nebbia)

- Mapping **clausola → tipo documento tipico**: deciso in S2a — euristica statica piccola (`5.2` manuale, `7.5`/`8.4` procedura, `9.3`/`10.2` modulo) + fallback `altro`; non prompt AI. Ibrido solo se S2b mostra troppi miss.
- Supporto **`.doc` legacy** (Word binario): mammoth non lo legge; LibreOffice headless sul VPS vs «non supportato + messaggio chiaro» — prodotto/HITL se emerge domanda reale
- Soglia qualità OCR (caratteri minimi / confidence) per alzare la confidenza SAL da `low` a `medium`
- Estendere lo stesso «documento mancante» al suggeritore welding 3834 (`weldingAiSuggest`) — solo dopo S2b stabile su SAL
- Quota pagine OCR / timeout per PDF molto lunghi oltre il `maxPages` già usato in ingest

---

## Decisioni già prese (stato attuale + lezioni 5-A/5-B)

- **Fase 5-A ✅**: `salAiSuggest.service.js` propone stato + confidenza + motivazione; UI `SalAiSuggestDialog` conferma/modifica/scarta; nessuna scrittura automatica
- **Fase 5-B ✅**: conformità legislativa su `linked_legislation` + `normBroker.getClauseText`; capability `SAL_LEGAL_CONFORMITY`
- **Solo evidenze già collegate**: `loadEvidenceDocuments` legge `evidence_document_ids`; se lista vuota → `confidence: low` + messaggio «Collega i documenti…»; se testo non estraibile → messaggio su PDF immagine / formato non supportato
- **Estrattore SAL**: `documentTextExtractor.service.js` supporta PDF testo, DOCX, `text/*`; **S1a**: PDF vuoto/sotto soglia ingest → `extractTextWithOCR`; fallimento → `ocr_unavailable` / `ocr_failed`. **S1b**: PNG/JPEG/WebP → `extractTextFromImageBuffer` (Tesseract sul buffer); stesso fallback reason; GIF/.doc restano `unsupported_format`
- **OCR PDF riusato da SAL (S1a)**: `ocrExtractor.js` (`pdf2pic` + `tesseract.js`) è agganciato sia a ingest sia a `documentTextExtractor`; prerequisiti VPS: Ghostscript + GraphicsMagick/ImageMagick
- **UI evidenze**: `SalEvidenceSection.jsx` elenca/collega dal registro (`apiService.getDocuments`); link «Apri registro» / «Aggiungi nel registro». **S2b**: dal dialog AI, se `missingEvidenceSuggestion` è oggetto → tipo tipico + candidati + Collega / Carica nel registro / Ignora (HITL)
- **Tipi documento**: catalogo FE `app/src/data/documentTypes.js` (`procedura`, `istruzione`, `manuale`, …) — riuso per etichette, non inventare nuovi `doc_type` senza seed
- **Isolamento multi-tenant**: ogni scan registro resta scoped `organization_id` + `company_id` (stesso pattern di `salAiSuggest`)

---

## Gap vs funzione attesa

| Aspetto | Oggi | Atteso | Slice |
|---------|------|--------|-------|
| PDF scansionato (no text layer) | **S1a fatto** — OCR via `ocrExtractor`; `ocr_unavailable` / `ocr_failed` se motore assente | Fatto | **S1a** |
| Immagini (PNG/JPEG/WebP) allegate al doc | **S1b fatto** — OCR via `extractTextFromImageBuffer`; `ocr_unavailable` / `ocr_failed` se Tesseract assente/fallisce | Fatto | **S1b** |
| Formato `.doc` legacy | `unsupported_format` | Decisione prodotto (nebbia); almeno messaggio UX chiaro | Nebbia / eventuale **S1c** |
| Clausola senza evidenze | **S2a fatto** — `missingEvidenceSuggestion` su `gap-ai-suggest` (no write) | Fatto | **S2a** |
| Conferma utente su candidati | **S2b fatto** — collega / carica registro / ignora; PATCH solo su Collega | Fatto | **S2b** |
| Auto-link AI | Vietato (e assente) | Resta vietato | — (vincolo) |

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **S1a** | OCR PDF in estrattore riusabile | `documentTextExtractor.service.js` (+ test): se PDF senza testo → `extractTextWithOCR`; aggiornare `isExtractable`; **non** toccare UI SAL | — | AFK |
| **S1b** | OCR immagini | Stesso service (+ test): PNG/JPEG/WebP → Tesseract su buffer; `reason` dedicati; degradation se tesseract fallisce | S1a (stesso file — **non** parallelizzare) | AFK |
| **S1c** | `.doc` (opzionale) | Solo se nebbia chiarita HITL: convert/skip esplicito; altrimenti saltare | S1b + HITL | HITL |
| **S2a** | Backend «documento mancante» | Estensione `salAiSuggest` (o helper dedicato): euristica tipo atteso + query registro scoped; payload `missingEvidenceSuggestion` senza scrivere FK | S1a consigliata (testo più utile), non bloccante | AFK |
| **S2b** | UI proposta collega / carica / ignora | `SalAiSuggestDialog` + riuso `SalEvidenceSection` / upload registro esistente; conferma esplicita prima di PATCH evidenze | S2a | AFK |

**Ordine**: S1a → S1b → (S1c se deciso) → S2a → S2b.  
**Parallelo**: S1a/S1b/S2a/S2b chiusi. Residuo solo **S1c** (HITL, su richiesta).

---

## Dettaglio slice

### S1a — OCR PDF nell’estrattore riusabile

**Obiettivo verificabile**: un PDF senza text layer, passato a `extractDocumentText`, restituisce testo OCR quando `ocrExtractor` e prerequisiti VPS sono ok; altrimenti `text: null` + `reason` stabile (es. `ocr_unavailable` / `ocr_failed`) senza crash.

**DoD**

- [x] Su `pdf_no_text_layer` (o testo sotto soglia allineata a ingest), chiamata a `extractTextWithOCR`
- [x] Test L1: mock OCR ok / OCR throw / motore assente — pipeline non esplode
- [x] `isExtractable` resta vero per PDF (già lo è); commenti header aggiornati (UTF-8, accenti)
- [x] Nessuna modifica a controller/routes/UI in questa slice
- [x] `salAiSuggest` beneficia automaticamente (usa già l’estrattore) — smoke mentale: messaggio «PDF immagine» non deve più apparire se OCR ha prodotto testo

**Cosa NON toccare**: `SalAiSuggestDialog`, `SalEvidenceSection`, migrazioni, ingest pipeline (già OCR-aware).

---

### S1b — OCR immagini

**Obiettivo verificabile**: allegato `image/png` o `image/jpeg` produce testo via Tesseract; graceful degradation.

**DoD**

- [x] Ramo immagini in `documentTextExtractor` (riuso worker Tesseract; evitare duplicare tutta la pipeline PDF se possibile — helper sottile o export da `ocrExtractor`)
- [x] Test L1 con buffer minima / mock
- [x] `isExtractable` true per immagini raster supportate

**Cosa NON toccare**: UI; `.doc`; S2.

---

### S2a — Backend suggest missing evidence

**Obiettivo verificabile**: per clausola senza `evidence_document_ids` (o con coverage `missing`), la risposta suggest include proposta strutturata (tipo tipico + lista candidati registro) **senza** mutare DB.

**DoD**

- [x] Contratto JSON documentato nel brief (campi stabili per FE)
- [x] Query registro scoped org+azienda; limite risultati
- [x] Test L1 service
- [x] HITL: nessun UPDATE a `requirement_implementation_status`

---

### S2b — UI HITL collega / carica / ignora

**Obiettivo verificabile**: dal dialog AI l’utente può collegare un candidato, aprire flusso carica nel registro, o ignorare; solo dopo conferma le evidenze si aggiornano (pattern esistente PATCH gap/SAL).

**DoD**

- [x] Riuso DNA/`SalEvidenceSection` / link registro — gate Ponytail
- [x] Test Vitest mirato dialog
- [x] Disclaimer AI invariato (`AiDisclaimer` se già presente)

---

## Note per il deputy

1. Allinea Git (`fetch`/`pull` `origin/main`) prima del brief.
2. Una sessione = una slice; se non chiudi → handoff in `DEPUTYTASK.md`.
3. Livello Medio (backend service): PR + Bugbot prima di dichiarare pronta; deploy VPS se si tocca service in `deploy-manifest` (verificare se l’estrattore è già listato).
4. Encoding UTF-8, accenti italiani corretti.
