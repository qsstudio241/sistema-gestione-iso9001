# Piano slice — Valutazione commesse (capacità + output studio)

> **Destinazione**: lo studio di consulenza, dopo ingestione/catalogazione dei documenti del cliente su un caso commerciale collegato all’**azienda appaltatrice** (capacità), ottiene un **report di gap analysis persistito e leggibile** (requisiti cliente × capacità azienda). Offerta/chiarimenti, riesame post-acquisizione, ordini fornitori e PPAP restano fuori dalla priorità assoluta finché il report gap non è usabile.
>
> **Modello di business (HITL 01/09/2026)**: studio = destinatario dell’output; azienda appaltatrice = soggetto delle capacità (`company_id` sul caso). Non confondere con SAL (gap implementazione SGQ clausola-per-clausola).
>
> **Spec / ADR collegati (riuso, non riscrivere)**:
> - [`MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](../specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) — ingest/analisi documento ↔ caso
> - [`MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md`](../specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) — workflow `commercial_cases`
> - SAL gap ≠ questo epic: [`MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md)
> - Mattoni già in codice: `importJobs` + `ImportJobsPage`, `contractReview.*`, `caseDocumentAnalysis.service.js`, `caseExtractedCoverage.service.js`, `caseCoverageAdvisory.service.js`, `qualificationCoverage.js`, CoveragePanel in `ContractReviewPage.jsx`
>
> **Brief attivo**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — **VC-2** (CHIUSO — TEST OK); prossima **VC-3**
> **Mappa creata**: 01/09/2026 · Lead wayfinder (solo Chart the map — nessuna implementazione in questa sessione)
> **Branch base**: `main`

---

## Si può fare?

**Sì, a slice verticali sottili.** Gran parte dell’ingest, dell’estrazione e della copertura saldatori/WPS/WPQR **esiste già** ed è scollegata da un **artefatto report per lo studio**. Non si ricostruisce un secondo SAL né un secondo Import PDF: si collega e si chiude il percorso **catalogo docs cliente → gap capacità → output studio**.

### Inventario fondazione (già su `main` — non rifare)

| Capacità | Dove | Nota |
|----------|------|------|
| Batch PDF import | `importJobs` / `ImportJobsPage` | Licenza `ai_import`; ponte `import-from-job` → caso |
| Allegati su caso + ruolo | `uploadCaseAttachment`, UI multi-file in `ContractReviewPage` | Catalogazione ruolo (`commercial_doc_role`) |
| Analisi docs unificata | `caseDocumentAnalysis.service.js` + `POST .../analyze-documents` | Disegno + testo capitolato/ordine |
| Persistenza requisiti | mig. 101/116, `commercial_case_extracted_requirements` | HITL `review_status` |
| Copertura capacità (live) | `caseExtractedCoverage` + advisory WPQR/visione + CoveragePanel | **Vista live**, non report persistito per studio |
| Azienda capacità sul caso | campo UI «Azienda SGQ (capacità)» / `company_id` | Allinea al modello studio→azienda |

---

## Fuori scope

- Riscrivere SAL / `gapAnalysis.service.js` (implementazione SGQ §4–10)
- Secondo motore OCR / seconda pipeline ingest (riuso `documentTextExtractor` / `documentIngestPipeline` / Import Jobs)
- Material Compliance / PPAP come primo obiettivo (PPAP = nebbia)
- Auth/JWT/sync ADR-008, breaking schema
- Context 1M; implementazione di più slice nella stessa sessione
- Nuova licenza dedicata finché non serve (riuso `ai_review` / `ai_import`)
- Offerta economica completa, penali/LD, export control (mini-spec già fuori pilota)
- Modulo Commesse ISO 3834 (`ProjectsPage`) come silo parallelo del report studio

---

## Non ancora specificato

- Formato export definitivo del report studio (Word vs PDF vs solo in-app) — default VC-1 = **in-app + snapshot JSON persistito**; export = slice successiva dopo HITL leggero se serve
- Estensione gap oltre stack saldatura/NDT già in advisory (macchinari, verniciatura, trattamenti, …) — solo dopo MVP saldatura stabile
- Sessione **PPAP**: nel ciclo `commercial_cases` vs modulo dedicato
- Ordini verso fornitori post-acquisizione: riuso `commercial_case_documents` + `supplier_id` vs nuovo workflow
- Quanto dell’offerta «in prima battuta» è generazione testo assistita vs solo checklist/chiarimenti già nel workflow

---

## Decisioni già prese (Lead 01/09/2026, da codice + HITL prodotto)

- Priorità assoluta = **ingest/catalog docs cliente + gap vs capacità azienda appaltatrice + output per lo studio**
- Riuso obbligatorio: pattern Import PDF + SAL (motore gap/evidenze) **dove scalabili**, senza fondere i moduli
- MVP capacità = stack già calcolabile (requisiti estratti × qualifiche/WPS/WPQR advisory / visione) sull’`company_id` del caso
- Report studio = **artefatto persistito** sul caso (non solo CoveragePanel live)
- Offerta/chiarimenti, riesame completo post-ordine, ordini fornitori, PPAP = **dopo** VC-1…VC-3 (o restano nebbia se non formulabili)
- Prima slice = hello world end-to-end più piccolo: **snapshot report** da dati già presenti, senza nuovo ingest engine

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **VC-1** | Hello world: report gap capacità persistito + UI minima studio | BE: service aggregatore (riuso `caseExtractedCoverage` / `caseCoverageAdvisory`) + endpoint GET/POST su caso + mig. additiva nullable (snapshot JSON o tabella sottile); FE: pannello «Report studio» in `ContractReviewPage` (DNA esistente); test L1 | — | AFK ✅ CHIUSO |
| **VC-2** | Catalogazione docs cliente sul caso (ruoli + lista catalogo) | FE/BE: rafforzare elenco allegati per ruolo/tipo, gate «analizza» solo su catalogati; riuso upload multi + Import→caso; niente nuovo storage | VC-1 consigliato (report legge catalogo) | AFK ✅ CHIUSO |
| **VC-3** | Pipeline catalogo → analisi → refresh report (un click studio) | Orchestrazione sottile: dopo `analyze-documents` (o conferma requisiti) aggiorna snapshot report; test L1 | VC-1, VC-2 | AFK |
| **VC-4** | Export report studio (Word o PDF) | Export da snapshot; riuso pattern Word NC/SAL dove possibile | VC-1; HITL formato se non deciso | HITL→AFK |
| **VC-5** | Chiarimenti da gap report → workflow `CLARIFICATION` | Collega gap a `commercial_case_clarifications` esistenti; UI minima | VC-1 | AFK |
| **VC-6** | Offerta in prima battuta (bozza assistita) | Solo se prodotto chiarisce perimetro; altrimenti resta nebbia | VC-5 | HITL |
| **VC-7** | Riesame completo post-acquisizione (riuso analisi) | Checklist finale F* + confronto ordine↔offerta↔capacità da snapshot | VC-1, VC-3 | AFK (dopo stabilizzazione) |
| **VC-8** | Ordini fornitori a corredo | Documenti `counterparty=supplier` + link anagrafica | VC-7; dettagli in nebbia | HITL |
| **VC-9** | Sessione PPAP | Solo dopo decisione prodotto (in-ciclo vs modulo) | — | HITL / nebbia |

**Stato piano:** APERTO — **VC-1** e **VC-2** eseguite (TEST OK); prossime VC-3…

### Dipendenze e parallelo futuro

```text
VC-1 → VC-2 → VC-3 → VC-4
              ↘ VC-5 → VC-6 (HITL)
VC-3 → VC-7 → VC-8 (HITL)
VC-9 indipendente / nebbia
```

File disgiunti se parallelo: VC-4 (export) può partire dopo VC-1 su file export dedicati; **non** parallelizzare due deputy su `ContractReviewPage.jsx` / `contractReview.controller.js` senza spezzare componenti.

### Riuso esplicito

| Pattern | Dove riusare |
|---------|----------------|
| Import batch PDF | `importJobs` + `import-from-job` / upload multi caso |
| Motore gap / evidenze (idea SAL) | Snapshot stato + note; **non** tabella `requirement_implementation_status` |
| Coverage tecnico | `qualificationCoverage` / `caseExtractedCoverage` / advisory |
| UI | `ContractReviewPage` / pannelli `.cr-*` — niente look nuovo |

---

## Bozza aggiornamento roadmap (dopo merge di questa PR docs)

Sotto «Sessione più recente»: wayfinder Valutazione commesse — creato `PLAN_VALUTAZIONE_COMMESSE_SLICES.md`; brief VC-1 APERTO; nessuna implementazione applicativa nella sessione di mappa.
