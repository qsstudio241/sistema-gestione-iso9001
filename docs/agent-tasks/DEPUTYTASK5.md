# DEPUTYTASK5 — Multimodal RAG MR-4: query visiva (disegno → simboli)

**Stato:** CHIUSO — TEST OK (19/08/2026)  
**Aperto:** 19/08/2026 (dopo merge MR-3 [PR #484](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/484); mig. **154** applicata su TEST e PROD)  
**Chiuso:** 19/08/2026  
**Piano:** [`PLAN_MULTIMODAL_RAG_SLICES.md`](PLAN_MULTIMODAL_RAG_SLICES.md)  
**Spec:** ADR-010 (AI cita, non certifica) · MR-1 `searchFiguresByText` / CLIP locale · stesso `embedding_space`  
**Rischio:** Medio — API upload + retrieve, niente schema breaking; PR + **un** Bugbot a slice chiusa; **non** push su `main`

**Scontrini (non rifare):**  
- MR-0 CHIUSO #464 — CLI `--extract-figures`  
- MR-1 CHIUSO #469 — tabella **154** `knowledge_figures`, GET search (SQL TEST + **PROD** applicati 19/08)  
- MR-2 CHIUSO #475 — UI citazioni tavola  
- MR-3 CHIUSO #484 — ingest PDF locale  

---

## Slice unica: MR-4

**Obiettivo:** upload di un ritaglio/pagina (PNG/JPEG/WebP) → embedding nello **stesso** spazio CLIP delle tavole persistite → top-k figure isolate per `organization_id`. Bottone ritaglio nel composer Assistente, stesso pannello citazioni. Nessun Gemini sui PNG. Nessun layout di prodotto nuovo. **Non aprire MR-5.**

### Esito

- `searchFiguresByImage` riusa il ranking di `searchFiguresByText` (`rankFiguresByQueryVec`)
- `POST /api/v1/ai/figures/search-by-image` (multipart `file`, auth + licenza `ai_chat`); org dal JWT, mai `body.organization_id`
- Senza file → 400; lista vuota → `{ figures: [] }` 200; CLIP assente → 503
- L1 Jest: **24/24** (`figureKnowledge.service.test.js` + `figureKnowledge.controller.test.js`) — due crop fixture (vector vs raster) + isolamento org
- UI: input file nascosto + bottone ritaglio accanto a Invia; FormData senza `Content-Type` JSON
- MR-5 **non** aperta; GUIDA/roadmap **dopo merge** (hub)

### DoD

1. Upload ritaglio → stesso `embedding_space` CLIP → top-k figure.
2. Test L1: due crop della fixture (vector vs raster) trovano la tavola giusta; org A non vede org B.
3. `POST /api/v1/ai/figures/search-by-image` prima di `/:id/image`; multer memory, max 4MB, PNG/JPEG/WebP.
4. Bottone ritaglio nel composer esistente; vuoto = testo senza card, niente 500.
5. Nessun Gemini sui byte; **non** aprire MR-5.
6. **Un** Bugbot solo a slice chiusa (L1 verde).

### File toccati (disgiunti)

- `backend/src/services/figureKnowledge.service.js` + test
- `backend/src/controllers/figureKnowledge.controller.js` + test
- `backend/src/routes/aiChat.routes.js`
- `app/src/pages/AiAssistantPage.jsx`
- `app/src/services/apiService.js`
- questo brief + `PLAN_MULTIMODAL_RAG_SLICES.md`

### Cosa NON toccare

- `documentIngestPipeline.service.js`
- Gemini / `knowledge_chunks` / `extract_figures.py`
- `weldingSymbols2553.js`, PDF in `docs/Normative/`
- migrazioni SQL (154 già in TEST e PROD)
- `DEPUTYTASK.md` e altri slot
- `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md` (sync **dopo merge**)
- MR-5 (Ollama VLM)

### Verifica

```bash
cd backend && npx jest src/services/figureKnowledge.service.test.js src/controllers/figureKnowledge.controller.test.js --forceExit
```

Senza rete, senza download CLIP. **Esito: 24/24.**

### Chiusura

- DoD MR-4 spuntato nel PLAN. **MR-5 non aperta.**
- Cloud Agent **non** mergia.
- Esito: **TEST OK**.

---

## Comando per il deputy

Leggi `docs/agent-tasks/DEPUTYTASK5.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI. Non aprire MR-5. Non toccare GUIDA né roadmap. Un solo Bugbot a slice chiusa.
