# DEPUTYTASK5 — Multimodal RAG MR-5: VLM locale cita le tavole sul ritaglio

**Stato:** CHIUSO — TEST OK (19/08/2026)  
**Aperto:** 19/08/2026 (dopo merge MR-4 [PR #489](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/489))  
**Chiuso:** 19/08/2026  
**Piano:** [`PLAN_MULTIMODAL_RAG_SLICES.md`](PLAN_MULTIMODAL_RAG_SLICES.md)  
**Spec:** ADR-010 (AI cita, non certifica) · MR-4 `POST /ai/figures/search-by-image` · Ollama `qwen2.5vl:7b`  
**Rischio:** Medio — VLM locale additivo, niente schema breaking; PR + **un** Bugbot a slice chiusa; **non** push su `main`

**Scontrini (non rifare):**  
- MR-0…MR-4 CHIUSI (#464 / #469 / #475 / #484 / #489)  
- Mig. **154** già su TEST e PROD  
- CLIP retrieve invariato  

---

## Slice unica: MR-5

**Obiettivo:** dopo il retrieve CLIP, un VLM **locale** (Ollama) commenta il ritaglio e cita pagina/didascalia delle tavole. Stesso Assistente, stesso pannello citazioni. Ollama assente → `reply: null`, le tavole MR-4 restano, niente 500. Nessun Gemini sui PNG. **Non** collegare WPQR in questa slice.

### Esito

- `figureVlm.service.js`: `POST` Ollama `/api/chat`, immagini in base64 (ritaglio + max 2 PNG tavola se file < 1,5 MB)
- Fallback: `{ reply: null, unavailable: true }` senza throw
- Controller: `{ figures, reply }` + `_aiMeta` (stripped da `logAiInteraction`)
- Route: `logAiInteraction('chat')` dopo multer
- UI: se `reply` c’è, è il testo assistente; altrimenti fallback MR-4. Card tavole invariate
- L1 Jest: **22/22** (`figureVlm.service.test.js` + `figureKnowledge.controller.test.js`)
- WPQR **non** aperto in codice; brief collegamento in [`PLAN_FIGURE_WPQR_SLICES.md`](PLAN_FIGURE_WPQR_SLICES.md)

### DoD

1. Ritaglio → CLIP → VLM commenta e cita tavole.
2. Ollama giù → 200 con figures, `reply: null`.
3. Disclaimer: non certifica WPQR / patentino / WPS.
4. Audit trail `logAiInteraction('chat')`.
5. Nessun Gemini sui byte; nessun layout nuovo.
6. **Un** Bugbot solo a slice chiusa (L1 verde).

### File toccati

- `backend/src/services/figureVlm.service.js` + test
- `backend/src/controllers/figureKnowledge.controller.js` + test
- `backend/src/routes/aiChat.routes.js`
- `backend/scripts/deploy-manifest.json`
- `app/src/pages/AiAssistantPage.jsx`
- questo brief + `PLAN_MULTIMODAL_RAG_SLICES.md`
- mappa WPQR (solo docs, niente codice): `PLAN_FIGURE_WPQR_SLICES.md` + `DEPUTYTASK_FIGURE_WPQR.md`

### Cosa NON toccare

- `aiProviderAdapter` / Gemini / `knowledge_chunks`
- `wpsGenerator.service.js`, `qualificationCoverage.js`, pagina WPS
- migrazioni SQL
- `DEPUTYTASK.md` e altri slot
- `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md` (sync **dopo merge**)

### Verifica

```bash
cd backend && npx jest src/services/figureVlm.service.test.js src/controllers/figureKnowledge.controller.test.js --forceExit
```

Senza rete, senza download Ollama. **Esito: 22/22.**

### Chiusura

- DoD MR-5 spuntato nel PLAN. Codice WPQR **non** aperto.
- Cloud Agent **non** mergia.
- Esito: **TEST OK**.

---

## Comando per il deputy

Leggi `docs/agent-tasks/DEPUTYTASK5.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI. Non aprire il codice WPQR. Non toccare GUIDA né roadmap. Un solo Bugbot a slice chiusa.
