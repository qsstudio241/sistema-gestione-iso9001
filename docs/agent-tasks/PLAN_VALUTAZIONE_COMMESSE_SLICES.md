# Piano slice — Valutazione commesse (capacità + output studio)

> **Destinazione**: lo studio di consulenza, dopo ingestione/catalogazione dei documenti del cliente su un caso commerciale collegato all’**azienda appaltatrice** (capacità), ottiene un **report di gap analysis persistito e leggibile** (requisiti cliente × capacità azienda). Offerta/chiarimenti, riesame post-acquisizione, ordini fornitori e PPAP restano fuori dalla priorità assoluta finché il report gap non è usabile **e** finché la mole file cliente non è gestibile in modo evadibile.
>
> **Modello di business (HITL 01/09/2026)**: studio = destinatario dell’output; azienda appaltatrice = soggetto delle capacità (`company_id` sul caso). Non confondere con SAL (gap implementazione SGQ clausola-per-clausola).
>
> **Spec / ADR collegati (riuso, non riscrivere)**:
> - [`MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](../specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) — ingest/analisi documento ↔ caso
> - [`MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md`](../specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) — workflow `commercial_cases`
> - SAL gap ≠ questo epic: [`MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md)
> - Mattoni già in codice: `importJobs` + `ImportJobsPage`, `contractReview.*`, `caseDocumentAnalysis.service.js`, `caseExtractedCoverage.service.js`, `caseCoverageAdvisory.service.js`, `qualificationCoverage.js`, CoveragePanel in `ContractReviewPage.jsx`, export Word checklist (`wordExportContractReviewChecklist.js`)
>
> **Brief attivo**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — **ING-3** CHIUSO (segnale evadibilità). Prossima: ING-5 solo wayfinder / ponte gap.
> **Mappa creata**: 01/09/2026 · Lead wayfinder · **riorientata 02/09/2026** post-merge VC-4 (priorità ingest)
> **Branch base**: `main`

---

## Si può fare?

**Sì, a slice verticali sottili.** Gran parte dell’ingest, dell’estrazione e della copertura saldatori/WPS/WPQR **esiste già** ed è scollegata da un **artefatto report per lo studio**. Non si ricostruisce un secondo SAL né un secondo Import PDF: si collega e si chiude il percorso **catalogo docs cliente → gap capacità → output studio**, con priorità successiva sulla **mole di file disordinati**.

### Inventario fondazione (già su `main` — non rifare)

| Capacità | Dove | Nota |
|----------|------|------|
| Batch PDF import | `importJobs` / `ImportJobsPage` | Licenza `ai_import`; ponte `import-from-job` → caso |
| Allegati su caso + ruolo | `uploadCaseAttachment`, UI multi-file in `ContractReviewPage` | Catalogazione ruolo (`commercial_doc_role`) — VC-2 |
| Analisi docs unificata | `caseDocumentAnalysis.service.js` + `POST .../analyze-documents` | Disegno + testo capitolato/ordine |
| Persistenza requisiti | mig. 101/116, `commercial_case_extracted_requirements` | HITL `review_status` |
| Copertura capacità (live) | `caseExtractedCoverage` + advisory WPQR/visione + CoveragePanel | **Vista live**, non report persistito per studio |
| Report studio (snapshot) | capability-gap-report + pannello Report studio | VC-1…VC-3 |
| Export checklist Word | `wordExportContractReviewChecklist.js` + bottone Checklist | VC-4 HITL B |
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
- **Aprire VC-5 (chiarimenti) o implementare ingest senza conferma Lead** — vietato in questa sessione docs

---

## Non ancora specificato (HITL)

- Estensione gap oltre stack saldatura/NDT già in advisory (macchinari, verniciatura, trattamenti, …) — solo dopo MVP saldatura stabile
- Sessione **PPAP**: nel ciclo `commercial_cases` vs modulo dedicato
- Ordini verso fornitori post-acquisizione: riuso `commercial_case_documents` + `supplier_id` vs nuovo workflow
- Quanto dell’offerta «in prima battuta» è generazione testo assistita vs solo checklist/chiarimenti già nel workflow
- **Template checklist personalizzabile** dallo studio (per cliente): schema dati, scope tenant, UX
- Confini esatti della **costellazione agenti** (quali agenti, quali tool, quale orchestrazione) — solo mappa slice sottili, non monolite

---

## Decisioni già prese (Lead 01/09/2026 + HITL prodotto 02/09/2026)

- **Priorità assoluta post VC-4 (HITL 02/09)**: ingestione / organizzazione / elaborazione di **mole di file cliente disordinati** → capire se l’ordine è **evadibile**. Poi checklist personalizzabile studio; poi ponte gap→checklist/chiarimenti; poi costellazione agenti (wayfinder).
- Priorità MVP report = ingest/catalog docs cliente + gap vs capacità azienda appaltatrice + output per lo studio — **VC-1…VC-4 CHIUSE**
- Riuso obbligatorio: pattern Import PDF + SAL (motore gap/evidenze) **dove scalabili**, senza fondere i moduli
- MVP capacità = stack già calcolabile (requisiti estratti × qualifiche/WPS/WPQR advisory / visione) sull’`company_id` del caso
- Report studio = **artefatto persistito** sul caso (non solo CoveragePanel live)
- **VC-4 (HITL 02/09) = opzione B**: export Word della **checklist Riesame requisiti** (P1–P10 / F1–F6, esiti + note). Gap capacità = appendice sintetica opzionale. **NON** è Riesame di direzione. Fedeltà: voci = checklist caso (§8.2 driver verbale); non inventare voci. Mergiata **PR #622**.
- WIP `cursor/vc4-export-report-studio-1c5d` (solo gap) **superseduto**
- Offerta/chiarimenti (VC-5+), riesame completo post-ordine, ordini fornitori, PPAP = **dopo** priorità ingest **oppure** in parallelo **solo** se file disgiunti e non rubano priorità ingest
- Prima slice = hello world end-to-end più piccolo: **snapshot report** da dati già presenti — fatta (VC-1)

---

## Priorità successive (HITL 02/09 — ordine prodotto)

| # | Tema | Note | Tipo |
|---|------|------|------|
| **1** | **Ingestione / organizzazione / elaborazione mole file cliente disordinati** | Capire se l’ordine è **evadibile**; riuso Import PDF + catalogo VC-2; bozza slice ING-* sotto | AFK/HITL |
| **2** | Checklist **personalizzabile** dallo studio (template per cliente) | Slice dedicata; non mischiare con export VC-4 | HITL + AFK |
| **3** | Ponte gap capacità → checklist / chiarimenti | Include ex VC-5 se confermato Lead; dopo o parallelo file-disgiunti | AFK |
| **4** | Costellazione **agenti specializzati** a supporto | Wayfinder: mappa slice sottili, **non** un monolite; mattoni Import PDF / triage | HITL / wayfinder |

**VC-5** (chiarimenti) e **VC-6…VC-9** restano nella mappa sotto ma **non** sono la prossima priorità di default. **Non** aprire `DEPUTYTASK` APERTO su VC-5 senza conferma Lead.

---

## Mappa slice (VC — report / checklist / post-MVP)

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **VC-1** | Hello world: report gap capacità persistito + UI minima studio | BE: service aggregatore + endpoint + mig. additiva; FE: pannello Report studio; test L1 | — | AFK ✅ CHIUSO (#619) |
| **VC-2** | Catalogazione docs cliente sul caso (ruoli + lista catalogo) | FE/BE: elenco allegati per ruolo, gate Analizza; riuso upload/Import→caso | VC-1 | AFK ✅ CHIUSO (#620) |
| **VC-3** | Pipeline catalogo → analisi → refresh report | Orchestrazione sottile post `analyze-documents`; test L1 | VC-1, VC-2 | AFK ✅ CHIUSO (#621) |
| **VC-4** | Export Word checklist Riesame requisiti (HITL B) | FE Word da `commercial_case_checklist`; appendice gap opzionale | VC-1…VC-3 | AFK ✅ CHIUSO (#622) |
| **VC-5** | Chiarimenti da gap report → workflow `CLARIFICATION` | Collega gap a `commercial_case_clarifications`; UI minima | VC-1; **dopo ingest o parallelo file-disgiunti** | AFK — **non aprire brief senza Lead** |
| **VC-6** | Offerta in prima battuta (bozza assistita) | Solo se prodotto chiarisce perimetro; altrimenti resta nebbia | VC-5 | HITL |
| **VC-7** | Riesame completo post-acquisizione (riuso analisi) | Checklist finale F* + confronto ordine↔offerta↔capacità | VC-1, VC-3 | AFK (dopo stabilizzazione) |
| **VC-8** | Ordini fornitori a corredo | Documenti `counterparty=supplier` + link anagrafica | VC-7; nebbia | HITL |
| **VC-9** | Sessione PPAP | Solo dopo decisione prodotto | — | HITL / nebbia |

**Stato piano:** APERTO — **VC-1…VC-4** CHIUSI; **ING-1…ING-4** CHIUSI (ING-3 in chiusura su questa PR); prossima **ING-5** solo con wayfinder (non monolite); VC-5 non di default.

### Bozza slice ingest / organizzazione (post VC-4 — da confermare Lead)

> Numerazione **ING-*** separata da VC-* per non mischiare report MVP e mole file. Una slice = una sessione.

| Slice | Tema | Perimetro suggerito | Dipende da | Tipo |
|-------|------|---------------------|------------|------|
| **ING-1** ✅ | Classificazione / riordino allegati in batch | Riuso catalogo VC-2 + euristiche nome (pattern Import PDF); HITL conferma; niente secondo storage | Import PDF / VC-2 | CHIUSO 02/09 |
| **ING-2** ✅ | Matching docs → ruoli catalogo caso | Auto-proposta `commercial_doc_role` da nome/cartella/MIME + confidence; gate Analizza (estende VC-2/ING-1) | ING-1 | CHIUSO 02/09 |
| **ING-3** ✅ | Gap **evadibilità** da docs organizzati | Dato catalogo ordinato: segnale «ordine evadibile / da chiarire» (riuso coverage + checklist); non inventare norme | ING-2, VC-1 | CHIUSO 02/09 |
| **ING-4** | Template checklist personalizzabile studio | Template per cliente/tenant; voci P/F editabili; export VC-4 legge template attivo | HITL prodotto | HITL + AFK |
| **ING-5** | Agente «triage documenti» (se mattoni Import PDF) | Slice sottile: classifica + coda HITL; **non** monolite multi-agente | ING-1…2; wayfinder agenti | HITL / wayfinder |

### Dipendenze e parallelo futuro

```text
VC-1 → VC-2 → VC-3 → VC-4 ✅
                    ↘ priorità prodotto: ING-1 → ING-2 → ING-3
                                      ↘ ING-4 (checklist template)
                                      ↘ ING-5 / costellazione agenti (wayfinder)
VC-5 → VC-6 (HITL)  — dopo ING o parallelo solo file-disgiunti
VC-3 → VC-7 → VC-8 (HITL)
VC-9 indipendente / nebbia
```

File disgiunti se parallelo: VC-5 (chiarimenti) può procedere su layer clarifications **solo** se non contende `ContractReviewPage.jsx` / ingest con ING-*; **non** parallelizzare due deputy sulla stessa pagina senza spezzare componenti.

### Riuso esplicito

| Pattern | Dove riusare |
|---------|----------------|
| Import batch PDF | `importJobs` + `import-from-job` / upload multi caso |
| Motore gap / evidenze (idea SAL) | Snapshot stato + note; **non** tabella `requirement_implementation_status` |
| Coverage tecnico | `qualificationCoverage` / `caseExtractedCoverage` / advisory |
| UI | `ContractReviewPage` / pannelli `.cr-*` — niente look nuovo |
| Export Word | `wordExportContractReviewChecklist` / SAL / NC — programmatico `docx` FE |

---

## Bozza aggiornamento roadmap (questa PR docs)

Sotto «Sessione più recente»: post-merge VC-4 (#622); priorità prodotto riorientata su ingest mole file (ING-*); VC-5 non aperto senza Lead.
