# Audit norme + ingest qualifiche (04/10/2026)

> Slice deputy: confronto PDF ISO 14555, qualità Markdown per interpretare certificati, mappa pipeline patentini, fattibilità JEV. **Nessun codice applicativo** (né JEV, né generatore WPS, né 783/784/785, né punto 1 piano riunione 3/10). Piano: [`PLAN_RIUNIONE_2026-10-03.md`](../agent-tasks/PLAN_RIUNIONE_2026-10-03.md).

## Gate fonti (norm-touching)

```text
Fonti Markdown:
- Coperte: ISO 9606-1 (NORMA_00018 + estratto range); ISO 9606-2 (NORMA_00032, Al); ISO 14732 (solo estratto); ISO 15614-1+A1 (NORMA_00043 + estratto); ISO 15614-2 (NORMA_00031); ISO 15609-1/-2 (NORMA_00014/00015 + estratto contenuto WPS); ISO 14555:2025 (NORMA_00033 HITL + estratto STUD-3-A/B); catalogo 4063 parziale (processi arco/gas frequenti).
- Mancanti (non bloccano questa slice): testo integrale ISO 4063 (famiglia stud 78x); NORMA_00xxx di 14732 in docs/Normative/; PDF 4063/14732 in Git (policy: PDF mai in Git).
- Si parte su: confronto PDF 14555 vs NORMA_00033 già digitalizzata; inventario; mappa ingest; decisione JEV senza vocabolario in codice.
```

## Esito ISO 14555:2025

| Voce | Esito |
|------|--------|
| Esisteva già | Sì — `docs/Normative/Normative NORMA_00033_ BS EN ISO 14555_2025 Rev. 0.md` + `.json` (`ISO_14555_2025`), 48 pagine, HITL Tabella 1/2 29/08 |
| PDF nuovo | Stessa edizione BS EN ISO 14555:2025 (1,2 MB, 48 pag.). CLI 04/10: 48/48 testo, 0 ATTENZIONE, pag. 20 pymupdf, Tabella 2 8/40 10/60 12/85 Nm |
| Azione | **Non duplicato, non sostituito.** Il re-run CLI reintroduce Tabella 1 a caratteri invertiti e spezza `10.2.8.11`. Banner qualità in testa a `NORMA_00033` |
| PDF in Git | **No** — `.gitignore` `docs/Normative/*.pdf`; come le altre UNI/ISO |
| Seed `norm_requirements` / VPS | **No** — catalogo processo/range, non SGQ 4–10; nessuna nuova edizione. HITL seed VPS non applicabile |

## Tabella norme per certificati / WPS / WPQR

| Norma | Path | Edizione | Qualità struttura | Usabile per interpretare certificati |
|-------|------|----------|-------------------|--------------------------------------|
| ISO 9606-1 | `docs/Normative/…NORMA_00018_…9606-1_2017…md/.json`; estratto `ISO-9606-1-range-validita-patentino.md`; regole `weldingQualificationRules9606.js` | EN ISO 9606-1:2017 (= ISO 2012+Cor) | Font anti-copia; tabelle 6/8/9/10 ricostruite da glifi SymbolMT (estratto). MD grezzo senza `ATTENZIONE` ma con sostituzione lettere | **Sì (parziale sul MD grezzo, sì sull’estratto+JS)** per range, transfer mode, P/T, BW/FW |
| ISO 9606-2 | `NORMA_00032` | 2004 Al | Digitalizzata; regole JS dedicate = backlog | **Parziale** — Al, non il default patentino acciaio |
| ISO 14732 | Solo `ISO-14732-operatori-saldatura.md` (OCR 28/28). Nessun `NORMA_00xxx` | 2013 | Estratto chiaro su metodi, variabili (configurazione, non spessore), 6 vs 3 anni | **Sì per tipo operatore / scadenze; no per copiare tabelle 9606** |
| ISO 15614-1 | `NORMA_00043` (operativa A1:2019); archivio `NORMA_00019`; estratto `ISO-15614-1-range-validita-WPQR.md` | 2017+A1:2019 | Tabelle 5–9 in MD; GAP colonna Level 1 Tab. 7 (manca `0,`) | **Sì/parziale** per WPQR arco acciaio. Level 1/2 è di **15614**, non di 14555 |
| ISO 15614-2 | `NORMA_00031` + estratto | 2025 Al | Presente | **Sì** per WPQR alluminio |
| ISO 14555 | `NORMA_00033` HITL + `ISO-14555-2025-range-validita-WPQR.md` + `weldingQualificationRules14555.js` | 2025 | §10.2.8 usabile; Tabella 1/2 HITL; CLI grezzo non fidato sulla matrice pag. 20 | **Sì** per WPQR stud. **Non** per patentino 9606 |
| ISO 15609-1/-2 | `NORMA_00014`/`00015`; `ISO-15609-WPS-contenuto.md` | 2019 | TOC/Annex celle fuse; clausole §4.2–4.5 ok. Non seed SGQ | **Sì/parziale** per contenuto WPS, non per range patentino |
| ISO 4063 | `ISO-4063-processi-saldatura.md` + `weldingProcesses4063.js` | estratto, edizione PDF **assente** in Normative | Elenco 111…311. **Nessun** 783/784/785 | **Parziale.** **HITL** testo ufficiale prima di famiglia stud |

Altre citate da ingest qualifiche (`documentTypeSchemas.js`): ISO 6947 (posizioni, catalogo JS), ISO/TR 15608 (gruppi), ISO 14175 (gas), ISO 13916 (temperature WPS/WPQR), ISO 14341 (filo), ISO 9712 (`cert_ndt`), ISO 14731 (coordinatore). Non ri-digitalizzate in questa slice.

## Mappa flusso ingest PDF qualifiche saldatori

1. Upload — `POST /qualifications/upload-batch` (`qualifications.routes.js`: max **50** file, 50 MB; `qualifications.controller.js` `uploadBatch`). Sincrono nella richiesta HTTP (nessuna coda job). Import PDF generico: `importJobs.controller.js` / `ImportJobsPage.jsx`.
2. Testo PDF — `documentIngestPipeline.service.js` → `importPdfText.extractPdfText` (`pdf-parse`, **tutte** le pagine, nessuna anteprima/selezione). OCR se testo corto (`ocrExtractor`). `textEncodingRepair` (font substitution, dizionario) sul testo.
3. Classificazione — `documentClassifier` + `doc_type` scelto (`patentino_saldatore` default, `qualifica_14732`, `cert_ndt`). Warning se il testo cita WPQR/15614 ma l’operatore ha già scelto il tipo qualifica.
4. Campi — regole `ruleFieldExtractors.js` + AI `importAiExtraction.service.js` con `aiExpectedSchema` / `aiPrompt` in `backend/src/data/documentTypeSchemas.js` (mirror `app/src/data/`). Prompt extra: cataloghi 4063/6947/14175 + `buildWelderQualificationRulesPromptSection` (9606). Merge pipeline + confidence; **non** c’è soglia 90%/98% numerica in revisione qualifica (etichette Alta/Media/Bassa).
5. Staging — `ingestStaging.service.js` (`QUALIFICATION_DOC_TYPES`). Revisione umana, poi commit.
6. Persistenza — `qualificationIngest.service.js`: `mapPipelineFieldsToReview` → INSERT `qualifications` (spessore **un** min/max, diametro min/max da `pipe_diameter_mm` singolo, `transfer_mode` singolo, `qualification_designation` calcolata da `weldingDesignation.js`). Whitelist + registro `reprocessableFields.js`.
7. Uso a valle — alert (`qualificationAlert.service.js`); copertura commessa / fattibilità (campi su `qualifications`, non un vocabolario JEV); WPS da WPQR (`wpsGenerator.service.js`, **fuori perimetro**). WPQR stud: pipeline welding `wpqr` + `joint_type: SW` + 14555 nel prompt WPQR.

### Dove si perde informazione vs piano 3/10

| Gap riunione | Dove si perde |
|--------------|----------------|
| Designazione vs campo di validità | Prompt 9606 chiede di non sovrascrivere il range scritto; **DB ha un solo paio** spessore e la designazione è ricalcolata al commit. Nessun campo persistente «prova vs estensione» |
| BV (depositato) ≠ FV (angolo) | Calcoli Tab. 6/8 in JS 9606; in scheda/ingest **un** `thickness_min/max` |
| T1/T2 D1/D2 collasso | WPQR ha t1/t2; **qualifica** un range spessore e un diametro. Nessun secondo D |
| 14732 senza tabelle 9606 | Tipo e prompt 14732 distinti; UI può ancora mostrare blocchi dimensionali (punto 1, non questa slice) |
| Transfer combinato | Un enum `transfer_mode`; continuità short→altri nel testo estratto 9606, **non** nel calcolo copertura |
| Timeout batch >5 PDF | Multer 50 file ma estrazione **sincrona** (AI per file) → timeout HTTP, non tetto codice «5» |
| Anteprima pagine | `pdf-parse` intero; tool `pdf_to_json` è per norme, non UI ingest |
| «Errore qualifica» | `ImportJobsPage.jsx`: badge con `title={qualifResult.error}` — diagnosi solo in tooltip, non in chiaro |
| 14555 letta come 15614 Level 2 | Prompt WPQR è **ISO 15614** + eccezione SW/14555. `qualification_level` 1\|2 è schema WPQR 15614. Un certificato stud senza `joint_type: SW` / senza citazione 14555 finisce nel binario 15614. Non è assenza della norma in libreria |

## JEV (JSON Extraction Vocabulary)

**Non esiste** nel repo (zero occorrenze `JEV` / «json extraction vocabulary»).

Già presenti, da riusare prima di un vocabolario nuovo:

- `aiExpectedSchema` + `aiPrompt` per tipo documento
- `*_MANUAL_EDITABLE_FIELDS` / `manualEditCompletenessCheck.js`
- `REPROCESSABLE_FIELD_REGISTRY` + whitelist scrittura
- Cataloghi JS (4063, 6947, 14175, 15608, 14341) + estratti `docs/reference/ISO-*.md`
- Feedback HITL `import_extraction_feedback` (analisi 03/10: niente classificatore locale ora)

**Raccomandazione (solo decisione):** non introdurre JEV in questa slice. Una fetta successiva, se serve per fattibilità commesse + WPS, è un **registro campi** allineato agli schema già esistenti (stesso `key` di `aiExpectedSchema` / colonna DB / rielaborazione), con metadati `norma`, `prova vs campo di validità`, `applica_a` (9606 \| 14732 \| 15614 \| 14555). Non un secondo schema parallelo. Prima fetta utile: tre chiavi spessore/diametro del punto 1 (validità vs designazione, BV vs FV) — **dopo** il testo e la UI del punto 1, non prima.

## Cosa questa slice non ha fatto

Punto 1 qualifiche (spessori 9606 vs 14732, BV/FV, T1/T2, scheda). Generatore WPS. Catalogo 783/784/785. Acrobat. Seed VPS. Bugbot (slice doc, draft). Merge. Implementazione JEV.

## HITL committente

1. **ISO 4063 testo ufficiale** (PDF) che elenca 783/784/785 — blocco regole stud-processo.
2. Eventuale `NORMA_00xxx` per 14732 se si vuole RAG sul testo integrale (non necessario per l’estratto operativo).
3. Diagnosi su **certificati stud già caricati** (14555 vs 15614 Level 2): serve campione PDF, non un’altra digitalizzazione 14555.
