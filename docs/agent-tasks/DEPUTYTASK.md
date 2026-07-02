# DEPUTYTASK — Ingest AI commesse: chiusura slice #5–#7

> **Creato**: 02/07/2026  
> **Stato**: COMPLETATO — TEST OK (L1 backend + Vitest checklist)  
> **Spec**: [`docs/specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](../specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) §E  
> **Branch**: `cursor/ingest-ai-residui-slice-567-0989`

---

## Obiettivo

Chiudere in sequenza i residui roadmap Ingest AI commesse (slice verticali #5, #6, #7).

---

## Deliverable

| Slice | Esito |
|-------|-------|
| **#5** Orchestratore `caseDocumentAnalysis.service.js` + `POST /cases/:id/analyze-documents` + pulsante UI tab Documenti | ✅ |
| **#6** Pre-compilazione checklist §8.2 (preliminare + finale, prefisso `[AI doc]`) + test Vitest | ✅ |
| **#7** `extractedRequirementsProfile.js` + `GET /cases/:id/extracted-coverage` + CoveragePanel arricchito | ✅ |
| Refactor `_triggerAutoExtraction` → riuso servizio orchestratore | ✅ |
| `deploy-manifest.json` aggiornato | ✅ |

**Fuori scope (slice #8+)**: OCR scansioni, stepper UI a fasi, orchestratore LLM Fase 3–5.

---

## Chiusura

TEST OK — slice #5–#7 implementate. Prossimo step opzionale: **slice #8 OCR** o smoke L3 manuale su commessa PT.MAIDO con «Analizza documenti commessa» + copertura saldatori.
