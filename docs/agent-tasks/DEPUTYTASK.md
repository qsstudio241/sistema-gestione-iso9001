# DEPUTYTASK — SAL AI evidenze S1a (OCR PDF in documentTextExtractor)

**Stato:** CHIUSO — TEST OK (18/08/2026, [PR #471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471))  
**Aperto:** 15/08/2026 (Lead wayfinder — Chart the map)  
**Chiuso:** 18/08/2026  
**Piano:** [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)  
**Spec:** [`MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §C.1/C.2 · ADR-010 HITL  

---

## Slice unica di questa sessione: S1a

**Obiettivo**: collegare l’OCR PDF già presente in repo (`ocrExtractor.js`, usato dall’ingest) a `documentTextExtractor.service.js`, così il suggeritore SAL AI può leggere PDF scansionati senza text layer.

### Esito

- PDF vuoto o sotto soglia ingest (`INGEST_OCR_MIN_CHARS`, default 50) → `extractTextWithOCR`
- Successo → `{ text }`; fallimento → `{ text: null, reason: 'ocr_unavailable' | 'ocr_failed' }` senza throw
- Test L1: 18 verdi (`documentTextExtractor.service.test.js`)
- Header service aggiornato; `ocrExtractor.js` riusato (nessun duplicato)
- UI / `salAiSuggest` / ingest / migrazioni **non** toccati

### File toccati

- `backend/src/services/documentTextExtractor.service.js`
- `backend/src/services/documentTextExtractor.service.test.js`
- `docs/agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK.md`
- `docs/PROJECT_ROADMAP.md` § Stato attuale
- `docs/GUIDA_CONSOLIDATA.md` (lezione S1a)

### Prossima slice

**S1b** — OCR immagini (PNG/JPEG) nello stesso service. Non parallelizzare su `documentTextExtractor`.

### Comando originale per il deputy

Leggi `docs/agent-tasks/DEPUTYTASK.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
