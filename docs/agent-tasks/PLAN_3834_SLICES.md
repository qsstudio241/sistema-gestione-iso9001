# Piano slice — ISO 3834 completo e affidabile

> **Destinazione**: ogni processo della ISO 3834-2/-3 (adattato al livello 2/3/4 in anagrafica) ha un percorso verificabile: dati + ponte con gli altri moduli + import/export o report. I gap residui sono solo HITL o fuori scope.
> **Spec / ADR**: [ISO 3834-3:2021](../Normative/Normative%20NORMA_00009_%20UNI%20EN%20ISO%203834-3_2021%20Rev.%200.md) §5–18 · [ISO 3834-5:2021](../Normative/Normative%20NORMA_00008_%20UNI%20EN%20ISO%203834-5_2021%20Rev.%200.md) · [ADR-016](../adr/ADR-016-welding-book-e-modulo-strumenti.md) · [WPS](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md)
> **Gap di partenza**: [GAP_RDP_3834_2026-08-06.md](../gap-reports/GAP_RDP_3834_2026-08-06.md) (Mason, 06/08) · aggiornamento processi [GAP_RDP_3834_2026-08-15.md](../gap-reports/GAP_RDP_3834_2026-08-15.md)
> **Brief attivo**: [DEPUTYTASK1.md](DEPUTYTASK1.md) — slice **ISO-1a** (RBAC `company_access` su RDP)
> **Non confondere**: [DEPUTYTASK.md](DEPUTYTASK.md) resta **APERTO** sulla slice SAL S1a (OCR). Non sovrascriverlo.

## Fuori scope

- Material Compliance EN 10204 3.1 (consumabili / materiali base «completi») — epic già mappata in [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md)
- SAL documentale Camellini (9001/14001/45001) — piano distinto [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)
- Sostituire in repo le edizioni 2006 di ISO 3834-2/-4 con le 2021 (limite documentale: PDF non reperito)
- Scheduler automatico rielaborazione ingest (decisione di costo già chiusa)
- Destinatario alert qualifiche in anagrafica (modulo Notifiche, non 3834)
- Nuovo motore offline/sync per RDP/NDT/Welding Book (restano server-first)

## Non ancora specificato (HITL prodotto)

- **Riesame §5.3**: bloccare lo stato «Aperta» se la checklist 17 punti è incompleta, oppure solo data/utente + export Word (oggi è un avviso, la commessa si apre comunque)?
- **Template Word RDP**: usare come base `Check List Audit/RDP_MSN-260127-01_REV_0.docx`, o aspettare un layout nuovo da Mason?
- **Livello 3834-4 (elementare)**: serve una UI ridotta (meno processi obbligatori) o basta il selettore 2/3/4 in anagrafica?
- **Registro minimo consumabili / PWHT**: serve un CRUD 3834 prima di Material Compliance, o restano solo voci della checklist §5.3?

## Decisioni già prese (da codice + gap 06/08, non da questa sessione)

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
| 5 | Riesame requisiti e riesame tecnico | Commesse (`ProjectsPage`) + Riesame contratto (`ContractReviewPage`) | **Due flussi paralleli**, nessuna FK `case_id`/`project_id` | AI capitolato **non persistita**; checklist §5.3 manuale | Checklist §5.3 **assente** da ogni Word | Parziale | Formalizzare §5.3 (HITL) + persistenza AI capitolato + ponte offerta→commessa |
| 6 | Subfornitura | Voce checklist §5.3 + controparti (`end_customer_id`) | Cliente commessa ↔ `company_counterparties` | — | — | Parziale | Nessun registro subfornitori di **saldatura** (chi salda fuori, con quali WPS/qualifiche) |
| 7 | Personale di saldatura | Qualifiche 9606/14732/14731 | Warning su commessa; copertura WPS | Ingest AI + batch | N/A (norma chiede registro, non un Word dedicato) | Implementato | Report riepilogo per audit cliente = P2 |
| 8 | Personale ispezioni/prove | Qualifiche `cert_ndt` + idoneità visiva | NDT consuma la qualifica a monte | Ingest `cert_ndt` | N/A | Implementato | Collegare operatore firmatario del verbale CND alla qualifica 9712 (oggi implicito) |
| 9 | Attrezzature | `EquipmentPage` + junction Welding Book | WB ↔ `equipment_assets` | — | — | Parziale | RBAC `company_access` assente; `user.company_id` inesistente |
| 10 | Saldatura e attività connesse | WPS/WPQR + dashboard coordinatore | WPS↔WPQR↔commessa (P5 advisory) | Ingest WPQR; WPS legacy | Word WPS Annex A | Implementato | Tabella 7 Level 1 incompleta (P2); feedback Mason |
| 11 | Consumabili (immagazzinamento) | — | Epic Material Compliance | — | — | Assente | Fuori MVP 3834 se resta nell'epic MC; altrimenti HITL registro minimo |
| 12 | Materiali base (immagazzinamento) | — | Epic Material Compliance | — | — | Assente | Come §11 |
| 13 | Trattamento termico dopo saldatura | Solo voce checklist §5.3 | — | — | — | Assente | Nebbia: registro PWHT vs solo flag commessa |
| 14 | Ispezioni e prove | RDP + verbali NDT | Nessun `project_id` obbligatorio su RDP/NDT | N/A (compilazione + foto) | VT Word **sì**; RDP Word **no** | Parziale | Template RDP (HITL) + RBAC + ponte commessa |
| 15 | Non conformità e azioni correttive | Modulo NC (ISO 9001 §10.2) | **Nessun `project_id`** su NC | — | Export PDF NC assente (P2, non 3834) | Parziale | Ponte NC ↔ commessa / Welding Book |
| 16 | Taratura e convalida | `equipment_calibrations` + scadenzario | Attrezzature ↔ Scadenzari (ADR-013) | — | — | Implementato | Stesso buco RBAC di §9 |
| 17 | Identificazione e rintracciabilità | Welding Book (IOF) | WB ↔ commessa / WPS / attrezzature | — | Word **non fatto** (ADR-016 Fase 2–3) | Parziale | Export Word WB + foto cordone |
| 18 | Registrazioni della qualità | Registro documenti + export audit 3834 | Tipi `wps`/`wpqr`/`report_ndt`/`rdp` nel registro | Ingest verso registro | Word audit 3834 **sì** | Parziale | RDP/WB non entrano nel registro come prova firmabile |

**Livello azienda** (`iso3834_level` 2/3/4): oggi è un’etichetta in anagrafica. I moduli **non** si adattano (stessa checklist 17 punti, stessi CRUD). Differenziare i processi obbligatori per livello è HITL (3834-4 non richiede coordinatore §7.3).

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
| Commessa / §5.3 | Checklist manuale; AI capitolato **si perde** | — | Persistenza AI + Word riesame (dopo HITL) |
| RDP | Manuale + foto | **Assente** (`TEMPLATE_MAP['RDP_MSN']` punta al template audit 3834) | ISO-4 (HITL template) |
| Verbali NDT | Manuale + foto | Word VT | — |
| Welding Book | Manuale | **Assente** (hint in UI: Fase 2–3) | ISO-5 |
| Audit ISO 3834 | Checklist audit | Word `ISO3834-audit-report.docx` (test L1) | — |
| Dashboard coordinatore | Aggrega API esistenti | Nessun export | ISO-7 (dopo ponti) |

## Mappa slice

Ogni slice è un **tracer verticale** (un processo o un ponte), non «tutto il DB poi tutte le API».

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **ISO-1a** | RBAC `company_access` su RDP | `rdp.controller.js` + test L1; pattern `projects.controller.js` | — | AFK |
| **ISO-1b** | RBAC su verbali NDT | `ndtReports.controller.js` + test | ISO-1a (stesso pattern) | AFK |
| **ISO-1c** | RBAC su Attrezzature | `equipment.controller.js`: togliere `buildScopeCondition` / `user.company_id` | ISO-1a | AFK |
| **ISO-1d** | RBAC su Welding Book | `weldingBooks.controller.js` | ISO-1a | AFK |
| **ISO-2** | Formalizzare riesame §5.3 | `projects.controller.js`, `ProjectsPage.jsx`, eventuale Word | HITL prodotto | HITL |
| **ISO-3** | Persistenza analisi AI capitolato | `contractReview.controller.js` + colonna `source` (est. mig. 101) | — (parallelo a ISO-1*) | AFK |
| **ISO-4** | Export Word RDP | template `rdp-mason-report.docx`, `wordExport.js`, `RDPModule.jsx` | HITL template Mason | HITL |
| **ISO-5** | Export Word Welding Book + foto cordone | `WeldingBooksPage.jsx`, `wordExport` (pattern VT/WPS), allegati | ADR-016 Fase 2–3 | AFK |
| **ISO-6** | Ponte NC ↔ commessa | `nc.controller.js` + `NCPage` / drawer: `project_id` opzionale | — | AFK |
| **ISO-7** | Ponte RDP/NDT ↔ commessa | FK `project_id` (o picker) su RDP e NDT | ISO-1a/1b | AFK |
| **ISO-8** | Ponte offerta → commessa | FK `commercial_case_id` su `projects` o viceversa | ISO-3 utile ma non bloccante | AFK |
| **ISO-9** | Operatore NDT = qualifica 9712 | `NdtReportsPage` + check copertura | ISO-1b | AFK |
| **ISO-10** | Dashboard copertura per processo | `WeldingDashboardPage.jsx`: semaforo §5–18 sul livello azienda | ISO-1* + ISO-2 decisione | AFK |
| **ISO-11** | Registro subfornitura saldatura | riuso controparti + flag/ruolo, no nuova anagrafica | HITL se serve CRUD dedicato | HITL |
| **ISO-12** | PWHT / consumabili minimi | solo se HITL dice «sì, prima di MC» | HITL | HITL |
| **ISO-13** | RDP/WB → registro documenti | commit tipo `rdp` / `welding_book` | ISO-4 / ISO-5 | AFK |

**Prima slice eseguibile (questa sessione apre solo questa):** ISO-1a — hello world dell’affidabilità multi-azienda. Senza di essa un utente con una sola azienda del tenant vede tutti i RDP.

## Qualità della mappa

- Una slice = un obiettivo demoable (es. «utente azienda A non vede RDP di B»).
- File disgiunti se si vogliono deputy paralleli: ISO-1b/1c/1d dopo che ISO-1a ha fissato il pattern; ISO-3 può partire in parallelo su `contractReview.controller.js`.
- Nessun numero di migrazione riservato in anticipo.
- Logica normativa (ISO-2, ISO-9, ISO-12): L1 verde dello stesso deputy non basta — gate Bugbot.
