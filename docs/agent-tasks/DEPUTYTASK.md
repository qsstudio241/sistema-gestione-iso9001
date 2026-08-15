# DEPUTYTASK — SAL AI evidenze S1a (OCR PDF in documentTextExtractor)

**Stato:** APERTO  
**Aperto:** 15/08/2026 (Lead wayfinder — Chart the map)  
**Piano:** [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md)  
**Spec:** [`MODULO_SAL_SCOPO_E_ROADMAP.md`](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) §C.1/C.2 · ADR-010 HITL  

---

## Slice unica di questa sessione: S1a

**Obiettivo**: collegare l’OCR PDF già presente in repo (`ocrExtractor.js`, usato dall’ingest) a `documentTextExtractor.service.js`, così il suggeritore SAL AI può leggere PDF scansionati senza text layer.

### Contesto gap (non riscrivere)

- Oggi: PDF testo / DOCX / text/* OK; PDF scan → `pdf_no_text_layer`; immagini → `unsupported_format`
- `salAiSuggest.service.js` chiama già `extractDocumentText` — **non** serve toccare il dialog UI in S1a
- OCR stack: `pdf2pic` + `tesseract.js` + Ghostscript/GM|IM sul VPS

### DoD

1. Se estrazione PDF testo è vuota / sotto soglia (allinearsi a ingest se sensato), tentare `extractTextWithOCR`; successo → `{ text }`; fallimento → `{ text: null, reason: 'ocr_*' }` senza throw verso il chiamante
2. Test L1 in `documentTextExtractor.service.test.js` (mock OCR ok / fail / unavailable)
3. Commento header del service aggiornato (niente «Nessun OCR in questo passo» se non più vero)
4. Build/test backend mirati verdi; nessun commit di segreti

### File previsti

- `backend/src/services/documentTextExtractor.service.js`
- `backend/src/services/documentTextExtractor.service.test.js`
- eventuale micro-export helper da `ocrExtractor.js` **solo se** serve riuso senza duplicare (gate Ponytail)

### Cosa NON toccare

- UI (`SalAiSuggestDialog`, `SalEvidenceSection`, `SALModule`)
- `salAiSuggest.service.js` (salvo se un reason string va aggiornato — preferire zero)
- Pipeline ingest (già OCR-aware)
- Slice S1b (immagini), S2a/S2b (documento mancante)
- Migrazioni DB

### Verifica

```bash
cd backend
npm test -- --testPathPattern=documentTextExtractor
```

(Adattare al runner Jest del repo se diverso.)

### Chiusura

- Aggiorna PLAN: spunta DoD S1a; next brief = S1b
- PR livello Medio + gate Bugbot; deploy VPS solo se necessario per smoke OCR reale
- Chiudi con **TEST OK** o **FIX NON APPLICABILI** + handoff se incompleto

---

## Comando per il deputy

Leggi `docs/agent-tasks/DEPUTYTASK.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
