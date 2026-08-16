# Piano slice — ISO 3834 completo e affidabile

> **Destinazione**: ogni processo della ISO 3834-2/-3 (adattato al livello 2/3/4 in anagrafica) ha un percorso verificabile: dati + ponte con gli altri moduli + import/export o report. I gap residui sono solo HITL o fuori scope.
> **Spec / ADR**: [ISO 3834-3:2021](../Normative/Normative%20NORMA_00009_%20UNI%20EN%20ISO%203834-3_2021%20Rev.%200.md) §5–18 · [ISO 3834-5:2021](../Normative/Normative%20NORMA_00008_%20UNI%20EN%20ISO%203834-5_2021%20Rev.%200.md) · [ADR-016](../adr/ADR-016-welding-book-e-modulo-strumenti.md) · [WPS](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md)
> **Gap di partenza**: [GAP_RDP_3834_2026-08-06.md](../gap-reports/GAP_RDP_3834_2026-08-06.md) (Mason, 06/08) · aggiornamento processi [GAP_RDP_3834_2026-08-15.md](../gap-reports/GAP_RDP_3834_2026-08-15.md)
> **Brief**: [DEPUTYTASK1.md](DEPUTYTASK1.md) — slice **ISO-2** **CHIUSO** (PR #443). Serie ISO-1* RBAC + traccia §5.3.
> **Non confondere**: [DEPUTYTASK.md](DEPUTYTASK.md) resta **APERTO** sulla slice SAL S1a (OCR). Non sovrascriverlo.

## Fuori scope

- Material Compliance EN 10204 3.1 (consumabili / materiali base «completi») — epic già mappata in [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md)
- SAL documentale Camellini (9001/14001/45001) — piano distinto [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)
- Sostituire in repo le edizioni 2006 di ISO 3834-2/-4 con le 2021 (limite documentale: PDF non reperito)
- Scheduler automatico rielaborazione ingest (decisione di costo già chiusa)
- Destinatario alert qualifiche in anagrafica (modulo Notifiche, non 3834)
- Nuovo motore offline/sync per RDP/NDT/Welding Book (restano server-first)

## Non ancora specificato

- Registro **subfornitura saldatura** dedicato (ISO-11): oggi solo checkbox + cliente commessa — da aprire solo se un cliente lo chiede in campo
- Il file Word Mason `Check List Audit/RDP_MSN-260127-01_REV_0.docx` **non è in git** (solo citato). ISO-4: copiarlo in `app/public/templates/rdp-mason-report.docx` quando il deputy lo trova in cartella locale / archivio; se manca, chiedere il file al committente (non inventare un layout)
- **Norme certificati 3.1**: consegnate 16/08/2026 (EN 10204, EN 10168, ISO 10474/404/6929 + facsimile). Soglie lamiere EN 10025-2:2019 in [`EN-10025-2-acciai-strutturali.md`](../reference/EN-10025-2-acciai-strutturali.md). Inventario fonti (dichiarare, poi partire): [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md).

## Decisioni già prese

### HITL committente 16/08/2026

- **§5.3 — niente blocco**: la commessa si può aprire anche con checklist incompleta. ISO-2 = solo tracciabilità (data/utente che ha completato) + export Word della checklist. Il banner di avviso resta.
- **Word RDP**: usare il verbale Mason già in cartella (`RDP_MSN-260127-01_REV_0.docx`) come modello. ISO-4 diventa AFK (non più in attesa di un layout nuovo).
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
| 14 | Ispezioni e prove | RDP + verbali NDT | Nessun `project_id` obbligatorio su RDP/NDT | N/A (compilazione + foto) | VT Word **sì**; RDP Word **no** | Parziale | ISO-4 Word da verbale Mason + RBAC + ponte commessa |
| 15 | Non conformità e azioni correttive | Modulo NC (ISO 9001 §10.2) | **Nessun `project_id`** su NC | — | Export PDF NC assente (P2, non 3834) | Parziale | Ponte NC ↔ commessa / Welding Book |
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
        ↔ RDP / NDT                            [ponte debole: testo libero, non FK]
        ↔ NC                                   [ASSENTE]
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
| RDP | Manuale + foto | **Assente** (`TEMPLATE_MAP['RDP_MSN']` punta al template audit 3834) | ISO-4 da verbale Mason `RDP_MSN-260127-01` |
| Verbali NDT | Manuale + foto | Word VT | — |
| Welding Book | Manuale | **Assente** (hint in UI: Fase 2–3) | ISO-5 |
| Audit ISO 3834 | Checklist audit | Word `ISO3834-audit-report.docx` (test L1) | — |
| Dashboard coordinatore | Aggrega API esistenti | Nessun export | ISO-7 (dopo ponti) |

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
| **ISO-4** | Export Word RDP da verbale Mason | `app/public/templates/rdp-mason-report.docx` (da `RDP_MSN-260127-01`), `wordExport.js`, `RDPModule.jsx` | file Mason in cartella | AFK |
| **ISO-5** | Export Word Welding Book + foto cordone | `WeldingBooksPage.jsx`, `wordExport` (pattern VT/WPS), allegati | ADR-016 Fase 2–3 | AFK |
| **ISO-6** | Ponte NC ↔ commessa | `nc.controller.js` + `NCPage` / drawer: `project_id` opzionale | — | AFK |
| **ISO-7** | Ponte RDP/NDT ↔ commessa | FK `project_id` (o picker) su RDP e NDT | ISO-1a/1b | AFK |
| **ISO-8** | Ponte offerta → commessa | FK `commercial_case_id` su `projects` o viceversa | ISO-3 utile ma non bloccante | AFK |
| **ISO-9** | Operatore NDT = qualifica 9712 | `NdtReportsPage` + check copertura | ISO-1b | AFK |
| **ISO-10** | Dashboard copertura per processo | `WeldingDashboardPage.jsx`: semaforo §5–18 sul livello azienda | ISO-1* + ISO-2 decisione | AFK |
| **ISO-11** | Registro subfornitura saldatura | riuso controparti + flag/ruolo, no nuova anagrafica | solo se un cliente lo chiede | HITL |
| **ISO-12** | *(chiusa come slice 3834)* | Consumabili / 3.1 / PWHT → epic Material Compliance | — | — |
| **ISO-13** | RDP/WB → registro documenti | commit tipo `rdp` / `welding_book` | ISO-4 / ISO-5 | AFK |

**ISO-1* + ISO-2 chiuse** (PR #438–#442, #443): isolamento azienda + traccia/Word riesame §5.3.

## Pronto a eseguire (16/08, dopo ISO-3)

**Sì, si parte a slice.** Un deputy = una slice. In parallelo solo se i file sono disgiunti.

| Ora | Aspettare |
|-----|-----------|
| **ISO-4** Word RDP: file Mason non è in git | — |
| **SAL S1a** — già APERTO su `main` in `DEPUTYTASK.md` | — |
| **MC-1** — migration tabelle (dopo MC-0 mergiata) | MC-2/3 extract+regole: **norme prodotto** ancora mancanti si skippano |

Dopo merge #447 (MC-0): ISO-3 = prompt + field_key (questa slice). ISO-4 resta in attesa del file Word Mason.  
`DEPUTYTASK.md` resta SAL S1a — non sovrascrivere. MC-1 = brief dedicato, non `DEPUTYTASK.md`.

## Qualità della mappa

- Una slice = un obiettivo demoable (es. «utente azienda A non vede RDP di B»).
- File disgiunti se si vogliono deputy paralleli: ISO-1b/1c/1d dopo che ISO-1a ha fissato il pattern; ISO-3 può partire in parallelo su `contractReview.controller.js`.
- Nessun numero di migrazione riservato in anticipo.
- Logica normativa (ISO-2, ISO-9, ISO-12): L1 verde dello stesso deputy non basta — gate Bugbot.
