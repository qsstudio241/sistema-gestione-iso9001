# Piano slice — ISO 3834 completo e affidabile

> **Destinazione**: ogni processo della ISO 3834-2/-3 (adattato al livello 2/3/4 in anagrafica) ha un percorso verificabile: dati + ponte con gli altri moduli + import/export o report. I gap residui sono solo HITL o fuori scope.
> **Spec / ADR**: [ISO 3834-3:2021](../Normative/Normative%20NORMA_00009_%20UNI%20EN%20ISO%203834-3_2021%20Rev.%200.md) §5–18 · [ISO 3834-5:2021](../Normative/Normative%20NORMA_00008_%20UNI%20EN%20ISO%203834-5_2021%20Rev.%200.md) · [ADR-016](../adr/ADR-016-welding-book-e-modulo-strumenti.md) · [WPS](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md)
> **Gap di partenza**: [GAP_RDP_3834_2026-08-06.md](../gap-reports/GAP_RDP_3834_2026-08-06.md) (Mason, 06/08) · aggiornamento processi [GAP_RDP_3834_2026-08-15.md](../gap-reports/GAP_RDP_3834_2026-08-15.md)
> **Brief**: [DEPUTYTASK1.md](DEPUTYTASK1.md) — slice **ISO-7** **CHIUSO** (PR [#474](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/474)). ISO-4 Word **non** è «manca il file»: i due Word Mason sono in [`docs/reference/mason-rdp/`](../reference/mason-rdp/) e mostrano che RDP in Audit e RDP in Saldatura sono **due prodotti diversi**. Analisi: [`GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md`](../gap-reports/GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md). HITL prima di qualsiasi export.
> **Non confondere**: [DEPUTYTASK.md](DEPUTYTASK.md) è **CHIUSO** (SAL S1a, PR #471). Non sovrascriverlo. Non toccare `DEPUTYTASK_MC_INGEST.md`.

## Fuori scope

- Material Compliance EN 10204 3.1 (consumabili / materiali base «completi») — epic già mappata in [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md)
- SAL documentale Camellini (9001/14001/45001) — piano distinto [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)
- Sostituire in repo le edizioni 2006 di ISO 3834-2/-4 con le 2021 (limite documentale: PDF non reperito)
- Scheduler automatico rielaborazione ingest (decisione di costo già chiusa)
- Destinatario alert qualifiche in anagrafica (modulo Notifiche, non 3834)
- Nuovo motore offline/sync per RDP/NDT/Welding Book (restano server-first)

## Non ancora specificato

- Registro **subfornitura saldatura** dedicato (ISO-11): oggi solo checkbox + cliente commessa — da aprire solo se un cliente lo chiede in campo
- Il file Word Mason `RDP_MSN-260127-01` **è in git** ([`docs/reference/mason-rdp/`](../reference/mason-rdp/)). Non è il template del modulo `/saldatura/rdp`: è una **check list visita ispettiva** già (quasi) nello standard Audit **ISO 3834-2**. Secondo file `RDP_MSN-260223-01` = resoconto avanzamento + foto, prodotto diverso. Vedi [gap 19/08](../gap-reports/GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md).
- **Norme certificati 3.1**: consegnate 16/08/2026 (EN 10204, EN 10168, ISO 10474/404/6929 + facsimile). Soglie lamiere EN 10025-2:2019 in [`EN-10025-2-acciai-strutturali.md`](../reference/EN-10025-2-acciai-strutturali.md). Inventario fonti (dichiarare, poi partire): [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md).

## Decisioni già prese

### HITL committente 16/08/2026

- **§5.3 — niente blocco**: la commessa si può aprire anche con checklist incompleta. ISO-2 = solo tracciabilità (data/utente che ha completato) + export Word della checklist. Il banner di avviso resta.
- **Word RDP**: **HITL 19/08** — i due verbali Mason non sono un unico template. Non copiare 27/01 su `RDPModule`. Vedi [gap due documenti](../gap-reports/GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md).
- **Livello 2/3/4**: obiettivo = **vedere meno schermate** al livello più semplice. **Partiamo senza filtri** (stesse schermate per tutti; etichetta 2/3/4 in anagrafica). I filtri per livello si aggiungono dopo, non in ISO-1*.
- **Consumabili / certificati materiali / PWHT**: **non** un CRUD 3834. Epic **Material Compliance**: scan → ingest (riuso qualifiche/WPQR) → regole → HITL. **UI MVP**: tab/elenco con **DDT** + griglia (colonne in [PLAN MC](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § Griglia) — **base e apporto nella stessa lista** (`material_role`). ISO-12 esce da questo piano.

### Da codice + gap 06/08 (invariate)

- Generazione WPS da WPQR **P0–P5** (matcher 15614 + Word Annex A) — in attesa feedback Mason, non di altro sviluppo
- Livello ISO 3834 (2/3/4) in `companies.iso3834_level` (mig. 129) + guida criteri §5 in scheda azienda
- Checklist riesame tecnico 17 punti su `projects.technical_review_checklist` (mig. 128) — **gate soft**
- Qualifiche 9606/14732/14731/9712 + idoneità visiva + ingest AI + alert scadenze
- Export Word audit ISO 3834 (`ISO3834-audit-report.docx`) e verbali VT (`VT-verbale.docx`)
- Welding Book = IOF di fabbricazione, non verbale di accettazione (ADR-016); foto cordone + Word = Fase 2–3
- Ingest WPS PDF è **legacy**; il flusso primario è «Genera WPS» da WPQR
- `company_access` è il pattern RBAC da replicare (`projects.controller.js`, Qualifiche) — non `user.company_id`

## Copertura per processo (ISO 3834-3:2021)

La norma non è una checklist a sezioni 4–10: è un **sistema di processi**. Completo = ogni riga ha dati + ponte + prova esportabile (o N/A esplicito).

| § | Processo | Modulo app oggi | Ponte | Import | Export / report | Stato | Gap |
|---|---------|-----------------|-------|--------|-----------------|-------|-----|
| 5 | Riesame requisiti e riesame tecnico | Commesse (`ProjectsPage`) + Riesame contratto (`ContractReviewPage`) | **Due flussi paralleli**, nessuna FK `case_id`/`project_id` | Persistenza analisi capitolato (mig. 116) + chiavi 10204/apporto (ISO-3); checklist §5.3 con timbro | Word checklist §5.3 (ISO-2) | Parziale | ISO-8 ponte offerta |
| 6 | Subfornitura | Voce checklist §5.3 + controparti (`end_customer_id`) | Cliente commessa ↔ `company_counterparties` | — | — | Parziale | Nessun registro subfornitori di **saldatura** (chi salda fuori, con quali WPS/qualifiche) |
| 7 | Personale di saldatura | Qualifiche 9606/14732/14731 | Warning su commessa; copertura WPS | Ingest AI + batch | N/A (norma chiede registro, non un Word dedicato) | Implementato | Report riepilogo per audit cliente = P2 |
| 8 | Personale ispezioni/prove | Qualifiche `cert_ndt` + idoneità visiva | NDT consuma la qualifica a monte | Ingest `cert_ndt` | N/A | Implementato | Collegare operatore firmatario del verbale CND alla qualifica 9712 (oggi implicito) |
| 9 | Attrezzature | `EquipmentPage` + junction Welding Book | WB ↔ `equipment_assets` | — | — | Parziale | RBAC `company_access` assente; `user.company_id` inesistente |
| 10 | Saldatura e attività connesse | WPS/WPQR + dashboard coordinatore | WPS↔WPQR↔commessa (P5 advisory) | Ingest WPQR; WPS legacy | Word WPS Annex A | Implementato | Tabella 7 Level 1 incompleta (P2); feedback Mason |
| 11 | Consumabili (immagazzinamento) | — | Epic Material Compliance | Ingest da riusare (qualifiche/WPQR) | — | Assente | Fuori da questo piano — [PLAN MC](PLAN_MATERIAL_COMPLIANCE_SLICES.md) |
| 12 | Materiali base (immagazzinamento) | — | Epic Material Compliance | Certificati 3.1 (spesso scan) | — | Assente | Come §11 |
| 13 | Trattamento termico dopo saldatura | Solo voce checklist §5.3 | Epic MC (evoluzione, dopo 3.1) | — | — | Assente | Non aprire un registro PWHT in 3834 |
| 14 | Ispezioni e prove | RDP + verbali NDT | `project_id` opzionale (ISO-7, mig. 155) | N/A (compilazione + foto) | VT Word **sì**; RDP Word **no** | Parziale | ISO-4 Word da verbale Mason |
| 15 | Non conformità e azioni correttive | Modulo NC (ISO 9001 §10.2) | `project_id` opzionale (ISO-6, mig. 153) | — | Export PDF NC assente (P2, non 3834) | Parziale | Welding Book resta scollegato |
| 16 | Taratura e convalida | `equipment_calibrations` + scadenzario | Attrezzature ↔ Scadenzari (ADR-013) | — | — | Implementato | Stesso buco RBAC di §9 |
| 17 | Identificazione e rintracciabilità | Welding Book (IOF) | WB ↔ commessa / WPS / attrezzature | — | Word **non fatto** (ADR-016 Fase 2–3) | Parziale | Export Word WB + foto cordone |
| 18 | Registrazioni della qualità | Registro documenti + export audit 3834 | Tipi `wps`/`wpqr`/`report_ndt`/`rdp` nel registro | Ingest verso registro | Word audit 3834 **sì** | Parziale | RDP/WB non entrano nel registro come prova firmabile |

**Livello azienda** (`iso3834_level` 2/3/4): etichetta in anagrafica. **Ora** stesse schermate per tutti; **dopo** filtri per nascondere processi non richiesti dal livello (obiettivo: meno schermate). ISO-10 può mostrare il livello senza filtrare.

## Ponti tra moduli (cosa manca per «sistema», non «pagine»)

```
Anagrafica (livello 2/3/4)
    → Commesse (riesame §5.3, saldatori, WPS)
        ↔ Riesame contratto / capitolato AI     [NESSUNA FK]
        ↔ Qualifiche (warning scadenza/copertura)
        ↔ WPS/WPQR (generazione + advisory P5)
        ↔ Welding Book (project_id opzionale)
        ↔ RDP / NDT                            [project_id opzionale — ISO-7]
        ↔ NC                                   [project_id opzionale — ISO-6]
        ↔ Controparti (cliente / subfornitura) [solo end_customer]
Attrezzature ↔ Welding Book (junction) + Scadenzari (taratura)
Qualifiche 9712 ↔ verbali NDT                  [implicito, non vincolato]
Registro documenti ← ingest WPS/WPQR/qualifiche; RDP/WB ancora fuori
```

## Import / export — mappa unica

| Oggetto | Import oggi | Export / report oggi | Prossima slice |
|---------|-------------|----------------------|----------------|
| Patentini / NDT / coordinatori | Ingest AI + batch | — | P2: Word riepilogo qualifiche per audit |
| WPQR | Ingest AI (pipeline matura) | — | P2 Tabella 7 Level 1 |
| WPS | Genera da WPQR; PDF legacy | Word Annex A 15609-1 | Feedback Mason |
| Commessa / §5.3 | Checklist + timbro + Word (ISO-2). Capitolato: persistenza mig. 116 + chiavi 10204/apporto (ISO-3) | — | ISO-4 Word RDP Mason |
| RDP | Manuale + foto | **Assente** (e il Word Mason 27/01 appartiene all’Audit ISO 3834-2, non a questo modulo) | HITL [gap 19/08](../gap-reports/GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md) |
| Verbali NDT | Manuale + foto | Word VT | — |
| Welding Book | Manuale | **Assente** (hint in UI: Fase 2–3) | ISO-5 |
| Audit ISO 3834 | Checklist audit | Word `ISO3834-audit-report.docx` (test L1) | — |
| Dashboard coordinatore | Aggrega API esistenti | Nessun export | ISO-10 |

## Mappa slice

Ogni slice è un **tracer verticale** (un processo o un ponte), non «tutto il DB poi tutte le API».

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **ISO-1a** | RBAC `company_access` su RDP | `rdp.controller.js` + test L1; pattern Qualifiche / `companyAccess.service.js` | — | Fatto (PR #438) |
| **ISO-1b** | RBAC su verbali NDT | `ndtReports.controller.js` + test | ISO-1a (stesso pattern) | Fatto (PR #439) |
| **ISO-1c** | RBAC su Attrezzature | `equipment.controller.js`: togliere `buildScopeCondition` / `user.company_id` | ISO-1a | Fatto (PR #441) |
| **ISO-1d** | RBAC su Welding Book | `weldingBooks.controller.js` | ISO-1a | Fatto (PR #442) |
| **ISO-2** | Riesame §5.3: data/utente + Word (niente blocco) | `projects.controller.js`, `ProjectsPage.jsx`, mini-export Word | — | Fatto (PR #443) |
| **ISO-3** | Chiavi certificato nel prompt capitolato | `caseTextAnalysis.service.js` + `aiContextBuilder.service.js` | norme 16/08 | Fatto |
| **ISO-4** | Export Word visita Mason | **non** `rdp-mason-report.docx` su RDPModule senza HITL. Check list 27/01 = Audit ISO 3834-2; resoconto 23/02 = altro tipo | file in `docs/reference/mason-rdp/` | HITL |
| **ISO-5** | Export Word Welding Book + foto cordone | `WeldingBooksPage.jsx`, `wordExport` (pattern VT/WPS), allegati | ADR-016 Fase 2–3 | AFK |
| **ISO-6** | Ponte NC ↔ commessa | `nc.controller.js` + `NCPage` / drawer: `project_id` opzionale | — | Fatto (PR #465) |
| **ISO-7** | Ponte RDP/NDT ↔ commessa | FK `project_id` (o picker) su RDP e NDT | ISO-1a/1b | Fatto (PR #474) |
| **ISO-8** | Ponte offerta → commessa | FK `commercial_case_id` su `projects` o viceversa | ISO-3 utile ma non bloccante | AFK |
| **ISO-9** | Operatore NDT = qualifica 9712 | `NdtReportsPage` + check copertura | ISO-1b | AFK |
| **ISO-10** | Dashboard copertura per processo | `WeldingDashboardPage.jsx`: semaforo §5–18 sul livello azienda | ISO-1* + ISO-2 decisione | AFK |
| **ISO-11** | Registro subfornitura saldatura | riuso controparti + flag/ruolo, no nuova anagrafica | solo se un cliente lo chiede | HITL |
| **ISO-12** | *(chiusa come slice 3834)* | Consumabili / 3.1 / PWHT → epic Material Compliance | — | — |
| **ISO-13** | RDP/WB → registro documenti | commit tipo `rdp` / `welding_book` | ISO-4 / ISO-5 | AFK |

**ISO-1* + ISO-2 chiuse** (PR #438–#442, #443): isolamento azienda + traccia/Word riesame §5.3.

## Pronto a eseguire (19/08, dopo merge ISO-7)

**Sì, si parte a slice.** Un deputy = una slice. In parallelo solo se i file sono disgiunti.

| Ora | Aspettare |
|-----|-----------|
| **ISO-7** RDP/NDT ↔ commessa | fatto [PR #474](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/474); migrazione **155 applicata su TEST**; PROD solo su richiesta |
| **ISO-5** Word Welding Book | dopo 155 su TEST |
| **ISO-4** Word visita Mason | HITL [gap 19/08](../gap-reports/GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md) — file in git, architettura prima dell’export |
| **ISO-8** ponte offerta → commessa | file disgiunti da ISO-5 |
| **Ingest / MR-2** | **altra chat** — non mescolare (`DEPUTYTASK5.md` APERTO) |

`DEPUTYTASK.md` = SAL S1a **CHIUSO** (#471). `DEPUTYTASK1.md` = ISO-7 **CHIUSO** (PR #474). Non sovrascrivere `DEPUTYTASK_MC_INGEST.md` né `DEPUTYTASK5.md`.

## Qualità della mappa

- Una slice = un obiettivo demoable (es. «utente azienda A non vede RDP di B»).
- File disgiunti se si vogliono deputy paralleli: ISO-1b/1c/1d dopo che ISO-1a ha fissato il pattern; ISO-3 può partire in parallelo su `contractReview.controller.js`.
- Nessun numero di migrazione riservato in anticipo.
- Logica normativa (ISO-2, ISO-9, ISO-12): L1 verde dello stesso deputy non basta — gate Bugbot.
