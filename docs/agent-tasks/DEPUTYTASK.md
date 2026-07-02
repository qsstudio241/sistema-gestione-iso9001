# DEPUTYTASK — SAL Fase 2: export Word + storico + evidenze registro

> **Creato**: 02/07/2026  
> **Stato**: COMPLETATO — TEST OK  
> **Spec**: [`docs/specs/MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §H Fase 2  
> **Base**: `main`

---

## Obiettivo

Completare Fase 2 SAL: export Word tracker, storico revisioni per clausola, collegamento evidenze al Registro Documenti (`document_registry`), coordinato col modulo documenti esistente.

**Non toccato**: `ContractReviewPage`, `contractReview.*`, drawing extraction (branch parallelo committente).

---

## Deliverable

| Voce | Esito |
|------|-------|
| `wordExportSal.js` — export .docx con legenda standard + colonna evidenze registro | ✅ |
| `SalEvidenceSection.jsx` — picker documenti rilasciati, link registro (`RouterContext`) | ✅ |
| Modal SAL ampliato: evidenze + storico revisioni | ✅ |
| Backend: `validateEvidenceDocumentIds`, `enrichRowsWithEvidence`, `GET .../history` | ✅ |
| Pulsante «Export Word» in header SAL | ✅ |
| Test L1 backend (13) + frontend (5) | ✅ PASS |

**Prossimo step**: Fase 3 integrazioni audit/NC (`sal_gap`).

---

## Chiusura

TEST OK — Fase 2 completata. Evidenze SAL = riferimenti a `document_registry`, non duplicazione file.
