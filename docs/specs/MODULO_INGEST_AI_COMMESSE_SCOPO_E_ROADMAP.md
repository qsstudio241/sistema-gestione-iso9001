# Modulo Ingest AI Commesse — Scopo e Roadmap

> **Tipo documento**: spec di prodotto + architettura + roadmap a slice verticali
> **Versione**: 1.0 — 2026-06-24
> **Branch di analisi**: `feat/drawing-extraction-gemini`
> **Autore**: analisi senior product + software architect (solo lettura codice, nessuna modifica al sorgente)
> **Riferimenti**: [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md), [TASK_RIESAME_ESTENSIONI_SLICES.md](../agent-tasks/TASK_RIESAME_ESTENSIONI_SLICES.md), `docs/PROJECT_ROADMAP.md`, `docs/GUIDA_CONSOLIDATA.md`
> **Norma**: ISO 9001:2015 §8.2 (riesame requisiti), ISO 3834 (riesame requisiti + riesame tecnico)

---

## Sintesi in 60 secondi (per il committente)

La tua visione è **corretta e coerente** con la direzione già presa dal codice: non hai commesso errori logici gravi. L'unico punto dove sottovaluti la realtà è che oggi **non esiste un unico flusso**: ci sono **tre moduli separati** che fanno pezzi del lavoro e **non si parlano tra loro come dovrebbero**. Inoltre l'analisi AI del capitolato (quella testuale) **oggi non viene salvata**: si vede a schermo e poi si perde. L'estrazione dai disegni invece viene salvata correttamente.

Il lavoro più efficace non è costruire un nuovo modulo, ma **armonizzare e collegare** ciò che già esiste, con una UI a fasi guidate (ingest → elaborazione → output) e un **unico modello dati "analisi di commessa"** che sopravvive dall'offerta al riesame definitivo.

---

## A. Validazione del ragionamento del committente

### A.1 Dove la visione è corretta e già supportata

| Affermazione del committente | Riscontro nel codice |
|---|---|
| "I documenti del cliente dovrebbero essere caricati massivamente" | **Esiste già**: modulo Import Job (`import_jobs` / `import_job_files`) carica fino a 30 file in batch (`importJobs.routes.js`, multer `files: 30`). |
| "L'assistente dovrebbe riconoscerne gli elementi utili" | **Esiste già in due forme**: (1) estrazione AI strutturata da testo (`importAiExtraction.service.js`, endpoint `ai-extract`); (2) estrazione AI requisiti da disegno via vision (`drawingExtraction.service.js`, Gemini `generateVision`). |
| "valutando informazioni mancanti o ambigue" | **Parziale**: l'AI restituisce `warnings`, `extraction_confidence` (import) e `confidence` + `review_status` per requisito (disegni). Manca un modello esplicito di "gap/ambiguità" legato all'offerta. |
| "Questa analisi deve essere recuperata se la commessa viene acquisita" | **Parziale**: l'estrazione disegni **è persistita** sul caso (`commercial_case_drawing_extractions`, migr. 101) e sopravvive. L'analisi AI del capitolato testuale **NON è persistita** (vedi A.3). |
| "La UI deve guidare l'utente lungo il processo" | **Direzione condivisa**: la pagina ha già slide ordinate per fase ISO §8.2 (`DETAIL_SLIDES`), ma sono **tab indipendenti**, non un percorso guidato ingest→elaborazione→output. |

### A.2 Errori logici / semplificazioni eccessive (onesto e concreto)

1. **"Un unico flusso" — in realtà sono tre moduli scollegati.**
   - **Import Job** (`/settings/import-jobs`): solo **admin** (`authorize('admin')`), licenza `ai_import`, **solo PDF** (`fileFilter` rifiuta tutto il resto con HTTP 415), e vive **fuori** dalla pagina commessa.
   - **ContractReview / commessa** (`ContractReviewPage.jsx`): licenza `ai_review`, accetta qualsiasi file (`accept="*/*"`), ma l'analisi AI lavora sul **testo incollato**, non sui file caricati.
   - **Drawing extraction**: licenza `ai_review`, lavora **solo** sugli allegati con `commercial_doc_role === 'drawing'`, in modo sincrono.
   - Conseguenza: l'utente che vuole "caricare massivamente i documenti del cliente sulla commessa" oggi deve passare dal modulo Import (admin), creare un caso da lì (`import-from-job`), e poi gestire i disegni in un'altra tab. Non è il flusso unico che immagini.

2. **L'analisi AI dell'offerta è effimera (gap rispetto alla tua visione).**
   `analyzeRequirements` (endpoint `review_requirements`) **calcola e restituisce** il risultato al browser ma **non lo salva** in nessuna tabella. Quindi la frase "questa analisi deve essere recuperata in fase di riesame definitivo" **oggi non è realizzabile** per la parte capitolato: al riaccesso il risultato è perso. È esattamente il pezzo da costruire.

3. **Sottovalutazione dell'eterogeneità dell'ingest.** "Caricare i documenti del cliente" implica:
   - **OCR su scansioni**: oggi **assente**. `importPdfText.js` legge solo lo strato testo; un PDF scansionato dà confidence bassa (25-40) e nessun OCR. I disegni-immagine funzionano solo perché passano da Gemini vision.
   - **Multi-formato**: l'import accetta **solo PDF**. Esiste già `documentTextExtractor.service.js` (nuovo) che legge PDF/DOCX/testo, ma **non è collegato** né all'import né alla commessa.
   - **Excel / distinte base (BOM)**, **CAD nativo (DWG/STEP)**: non gestiti.
   - **Classificazione automatica del tipo documento** (RFQ vs ordine vs disegno vs capitolato): oggi è un'**euristica debole** (`guessDocRoleFromAi` cerca parole chiave; `document_type_guess` dall'AI). Affidabilità non garantita.

4. **Idempotenza non uniforme.** L'`import-from-job` è idempotente (blocca il doppio caso con 409 `ALREADY_LINKED`). L'estrazione disegni **non lo è**: ogni click su "Estrai requisiti" crea un nuovo job di estrazione e duplica i requisiti. Da gestire prima di scalare.

5. **Confidence/ambiguità come dato, non come flusso.** Hai ragione che servono, ma oggi sono campi sparsi (confidence numerica, warnings testuali). Manca un **human-in-the-loop strutturato** sul capitolato (sui disegni esiste già `review_status`: extracted/confirmed/rejected/edited).

### A.3 Verdetto

**Nessun errore logico di fondo.** La visione è allineata all'architettura esistente e alle norme. I rischi reali sono di **integrazione** (unire moduli scollegati) e di **completezza** (persistere l'analisi del capitolato, gestire formati non-PDF, OCR, idempotenza), non di impostazione concettuale.

---

## B. Scopo del modulo (definizione univoca)

> **Scopo**: trasformare i **documenti di commessa del cliente** (caricati anche massivamente) in un **modello strutturato di requisiti, gap e ambiguità**, prodotto da analisi AI provider-agnostic, **persistito sul caso commerciale** così da essere **riusato** sia nel **riesame preliminare** (stesura offerta) sia nel **riesame definitivo** (post-acquisizione), guidando l'utente lungo il percorso **ingest → elaborazione → output**.

Allineamento normativo:

| Norma | Clausola | Come il modulo la serve |
|---|---|---|
| ISO 9001:2015 | §8.2.2 Determinazione dei requisiti | Ingest + estrazione AI identificano i requisiti del cliente. |
| ISO 9001:2015 | §8.2.3 Riesame dei requisiti | Checklist preliminare (P1-P10) e definitiva (F1-F6) alimentate dai requisiti estratti; gap → chiarimenti. |
| ISO 9001:2015 | §8.2.4 Modifiche ai requisiti | Confronto offerta vs ordine nel riesame finale (F1, F2). |
| ISO 3834 | Riesame dei requisiti | Materiali, processi, posizioni saldatura estratti dal disegno. |
| ISO 3834 | Riesame tecnico | Match requisiti estratti ↔ qualifiche/WPS (`qualificationCoverage.js`). |

---

## C. Mappa dello stato attuale (gap analysis)

Legenda copertura: **Assente** · **Parziale** · **Completa**

| Fase del flusso | Modulo/file esistente | Copertura | Cosa manca |
|---|---|---|---|
| **1. Ingest multi-formato** | `importJobs.controller.js` (batch, solo PDF); `contractReview.uploadCaseAttachment` (singolo, ogni formato); `documentTextExtractor.service.js` (PDF/DOCX/testo, **non collegato**) | **Parziale** | Upload batch **dentro la commessa**; supporto DOCX/XLSX/immagini nel percorso commessa; OCR scansioni; un solo punto di caricamento. |
| **2. Classificazione tipo documento** | `guessDocRoleFromAi` (parole chiave); `document_type_guess` AI; schemi `documentTypeSchemas.js` | **Parziale** | Classificazione affidabile (RFQ/ordine/disegno/capitolato/specifica); fallback a scelta umana esplicita. |
| **3a. Estrazione testo (capitolato/RFQ)** | `importAiExtraction.service.js` (`extractStructuredByDocType`) | **Parziale** | È nel modulo Import, non nella commessa; output non salvato sul caso. |
| **3b. Estrazione disegni (vision)** | `drawingExtraction.service.js` + controller + migr. 101 | **Completa (MVP)** | Idempotenza; modalità asincrona/coda; multi-pagina/multi-disegno. |
| **4. Analisi AI unificata "requisiti/gap"** | `contractReview.analyzeRequirements` (`review_requirements`); `aiContextBuilder.service` | **Parziale** | **Risultato non persistito**; non aggrega testo + disegni; nessun modello gap/ambiguità. |
| **5. Persistenza analisi sul caso** | `commercial_case_drawing_extractions` / `_extracted_requirements` (solo disegni) | **Parziale** | Persistenza dell'analisi capitolato/offerta; tabella unica "elementi estratti" riusabile. |
| **6. Riuso nel riesame preliminare (offerta)** | Checklist `PRELIMINARY_ITEMS` (P1-P10), manuale | **Parziale** | Pre-compilazione/suggerimenti checklist dai requisiti estratti; tracciare origine AI. |
| **7. Riuso nel riesame definitivo (post-ordine)** | Checklist `FINAL_ITEMS` (F1-F6); handoff (`registerHandoff`) | **Parziale** | Recupero automatico dell'analisi salvata; confronto offerta↔ordine assistito. |
| **8. Match requisiti ↔ qualifiche/WPS** | `qualificationCoverage.js` (`computeQualificationCoverage`, `computeWpsCoverageEsito`) | **Parziale** | I requisiti estratti dal disegno (material_group, thickness, welding_process, posizioni) non alimentano ancora il calcolo copertura. |

### C.1 Esiste ma è SCOLLEGATO (integrazione mancante)

- **Import Job batch ↔ pagina commessa**: l'unico ponte è `import-from-job` (crea un caso *nuovo* da un job); non si può "aggiungere documenti via batch a un caso esistente".
- **`documentTextExtractor.service.js` (PDF/DOCX/testo)**: pronto ma non usato dall'ingest commessa.
- **Estrazione disegni ↔ `qualificationCoverage.js`**: due moduli maturi che non si parlano.
- **`analyzeRequirements` ↔ persistenza**: l'analisi capitolato non finisce in nessuna tabella.

### C.2 ASSENTE (da costruire)

- Persistenza dell'analisi AI del capitolato/offerta sul caso.
- Modello dati unificato "elementi/requisiti estratti" valido per testo **e** disegni.
- OCR per scansioni; supporto XLSX/CAD.
- Pre-compilazione assistita delle checklist §8.2 dai requisiti estratti.

---

## D. Proposta architetturale armonizzata

Principio guida: **non creare nuovi silos**. Collegare e astrarre ciò che esiste.

### D.1 UI guidata a fasi (stepper) invece di tab indipendenti

Mantenere le slide attuali ma sovrapporre un **percorso a fasi** con stato calcolato dal server (gate UX, non blocco rigido), coerente con la golden rule "UI guida flusso operativo":

```
[1 Ingest] → [2 Elaborazione AI] → [3 Revisione requisiti/gap] → [4 Riesame §8.2] → [5 Esito/Handoff]
   carica       estrai testo+vision    conferma/rifiuta/modifica    checklist pre/def    offerta/ordine
   batch        classifica             (human-in-the-loop)          pre-compilata        + match qualifiche
```

- Le tab odierne (Workflow, Checklist, Chiarimenti, Documenti, Requisiti da disegno, Analisi AI) restano come **viste di dettaglio**, ma una barra di avanzamento in cima indica "dove sei" e "cosa manca".
- Riuso componenti UI esistenti (regola "blocco unico"): tabella requisiti (`ExtractedRequirementRow`), badge documenti (`CommercialDocMetaBadge`), pannelli `.cr-panel`.

### D.2 Astrazione unica "Document Analysis" (per-tipo, provider-agnostic)

Creare un servizio orchestratore (es. `caseDocumentAnalysis.service.js`) che **seleziona l'estrattore in base al tipo file**, riusando i mattoni esistenti:

| Tipo input | Estrattore riusato | Output |
|---|---|---|
| PDF testo / DOCX / TXT | `documentTextExtractor.service` → `importAiExtraction.service` (`extractStructuredByDocType`) | requisiti testuali + warnings + confidence |
| Immagine / disegno (PNG/JPG/PDF disegno) | `drawingExtraction.service` (Gemini `generateVision`) | requisiti tecnici + bbox + confidence |
| Scansione (PDF immagine) | **OCR futuro** (punto di estensione) → poi testo | come testo |
| XLSX / BOM | **parser tabellare futuro** (punto di estensione) | righe distinta |

Lo stesso pattern degli `ADAPTERS` di `drawingExtraction.service` (registrazione per nome) va replicato a livello di **tipo documento**: aggiungere un formato = registrare un estrattore, senza toccare controller/DB/UI.

> Nota tecnica: oggi `drawingExtraction` chiama **direttamente** `geminiAdapter.generateVision` (non la facade `aiProviderAdapter`). Va bene per ora, ma in prospettiva la vision andrebbe esposta dalla facade multi-provider per coerenza e degrado gestito.

### D.3 Modello dati unificato (persistenza legata al caso)

Riusare e generalizzare le tabelle già introdotte dalla migrazione 101, invece di crearne di parallele:

- **`commercial_case_drawing_extractions`** → generalizzare concettualmente in **"job di analisi documento"** (aggiungere `source = 'drawing' | 'text' | 'ocr' | 'table'`). Già ha `provider`, `status`, `raw_response`, scope `organization_id` + FK al caso.
- **`commercial_case_extracted_requirements`** → tabella requisito unico. Ha già `req_type`, `value_text`, `confidence`, `review_status` (extracted/confirmed/rejected/edited). Estendere `req_type` con valori testuali (es. `delivery`, `legal`, `commercial`, `spec`) per coprire anche il capitolato.

In questo modo **una sola struttura** raccoglie i requisiti sia da disegno sia da testo, ed è **automaticamente persistita sul caso** → sopravvive all'acquisizione e alimenta il riesame definitivo (esattamente la tua richiesta).

Per l'analisi capitolato oggi effimera: salvarne l'esito come righe in `commercial_case_extracted_requirements` (con `source='text'`) + un record sintesi nella tabella job. Naming coerente coi pattern repo (snake_case, prefisso `commercial_case_`).

### D.4 Riuso, non duplicazione (mappa esplicita)

| Capacità | Riusare | Non fare |
|---|---|---|
| Upload batch | pipeline multer/`uploadFiles` di Import Job | nuovo storage allegati |
| Estrazione testo | `documentTextExtractor` + `importAiExtraction` | nuovo parser PDF |
| Estrazione vision | `drawingExtraction.service` | seconda integrazione AI |
| Analisi requisiti offerta | `aiContextBuilder` + `analyzeRequirements` | nuovo motore prompt |
| Persistenza | tabelle migr. 101 generalizzate | nuove tabelle parallele |
| Match tecnico | `qualificationCoverage.js` | nuovo algoritmo match |
| Licenza | `ai_review` (già usata da commessa+disegni) | nuova licenza |

### D.5 Formati: ora e dopo

- **Ora**: PDF (testo), DOCX, TXT, immagini/PDF disegno (vision).
- **Fasi successive (punti di estensione puliti)**: OCR scansioni, XLSX/BOM, CAD (DWG/STEP via provider tipo werk24 — già previsto come adapter futuro in `drawingExtraction.service`).

---

## E. Roadmap a slice verticali

Stile repo: diagnosi → fix minimo → test L1 → deploy → commit/PR. Ordinate per **valore/sforzo decrescente**. Una slice alla volta.

| # | Slice | Obiettivo verificabile | File/moduli | Dipende da | Rischio | Valore demo |
|---|---|---|---|---|---|---|
| **1** | **Fix UX: selettore ruolo nell'upload** | Nel form "Carica allegato caso" appare il select ruolo (incl. **Disegno**), così l'allegato caricato arriva con `commercial_doc_role` corretto e compare nel pannello disegni | `app/src/pages/ContractReviewPage.jsx` (~righe 1335-1352) | nessuna | **Basso** (1 file, no DB) | Alto: sblocca il flusso disegni senza passare dal "Collega da registro" |
| **2** | **Persistere l'analisi capitolato** | `analyzeRequirements` salva l'esito sul caso (job + requisiti `source='text'`); al riapri il risultato è ancora lì | `contractReview.controller.js`, migr. estensione 101 (colonna `source`) | nessuna | Medio | Alto: realizza la tua frase "recuperata nel riesame definitivo" |
| **3** | **Idempotenza estrazione disegni** | Ri-cliccare "Estrai" non duplica requisiti (riusa job esistente o sostituisce) | `drawingExtraction.controller.js` | nessuna | Basso | Medio: robustezza demo |
| **4** | **Ingest batch dentro la commessa** | Caricare N file (anche non-PDF) direttamente nella tab Documenti del caso, con classificazione ruolo | `contractReview.controller.js` (upload multiplo), riuso `documentTextExtractor` | slice 1 | Medio | Alto: il "carica massivamente" della tua visione |
| **5** | **Analisi AI unificata su tutti i documenti** | ✅ `caseDocumentAnalysis.service.js`, `POST /cases/:caseId/analyze-documents`, pulsante tab Documenti | nuovo `caseDocumentAnalysis.service.js` (orchestratore), riuso estrattori | slice 2, 4 | **Alto** (epica) | Molto alto: cuore della visione |
| **6** | **Pre-compilazione checklist §8.2** | ✅ Pannello suggerimenti + apply preliminare/finale con `[AI doc]` | `ContractReviewPage.jsx`, test Vitest | slice 5 | Medio | Alto: chiude il ciclo offerta→riesame |
| **7** | **Match requisiti ↔ qualifiche/WPS** | ✅ `extractedRequirementsProfile.js` + `GET extracted-coverage` + CoveragePanel | `qualificationCoverage.js` (riuso), `caseExtractedCoverage.service.js` | slice 5 | Medio | Alto: riesame tecnico ISO 3834 |
| **8** | **OCR scansioni (estensione)** | PDF scansionati passano per OCR e diventano testo analizzabile | nuovo adapter OCR dietro `caseDocumentAnalysis` | slice 5 | Alto | Medio: copre casi reali ma non urgente |

**Quick win a basso rischio (1-2 file, no logica sync/DB pesante)**: slice **1** e **3**.
**Epiche maggiori**: slice **5** (orchestratore) e **8** (OCR).

Sequenza consigliata: **1 → 2 → 3** (fondamenta robuste e demo rapida) → **4 → 5** (cuore) → **6 → 7** (valore ISO) → **8** (estensione).

---

## Strategia di sviluppo: test → produzione + architettura AI orchestrata a fasi

Questa sezione formalizza **come** sviluppare e rilasciare il modulo (processo) e **in che ordine** costruire l'intelligenza AI (architettura), evitando over-engineering. È trasversale a tutte le slice della sezione E.

### Workflow test → smoke → produzione (conferma e formalizzazione)

È già la prassi consolidata del repository, qui resa esplicita e vincolante per ogni slice del modulo:

| Anello della catena | Dettaglio operativo |
|---|---|
| **DB di test** | `2026-06-18_SGQ_ISO9001` (istanza separata dalla produzione): tutte le migrazioni e gli smoke vengono provati qui **prima** del DB prod. |
| **Backend di test (VPS)** | `https://www.fr-busato.it:8443/test-api`: ambiente isolato per smoke con dati realistici e `GEMINI_API_KEY` già configurata. |
| **CI smoke automatica** | GitHub Actions esegue lo smoke su ogni PR che tocca `backend/**` (vedi `.github/workflows/smoke-test.yml`); blocca la PR se rosso. |
| **Branch protection** | `main` protetto: niente push diretto, merge solo via PR con check verdi. |
| **Deploy con verifica PID** | `backend/scripts/deploy-to-vps.sh` riavvia il servizio e **verifica il cambio di `MainPID`** (se invariato, il processo non si è riavviato → forza il restart). |

**Piramide test (vincolante)** — l'ordine riflette costo crescente e fragilità crescente:

| Livello | Cosa | Quando | Ruolo |
|---|---|---|---|
| **L1 — unit** | Jest (backend) / Vitest (frontend): veloci, deterministici | ad **ogni** PR | **base primaria** della qualità |
| **L2 — smoke DB in CI** | migrazione idempotente + query reali su DB test | ad ogni PR backend | **base primaria** (insieme a L1) |
| **L3/L4 — smoke MCP** | login reale + UI (es. Playwright) sui percorsi critici | conferma finale pre-release | **conferma**, NON unico cancello (fragile su selettori/costi) |

> **Regola d'oro**: lo smoke MCP/UI **conferma** i percorsi critici ma **non sostituisce** L1+L2. Affidarsi solo allo smoke UI come cancello di qualità è un anti-pattern (selettori fragili, costi AI, falsi rossi).

**"Test positivi → produzione" NON è automatico.** La transizione richiede passi espliciti e ordinati:

1. Migrazione applicata **separatamente** al DB di produzione (script `run-migration-NNN-vps.js` via SSH/`run-on-vps.ps1`).
2. Deploy dei file backend modificati sul VPS.
3. Restart del servizio **con verifica PID** (`deploy-to-vps.sh`).
4. **Smoke post-deploy** su API reali (health + endpoint critici del modulo).
5. Solo allora il rilascio è completo: aggiornare `GUIDA_CONSOLIDATA.md`.

**Prerequisito per uno smoke AI significativo**: dati di prova realistici (commesse, capitolati, disegni) + `GEMINI_API_KEY` sul backend test (già presente). Senza input realistici, lo smoke dell'estrazione AI non dimostra nulla.

### Architettura AI orchestrata — a fasi (anti over-engineering)

**Distinzione fondamentale** (da non confondere mai):

| | (A) Sub-agenti di sviluppo Cursor | (B) AI dentro l'app SGQ |
|---|---|---|
| **Cosa** | Agenti che scrivono/rivedono codice durante lo sviluppo | Funzioni AI che assistono l'utente finale (estrazione requisiti, analisi capitolato, suggerimenti checklist) |
| **Conta per il prodotto?** | No (strumento di sviluppo) | **Sì**: è ciò che l'utente usa | 

Tutto ciò che segue riguarda **(B)**, l'AI nel prodotto.

**Sequenza corretta di costruzione**: prima le **capacità specializzate** + la **persistenza dei dati**, POI il **layer di orchestrazione**.

> Un orchestratore senza capacità sottostanti e senza dati persistiti **non ha nulla da orchestrare**. Costruirlo per primo è l'errore architetturale più comune e costoso.

**"Autoapprendimento" → riformulato come "miglioramento guidato dal feedback + RAG"**, NON training di modelli. Il training proprietario è caro, rischioso e ingiustificato in questa fase. Gli strumenti per migliorare nel tempo **esistono già nel repo**:

| Strumento di miglioramento | Tabella/meccanismo nel repo | Uso |
|---|---|---|
| **Feedback umano** | `ai_feedback`, `review_status` (confirmed/edited/rejected) | costruire **few-shot curati** dagli esempi confermati/corretti dall'utente |
| **RAG** | `knowledge_chunks` + embeddings Gemini | recupero di contesto pertinente al momento dell'analisi, senza ri-addestrare |
| **Osservabilità / costi** | `ai_usage_log` | monitorare token, costi, tassi di errore per provider/step |
| **Confidence + human-in-the-loop** | `confidence` + `review_status` per requisito | nessun output AI "confermato" senza azione umana |

**Orchestratore v1 = router DETERMINISTICO**, non un LLM che decide. Sceglie lo specialista in base a **tipo documento / step**, riusa la facade `aiProviderAdapter` con **prompt specializzati per step** e **output JSON strutturato**. L'orchestratore LLM "vero" (un LLM che sceglie autonomamente gli specialisti) arriva **solo** in fase successiva, e solo se le fasi precedenti reggono.

### Roadmap a fasi (mappata sulle slice della sezione E)

| Fase | Obiettivo | Slice sez. E coinvolte | Rischio | Quando |
|---|---|---|---|---|
| **FASE 0** | Workflow test → prod formalizzato (questa sezione) | — (processo trasversale) | Basso | **Ora** |
| **FASE 1 — Fondazione** | Fix UX upload + persistenza analisi + idempotenza estrazione | **#1** (selettore ruolo), **#2** (persisti analisi capitolato), **#3** (idempotenza estrazione disegni) | Basso/Medio | Ora |
| **FASE 2 — Estrazione unificata** | Estrazione testo+vision per tipo documento (un estrattore per formato) | **#4** (ingest batch), **#5** parziale (estrattori) | Medio/Alto | Dopo FASE 1 |
| **FASE 3 — Router deterministico** | Router per tipo doc/step + prompt specializzati + output JSON | **#5** (orchestratore deterministico) | Alto | Dopo FASE 2 |
| **FASE 4 — Feedback loop + RAG** | Few-shot da `ai_feedback`/`review_status` + RAG `knowledge_chunks` | **#6** (pre-compilazione checklist), **#7** (match qualifiche) | Medio | Dopo FASE 3 |
| **FASE 5 — Orchestratore LLM** | LLM che sceglie gli specialisti (solo se FASE 1-4 reggono) | estensione di #5 + #8 (OCR) | Alto | Solo se giustificato |

### Errori logici da evitare (checklist anti-pattern)

1. **Orchestratore prima delle capacità** — costruire il layer di coordinamento prima degli estrattori specializzati e della persistenza dati. L'orchestratore non avrebbe nulla da orchestrare.
2. **"Autoapprendimento" inteso come training di modelli** — caro, rischioso e ingiustificato ora. Il miglioramento si ottiene con feedback umano curato (few-shot) + RAG, non ri-addestrando modelli.
3. **Smoke MCP/UI come unico cancello di qualità** — fragile su selettori e costoso. È la **conferma finale**, non la base: la base resta L1 (unit) + L2 (smoke DB in CI).

---

## F. Rischi e vincoli

| Area | Rischio | Mitigazione |
|---|---|---|
| **Multi-tenant** | Query senza scope org | Tutte le tabelle hanno `organization_id`; lo scope passa sempre dal `commercial_cases` (pattern già rispettato in `drawingExtraction.controller`). Mantenere. |
| **Idempotenza** | Doppia estrazione → requisiti duplicati | Slice 3: riuso/sostituzione job; vincolo logico "un'analisi attiva per documento". |
| **Costi AI / token** | Batch su molti file = chiamate costose | Rate limit (già presente `aiExtractLimiter`), troncamento input (`MAX_INPUT_CHARS=20000`), analisi on-demand (pulsante), non automatica all'upload. |
| **Privacy dati cliente** | Documenti riservati inviati al provider AI | Documentare nel consenso modulo; preferire provider/azure self-hosted dove richiesto (facade `aiProviderAdapter` già multi-provider); non loggare contenuti sensibili in chiaro. |
| **Confidence bassa / ambiguità** | Estrazioni errate accettate ciecamente | **Human-in-the-loop obbligatorio**: `review_status` già esiste sui disegni; estenderlo al testo. Nessun requisito "confermato" senza azione umana prima di alimentare le checklist. |
| **Degrado gestito** | AI non configurata | Già gestito: `AI_NOT_CONFIGURED` → 503 leggibile; il modulo resta usabile in modalità manuale. Mantenere su ogni nuovo percorso. |
| **OCR/CAD** | Aspettativa di "legge tutto" | Comunicare chiaramente i formati supportati per fase; punto di estensione pulito evita refactoring. |

---

## Allegato — Riferimenti file chiave (per sviluppo)

- Ingest batch: `backend/src/controllers/importJobs.controller.js`, `backend/src/routes/importJobs.routes.js` (solo PDF, admin, `ai_import`)
- Estrazione testo: `backend/src/utils/importPdfText.js`, `backend/src/services/importAiExtraction.service.js`, `backend/src/services/documentTextExtractor.service.js` (PDF/DOCX/testo, da collegare)
- Estrazione disegni: `backend/src/services/drawingExtraction.service.js`, `backend/src/controllers/drawingExtraction.controller.js` (migr. 101)
- Commessa: `backend/src/controllers/contractReview.controller.js` (`analyzeRequirements` non persistito, `importFromJob`, `uploadCaseAttachment`), `app/src/pages/ContractReviewPage.jsx`
- Match tecnico: `backend/src/utils/qualificationCoverage.js`
- AI provider: `backend/src/services/aiProviderAdapter.js` (facade), `backend/src/services/adapters/geminiAdapter.js` (`chat`, `generateVision`, `embed`)
- Link import↔caso: migr. `070_import_job_case_link.sql`
