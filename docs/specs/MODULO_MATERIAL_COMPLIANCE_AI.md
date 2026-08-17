# Modulo Material Compliance AI — Scopo e Roadmap

> **Tipo**: spec di prodotto + architettura + roadmap a slice  
> **Versione**: 1.2 — 16/08/2026 (MC-0: spec DATA_MODEL / UI / API; base **e** apporto)  
> **Stato**: Proposto — fondazione documentale (MC-0 chiusa)  
> **Cliente / contesto tipico**: ufficio qualità metalmeccanico (certificati EN 10204 2.1–3.2 su **materiali di base e d’apporto**; requisiti cliente tipo FASSI/CLAAS; criteri interni azienda)  
> **Norme di riferimento**: EN 10204, EN 10168, EN 10025-2; ISO 14341 (classificazione filo); famiglie 10210 / 10219 e norme prodotto apporto quando in Markdown  
> **ADR**: [020](../adr/ADR-020-material-compliance-ai-module.md) · [021](../adr/ADR-021-material-requirements-hierarchy.md) · [022](../adr/ADR-022-ai-extraction-rule-engine.md) · [023](../adr/ADR-023-material-knowledge-base.md) · [024](../adr/ADR-024-material-certificate-workflow.md)  
> **Piano slice**: [PLAN_MATERIAL_COMPLIANCE_SLICES.md](../agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md)  
> **Spec tecniche MC-0**: [DATA_MODEL](MATERIAL_COMPLIANCE_DATA_MODEL.md) · [UI](MATERIAL_COMPLIANCE_UI.md) · [API](MATERIAL_COMPLIANCE_API.md)  
> **Brief fondazione**: [DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md](../agent-tasks/DEPUTYTASK_MATERIAL_COMPLIANCE_AI_FOUNDATION.md)

---

## Sintesi (per il committente)

L’ufficio qualità carica un **certificato 2.1–3.2 in PDF** (lamiera/profilo **oppure** filo/elettrodo/flusso). Il sistema estrae i dati tecnici (con AI), li confronta in modo **automatico e ripetibile** con norma + ordine + requisiti cliente + criteri interni, e propone un esito. **Solo una persona autorizzata** può approvare o respingere. Tutto resta tracciato per l’audit. Stesso elenco, colonna Ruolo (ISO 3834 §11 e §12).

Non è un’app nuova: è un modulo della piattaforma SGQ, che riusa ingest documenti, AI già presente e permessi per azienda.

---

## Distinzione moduli (non confondere)

| Modulo | Domanda | Overlap |
|--------|---------|---------|
| **Material Compliance** (questo) | «Questo certificato 3.1 è conforme ai requisiti applicabili?» | Cuore |
| **Ingest / Import jobs** (Sprint 9–10) | «Carico e classifico PDF generici» | Pipeline riusata |
| **Document Registry** | «Dove archivio il documento ufficiale?» | Destinazione post-approvazione |
| **WPS da WPQR** | «Posso saldare questo giunto?» | La **designazione** filo (ISO 14341) sta sul WPS; il **certificato lotto** del filo sta qui |
| **SAL** | «A che punto è l’implementazione SGQ?» | Nessun overlap |
| **Fornitori** | «Valuto il fornitore» | Collegamento futuro (fuori MVP) |

---

## Ambito

### Incluso MVP

- Certificati **EN 10204** tipi `2.1` \| `2.2` \| `3.1` \| `3.2` (EN 10204 vale per tutti i prodotti metallici, anche i consumabili)
- **Materiale di base** (`material_role=base`): laminati, profilati, piastre, lamiere (soglie EN 10025-2). **Tubi / sezioni cave a caldo**: soglie EN 10210-1 se citata sul certificato. **Cold formed**: soglie EN 10219-1 se citata. Senza citazione 10210 vs 10219 → skip, non fail
- **Materiale d’apporto** (`material_role=filler`): filo, elettrodo, flusso, inserto — **stesso flusso** (DDT + PDF + HITL). Tipo documento sì; chimica/ReH apporto = **skip** finché manca Markdown norma prodotto (ISO 2560 / 17632 / 14174, …). ISO 14341 in repo = classificazione designazione, non tabelle 3.1 lotto
- Inventario: [sintesi fonti](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md)
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

Campi lista (HITL 16/08 + ruolo 16/08): **N. DDT**, data DDT, n. certificato, **ruolo (Base / Apporto)**, materiale (designazione), colata/lotto, forma, dimensioni, norma, fornitore/acciaieria, esito.  
Copia `QualificationsPage` + `SgqDataGrid`. Dettaglio al click: chimica, meccaniche, PDF, azioni HITL. Commessa = ponte successivo, non colonna MVP. Spec: [UI](MATERIAL_COMPLIANCE_UI.md).

---

## Gerarchia requisiti e KB

Vedi ADR-021 e ADR-023. Path: `knowledge/material-compliance/` (`standards/`, `customers/`, `companies/<slug>/`, `dictionary/`, `lessons/`).

---

## Roadmap slice (todo implementazione)

Fonte operativa dettagliata: [PLAN_MATERIAL_COMPLIANCE_SLICES.md](../agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md).

| Slice | Obiettivo | Stato |
|-------|-----------|--------|
| **MC-0** | Spec tecniche: DATA_MODEL + UI + API; piano chiuso | ✅ 16/08/2026 |
| **MC-1** | Migration DB + script VPS (entità certificato / check / audit) | ⬜ |
| **MC-2** | KB seed (dictionary + EN10204 + EN10025-2) + loader | ⬜ |
| **MC-3** | Rule Engine puro + test L1 (casi ReH/CEV) | ✅ |
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
