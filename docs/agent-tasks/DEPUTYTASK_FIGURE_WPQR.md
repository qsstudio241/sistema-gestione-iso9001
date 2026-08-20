# DEPUTYTASK_FIGURE_WPQR — FW-0: ingest norma PDF → tavole CLIP

**Stato:** CHIUSO — TEST OK (20/08/2026)  
**Aperto:** 20/08/2026  
**Chiuso:** 20/08/2026  
**Piano:** [`PLAN_FIGURE_WPQR_SLICES.md`](PLAN_FIGURE_WPQR_SLICES.md)  
**Spec:** ADR-010 · MR-3 `ingestFiguresFromPdf` · `commitNormFromFields` (auto-commit + conferma staging)  
**Rischio:** Medio — hook additivo; CLIP non deve far fallire il commit norma; PR + 1 Bugbot a slice chiusa; **non** push su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` e partire da `origin/main`. Non chiedere al committente.

---

## Contesto (perché non è più «slot WPQR»)

Serve che l’Assistente **mostri e confronti tavole vere** delle norme PDF: domanda di testo → miniatura; ritaglio → CLIP + VLM.  
Quel retrieve **già esiste** (MR-2/4/5). Manca l’unico pezzo: quando confermi una norma, le tavole **non** finiscono in `knowledge_figures`.  
WPQR/patentino restano **fuori** da questa slice (AI cita, non certifica).

---

## Slice unica: FW-0

**Obiettivo:** dopo un commit norma riuscito, sullo stesso PDF (`filePath` già sul disco) chiamare `ingestFiguresFromPdf` con `organizationId` dal JWT. PDF senza tavole → lista vuota. Errore CLIP/extract → log, **norma comunque committata**.

### DoD

1. Hook in `commitNormFromFields` (così vale per auto-commit catalogo **e** conferma da `IngestReviewDialog`).
2. Stesso `organization_id`; niente Gemini sui PNG.
3. Fallimento ingest figure **non** rollback della norma.
4. L1: mock `ingestFiguresFromPdf` — chiamato con path+org sul commit; se il mock throw, `commitNormFromFields` comunque ok.
5. **Non** toccare WPQR, WPS, patentini, certificati 3.1, composer Assistente, GUIDA, roadmap.
6. Un Bugbot solo a slice chiusa.

### File previsti

- `backend/src/services/normIngest.service.js` (+ test esistente o accanto)
- eventuale `normIngest.service.test.js` se manca il caso hook
- riuso `ingestFiguresFromPdf` — **niente** secondo extract
- questo brief + riga PLAN FW-0 **fatto** a chiusura

### Cosa NON toccare

- `figureVlm.service.js`, `wpsGenerator.service.js`, `qualificationCoverage.js`
- `AiAssistantPage.jsx` (textarea testo; bottone ritaglio già c’è)
- Gemini, CLIP adapter, migrazioni
- `DEPUTYTASK.md` / `DEPUTYTASK5.md`
- GUIDA, roadmap (sync dopo merge)

### Verifica

```bash
cd backend && npx jest src/services/normIngest.service.test.js src/services/figureIngest.service.test.js --forceExit
```

(Se il test norma è in altro file, estendere quello che già copre `commitNormFromFields`.)

---

## Comando per il deputy (quando il committente lancia)

Sovrascrivi lo **Stato** in **APERTO**, poi: leggi `docs/agent-tasks/DEPUTYTASK_FIGURE_WPQR.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI. Non collegare WPQR. Non toccare GUIDA né roadmap.

---

## Esito deputy (20/08/2026)

**TEST OK.** Hook in `commitNormFromFields`: dopo gli INSERT, se c’è `filePath` chiama `ingestFiguresFromPdf({ organizationId, pdfPath })`. Throw CLIP/extract → `logger.warn`, return della norma invariato. Senza PDF → niente chiamata. WPQR/GUIDA/roadmap non toccati.

```
cd backend && npx jest src/services/normIngest.service.test.js src/services/figureIngest.service.test.js --forceExit
# Test Suites: 2 passed · Tests: 16 passed
```
