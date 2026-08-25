# Riferimento — Fonti normative e mapping moduli e mapping moduli e mapping moduli

## Catalogo `docs/Normative/`

| File | standard_code (import) | Standard | Note |
|------|------------------------|----------|------|
| `UNI EN ISO 9001_2015 Rev. 0.md` | ISO_9001_2015 | ISO 9001:2015 | Checklist ? in produzione |
| `Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md` | ISO_14001_2015 | ISO 14001:2015 | Checklist ? (53 domande) |
| `Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md` | ISO_45001_2018 | ISO 45001:2018 | Checklist ? backlog |
| `Normative NORMA_00005_ UNI EN ISO 3834-1_2021 Rev. 0.md` | ISO_3834_1_2021 | ISO 3834-1 | Criteri scelta livello |
| `Normative NORMA_00009_ UNI EN ISO 3834-3_2021 Rev. 0.md` | ISO_3834_3_2021 | ISO 3834-3 | Livello intermedio |
| `Normative NORMA_00008_ UNI EN ISO 3834-5_2021 Rev. 0.md` | ISO_3834_5_2021 | ISO 3834-5 | Documenti e record |
| `Normative NORMA_00029_ UNI EN ISO 3834-2_2021 Rev. 0.md` (+ `.json`) | ISO_3834_2_2021 | ISO 3834-2 | Livello completo — **edizione 2021** (ISO EN; digitalizzata 25/08/2026). Archivio storico: `NORMA_00010` 2006 |
| `Normative NORMA_00030_ UNI EN ISO 3834-4_2021 Rev. 0.md` (+ `.json`) | ISO_3834_4_2021 | ISO 3834-4 | Livello elementare — **edizione 2021** (ISO EN; digitalizzata 25/08/2026). Archivio storico: `NORMA_00011` 2006 |
| `Normative NORMA_00012_ UNI EN ISO 14175_2008 Rev. 0.md` | ISO_14175_2008 | ISO 14175:2008 | **Supporto 3834** — classificazione gas di protezione. **Non** in `import-norms` (non è SGQ a clausole). Catalogo ingest: `docs/reference/ISO-14175-gas-protezione.md` + `shieldingGases14175.js` (RC-3) |
| `Normative NORMA_00013_ UNI EN ISO 13916_2025 Rev. 0.md` | ISO_13916_2025 | ISO 13916:2025 | **Supporto 3834** — misura temperature preriscaldo/interpass/mantenimento (Tp/Ti/Tm). **Non** in `import-norms`. Estratto: `docs/reference/ISO-13916-temperature-saldatura.md` + `weldingTemperatures13916.js` (RC-9, solo prompt) |
| `Normative NORMA_00014_ UNI EN ISO 15609-1_2019 Rev. 0.md` | ISO_15609_1_2019 | ISO 15609-1:2019 | **Supporto 3834** — contenuto WPS saldatura ad arco. **Non** in `import-norms`. Estratto: `docs/reference/ISO-15609-WPS-contenuto.md` (RC-10) |
| `Normative NORMA_00015_ UNI EN ISO 15609-2_2019 Rev. 0.md` | ISO_15609_2_2019 | ISO 15609-2:2019 | **Supporto 3834** — contenuto WPS saldatura a gas. **Non** in `import-norms`. Stesso estratto RC-10 (sezione Parte 2) |
| `Normative NORMA_00016_ UNI EN ISO 14341_2020 Rev. 0.md` | ISO_14341_2020 | ISO 14341:2020 | **Supporto 3834** — classificazione fili-elettrodo / depositi GMAW acciai non legati e a grano fine. **Non** in `import-norms`. Estratto: `docs/reference/ISO-14341-consumabili-filo.md` + `fillerWire14341.js` (RC-11, solo prompt) |
| `Normative NORMA_00018_ UNI EN ISO 9606-1_2017 Rev. 0.md` (+ `.json`) | — (non seed SGQ) | ISO 9606-1:2017 | Qualifiche saldatori — estratto range in `docs/reference/ISO-9606-1-range-validita-patentino.md` |
| `Normative NORMA_00019_ UNI EN ISO 15614-1_2017 Rev. 0.md` (+ `.json`) | — (non seed SGQ) | ISO 15614-1:2017 | WPQR / range — estratto `docs/reference/ISO-15614-1-range-validita-WPQR.md` |
| `Normative NORMA_00020`…`00028` (+ MTC) | — (non seed SGQ) | EN 10168 / 10204 / 10025-2 / 10210-1 / 10219-1 / … | Material Compliance — inventario [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../../../docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md) |

**Backlog lacune (richieste PDF / non digitalizzate)**: [`docs/reference/NORME_MANCANTI_BACKLOG.md`](../../../docs/reference/NORME_MANCANTI_BACKLOG.md) — fonte unica; non duplicare qui le sole righe «mancante».

**Nota versione 3834-2/-4**: dal 25/08/2026 le parti **-2** e **-4** sono in repo in edizione **2021** (`NORMA_00029` / `00030`, testo ISO inglese). I file `NORMA_00010` / `00011` (2006) restano solo archivio. Per gap analysis/RDP citare **ISO 3834-x:2021**.

**Norme di supporto 3834 (cataloghi/misura/contenuto WPS, non seed `norm_requirements`)**: ISO 14175 (gas), ISO 13916 (temperature), ISO 15609-1/-2 (contenuto WPS), ISO 14341 (fili GMAW / `filler_material`), ISO 4063 (processi), ISO 6947 (posizioni), ISO/TR 15608 (gruppi materiale) — vedi `docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md`.

Script import: `backend/scripts/import-norms-from-markdown.js` (solo i file SGQ 9001/14001/45001/3834-* sopra; **non** 14175, 13916, 15609 né 14341).

## Catalogo `Quaderni/`

**Formato**: testo `.txt` (conversione da PDF; suffisso `_ocred` dove applicabile). I PDF originali restano **archivio opzionale** fuori dal flusso operativo della skill — in workspace attuale sono assenti, solo `.txt`.

| File | Standard / modulo | Ruolo operativo | Clausole / tema |
|------|-------------------|-----------------|-----------------|
| `Linea Guida Conforma 9001_2015.txt` | ISO 9001, audit | Evidenze audit 9001 (gold standard ADR-002) | 4–10, per sottopunto |
| `Quaderni Qualità 2-Fattori del contesto e parti interessate_ocred.txt` | ISO 9001 | Contesto, parti interessate | 4.1, 4.2 |
| `Quaderni Qualità 3-Risk based thinking_ocred.txt` | ISO 9001 | Risk-based thinking | 6.1 |
| `Quaderni Qualità 4-Approccio per processi_ocred.txt` | ISO 9001 | Approccio per processi | 4.4 |
| `Quaderni qualità 5-Audit_ocred.txt` | Audit (trasversale) | Metodologia audit interno | Trasversale audit |
| `Quaderno_6 Linee guida UNI EN ISO 14001.txt` | ISO 14001, audit | Linea guida applicativa 14001:2015, evidenze attese | 4–10 (14001) |
| `Quaderno_10_LG_37001_Conforma_UNI.txt` | ISO 37001 | Sistemi anti-corruzione; correlazione MOG 231 / ISO 9001 | Non modulo app (contesto normativo esteso) |
| `Quaderno11_Direttiva Atex.txt` | Direttiva 2014/34/UE (ATEX) | Guida pratica sicurezza ATEX (notifiche, abilitazioni) | Non modulo app (sicurezza prodotti/esplosivi) |
| `Quaderno_9_LG_Iperammortamento_072017.txt` | Contesto fiscale | Iperammortamento Industria 4.0 (L. 232/2016, beni Allegato A/B) | Non modulo app |
| `Regolamento Accredia 4722_RG_01rev_03.txt` | Accredia / certificazione | RG-01 — accredito organismi certificazione e ispezione | Contesto audit terza parte / accredito |
| `Quaderno_2_Linea_Guida_1090.txt` | **File vuoto (0 byte)** | Conversione fallita — da rigenerare | Vedi backlog `NORME_MANCANTI` |

**Nota duplicati**: `Quaderno_2_Linea_Guida_1090.txt` **non è** il duplicato di `Quaderni Qualità 2-...` (contesto/parti interessate): il nome suggerisce una Linea Guida distinta (riferimento «1090»); contenuto non verificabile finché il file resta vuoto.

**Qualità OCR/conversione**: possibili errori di battitura (es. rumore in testa su `Quaderno_6`); incrociare sempre con testo normativo ufficiale in `docs/Normative/`.

## Scenari prodotto (PROJECT_ROADMAP)

| # | Scenario | Persona | Standard | Output |
|---|----------|---------|----------|--------|
| 1 | Audit di sistema | Camellini | 9001 / 14001 / 45001 | Report + checklist C/NC/NA |
| 2 | Audit terza parte | Camellini | Norme committente | Report audit |
| 3 | SAL documentale | Camellini | 9001 / 14001 / 45001 | Tracker Discusso/In corso/Completato |
| 4 | Rapporto di Prova | Mason | 3834 (+ spec. cliente) | RDP con misure e foto |

Template fuori Normative:
- SAL: `Check List Audit/CLIENTE - SAL documentale iso 14001 - 9001 - 45001.docx`
- RDP: `Check List Audit/RDP_MSN-260127-01_REV_0.docx`

## Mapping modulo → clausole ? file codice

### Audit (Scenario 1)

| Area | Clausole (9001) | File principali |
|------|-----------------|-----------------|
| Checklist ISO | 4–10 | `ChecklistModule.jsx`, `QuestionCard.jsx`, seed/migration checklist |
| Checklist custom | Variabile | `CustomChecklistAuditView.jsx` |
| Esito / metriche | 9.3, 10 | `AuditOutcomeSection.jsx`, `metricsCalculator.js` |
| Pendenze / re-audit | 10.2 collegato | `PendingIssuesCascade.jsx`, `AuditSelector.jsx` |
| Chiusura | — | `AuditClosePanel.jsx` |
| Export Word | clauseRef, norm_excerpt | `wordExport.js`, `ExportPanel.jsx` |
| Sync | — | `StorageContext.jsx`, `syncService.js`, ADR-008 |

Brief gap funzionali: `docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md` (G1–G9).

Allineamento normativo checklist: `docs/adr/ADR-002-checklist-alignment-strategy.md`.

### NC organizzativo (`/nc`)

| Area | Clausole | File / doc |
|------|----------|------------|
| Registro NC | 10.2 (9001); equivalenti 14001/45001 | route `/nc`, drawer ISO 10.2 |
| Workflow CAPA | 10.2 | componenti NC module |
| Collegamento audit | 10.2 | —Registra — nel modulo NC (S-A6) |

Doc: `docs/how-to/MANUALE_UTENTE_NC.md`, sezione NC in `GUIDA_CONSOLIDATA.md`.

### Registro documenti / norme SoT

| Area | Clausole | Riferimenti |
|------|----------|-------------|
| Controllo documenti | 7.5 | REG-NORM-SOT R1–R7, ADR-011 |
| Riesame requisiti | 8.2 | ADR-010, Sprint 11 |
| Import norme | — | `import-norms-from-markdown.js`, `norm_requirements` |

### SAL (backlog — Scenario 3)

| Area | Stato | Riferimenti |
|------|-------|-------------|
| document_type `sal` | ? | Roadmap Fase 0.B |
| UI tracker colori per standard | ? | Template SAL in Check List Audit |
| Word export SAL | ? | Roadmap |

### RDP / 3834 (backlog — Scenario 4)

| Area | Clausole 3834 | Stato |
|------|---------------|-------|
| 3834-1 livello | 3834-1 | Norma in repo (2021) |
| 3834-3 intermedio | 3834-3 | Norma in repo (2021) |
| 3834-5 documenti | 3834-5 | Norma in repo (2021) |
| 3834-2 completo | 3834-2 | Norma in repo (**edizione 2021**, `NORMA_00029`) |
| 3834-4 elementare | 3834-4 | Norma in repo (**edizione 2021**, `NORMA_00030`) |
| Gas protezione (supporto) | ISO 14175:2008 | MD+JSON in Normative (NORMA_00012); catalogo RC-3 `shielding_gas` |
| Temperature saldatura (supporto) | ISO 13916:2025 | MD+JSON (NORMA_00013); estratto RC-9 `preheat_temp` / `interpass_temp` |
| Contenuto WPS arco/gas (supporto) | ISO 15609-1/-2:2019 | MD+JSON (NORMA_00014/00015); estratto RC-10 `ISO-15609-WPS-contenuto.md` |
| Modulo RDP + foto | Template cliente | ? backlog |

### CND / NDT

| Area | Fonte | Stato |
|------|-------|-------|
| Qualifica operatori | ISO 9712 | Estratto `ISO_9712_2022_NDT_QUALIFICATION.md`; **testo integrale** in [`NORME_MANCANTI_BACKLOG`](../../../docs/reference/NORME_MANCANTI_BACKLOG.md) |
| Verbali / gate ispettore | PLAN_CND | CND-2 = gate 9712 + visione |
| Strumenti | ADR-016 | Anagrafica `EquipmentPage` |

### Conformità legislativa

| Area | Fonte | Stato |
|------|-------|-------|
| D.Lgs. 81/2008, 152/2006 | `legislation_seed` / Normattiva | Seed piattaforma presente |
| Profilo azienda | ADR-018 | Campi A/B; obblighi settoriali oltre 81/152 = backlog |

## Confronto quantitativo 9001 (ADR-002)

| Fonte | Granularit— tipica |
|-------|-------------------|
| Conforma 9001 | ~47 punti auditabili (4–10) |
| Frontend legacy | 26 domande hardcoded |
| Backend seed v3 | 78 domande |
| Obiettivo ADR-002 | Allineare a Conforma + testo UNI |

Usare questi numeri come sanity check in gap analysis audit 9001.

## ADR e task collegati

| Documento | Uso in gap analysis |
|-----------|---------------------|
| ADR-002 | Strategia checklist vs norma/Conforma |
| ADR-009 | Multi-standard, document_type |
| ADR-010 | AI, NormBroker, norm_requirements |
| ADR-011 | Registro norme SoT |
| TASK_AI_0B | Schema norm_requirements |
| TASK_AI_0D | Migrazione import norme |
