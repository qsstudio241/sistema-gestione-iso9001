# Modulo Material Compliance AI — Scopo e Roadmap

> **Tipo**: spec di prodotto + architettura + roadmap a slice  
> **Versione**: 1.1 — 05/08/2026 (allineata allo standard doc SGQ)  
> **Stato**: Proposto — fondazione documentale  
> **Cliente / contesto tipico**: ufficio qualità metalmeccanico (certificati EN 10204 3.1; requisiti cliente tipo FASSI/CLAAS; criteri interni azienda)  
> **Norme di riferimento**: EN 10204, famiglie EN 10025 / 10149 / 10210 / 10219; supporto audit ISO 9001, ISO 3834, EN 1090  
> **ADR**: [020](../adr/ADR-020-material-compliance-ai-module.md) · [021](../adr/ADR-021-material-requirements-hierarchy.md) · [022](../adr/ADR-022-ai-extraction-rule-engine.md) · [023](../adr/ADR-023-material-knowledge-base.md) · [024](../adr/ADR-024-material-certificate-workflow.md)  
> **Piano slice**: [PLAN_MATERIAL_COMPLIANCE_SLICES.md](../agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md)  
> **Brief fondazione**: [DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md](../agent-tasks/DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md)

---

## Sintesi (per il committente)

L’ufficio qualità carica un **certificato 3.1 in PDF**. Il sistema estrae i dati tecnici (con AI), li confronta in modo **automatico e ripetibile** con norma + ordine + requisiti cliente + criteri interni, e propone un esito. **Solo una persona autorizzata** può approvare o respingere. Tutto resta tracciato per l’audit.

Non è un’app nuova: è un modulo della piattaforma SGQ, che riusa ingest documenti, AI già presente e permessi per azienda.

---

## Distinzione moduli (non confondere)

| Modulo | Domanda | Overlap |
|--------|---------|---------|
| **Material Compliance** (questo) | «Questo certificato 3.1 è conforme ai requisiti applicabili?» | Cuore |
| **Ingest / Import jobs** (Sprint 9–10) | «Carico e classifico PDF generici» | Pipeline riusata |
| **Document Registry** | «Dove archivio il documento ufficiale?» | Destinazione post-approvazione |
| **WPS da WPQR** | «Posso saldare questo giunto?» | Nessun overlap funzionale |
| **SAL** | «A che punto è l’implementazione SGQ?» | Nessun overlap |
| **Fornitori** | «Valuto il fornitore» | Collegamento futuro (fuori MVP) |

---

## Ambito

### Incluso MVP

- Certificati **EN 10204 3.1**
- Prodotti: laminati, profilati, piastre, lamiere (soglie EN 10025-2). **Tubi / sezioni cave**: in MVP come forma prodotto, soglie solo quando c’è Markdown EN 10210-1 / 10219-1 (oggi **mancante** → skip, non fail). Inventario: [sintesi fonti](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md).
- Certificati **anche scansioni** (caso normale in campo — HITL 16/08/2026)
- Estrazione AI → Rule Engine → revisione umana (stesso anello delle qualifiche/WPQR)
- Apprendimento progressivo dalle correzioni (`ingestFeedback` / few-shot), non un modello addestrato a parte
- KB Markdown versionata (dizionario + 1–2 norme + pilota cliente/azienda)

### Escluso MVP (evoluzione)

- Certificati trattamenti termici / verniciatura (dopo 3.1 stabile)  
- PPAP, ISIR, dossier fornitore, supplier scorecard  
- Menu completo “Norme / Statistiche / KB editor” in UI  

---

## Architettura target

```text
PDF (upload / import_jobs)
        │
        ▼
documentTextExtractor / importPdfText   ← testo; se vuoto → OCR (ocrExtractor, MC-B)
        │  (stesso estrattore del SAL S1a — non un secondo motore)
        ▼
Markdown / testo normalizzato
        │
        ▼
importAiExtraction + aiProviderAdapter  ← JSON bozza (schema dictionary)
        │
        ▼
materialComplianceRuleEngine            ← deterministico (ADR-022)
        │
        ▼
pending_review → operatore → compliant | non_compliant → archive (+ registry)
```

**Vincolo ADR-022**: l’AI non dichiara conformità; il Rule Engine valuta; l’operatore approva.

---

## Riuso componenti esistenti (path)

| Capacità | Path / pattern |
|----------|----------------|
| Ingest | `backend/src/services/documentIngestPipeline.service.js` |
| Testo PDF | `documentTextExtractor.service.js`, `utils/importPdfText` |
| AI extract | `importAiExtraction.service.js`, `aiProviderAdapter` |
| Audit AI | `logAiInteraction` / tabella `ai_interactions` |
| Licenze | `moduleLicense.service.js` — seam `MATERIAL_COMPLIANCE` → `saldatura` + `ai_import` |
| RBAC azienda | `companyAccess.service.js` / Ambito |
| UI | Sidebar + pattern lista/dettaglio esistenti; `AiDisclaimer`; niente card parallele |

---

## UI MVP (slim)

Voce sidebar: **Material Compliance** (gate licenza).

| Schermata | MVP | Post-MVP |
|-----------|-----|----------|
| Elenco certificati | Sì | — |
| Dettaglio (PDF \| testo \| esito check) | Sì | — |
| Azioni approva / correggi / respingi | Sì | — |
| Dashboard KPI | No | Sì |
| Editor KB / Norme / Requisiti cliente in UI | No (file Git) | Valutare |
| Statistiche avanzate | No | Sì |

Campi lista (HITL 16/08, **confermati**): **N. DDT**, data DDT, n. certificato 3.1, materiale (designazione), colata, forma, dimensioni, norma, fornitore/acciaieria, esito.  
Copia `QualificationsPage` + `SgqDataGrid`. Dettaglio al click: chimica, meccaniche, PDF, azioni HITL. Commessa = ponte successivo, non colonna MVP.

---

## Gerarchia requisiti e KB

Vedi ADR-021 e ADR-023. Path: `knowledge/material-compliance/` (`standards/`, `customers/`, `companies/<slug>/`, `dictionary/`, `lessons/`).

---

## Roadmap slice (todo implementazione)

Fonte operativa dettagliata: [PLAN_MATERIAL_COMPLIANCE_SLICES.md](../agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md).

| Slice | Obiettivo | Stato |
|-------|-----------|--------|
| **MC-0** | Spec tecniche: DATA_MODEL + UI + API; piano chiuso | ⬜ Aperto (brief foundation) |
| **MC-1** | Migration DB + script VPS (entità certificato / check / audit) | ⬜ |
| **MC-2** | KB seed (dictionary + EN10204 + EN10025-2) + loader | ⬜ |
| **MC-3** | Rule Engine puro + test L1 (casi ReH/CEV) | ⬜ |
| **MC-4** | API: upload/lista/dettaglio + extract (riuso AI) + evaluate | ⬜ |
| **MC-5** | UI elenco + dettaglio + HITL approve/reject | ⬜ |
| **MC-6** | Gate licenza + `AiDisclaimer` + audit trail AI | ⬜ |
| **MC-B** | OCR su scan: riuso `documentTextExtractor` / `ocrExtractor` | ⬜ In MVP (dopo MC-4) |
| **MC-7** | Commit Document Registry + lessons/feedback (anello qualifiche/WPQR) | ⬜ In MVP |

---

## Verifiche di qualità (per slice)

| Livello | Cosa |
|---------|------|
| **L1** | Vitest/Jest mirati Rule Engine + build `app/` se FE |
| **L2** | API con auth + company scope (smoke) |
| **L3** | Smoke UI: carica PDF prova → pending_review → approve |
| **Doc** | Aggiornare questa tabella Stato + riga in `PROJECT_ROADMAP` / GUIDA a chiusura |

---

## Future evolution

Trattamenti termici, verniciatura, PPAP/ISIR, dossier fornitore, scorecard, assistente conversazionale dedicato — solo dopo MVP stabile e feedback campo.
