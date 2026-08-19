# DEPUTYTASK5 — Multimodal RAG MR-2: UI citazioni tavola (testo → figura)

**Stato:** CHIUSO — TEST OK (19/08/2026, [PR #475](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/475))  
**Aperto:** 19/08/2026 (dopo merge MR-1 [PR #469](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/469) e migrazione **154** applicata su VPS **TEST**)  
**Piano:** [`PLAN_MULTIMODAL_RAG_SLICES.md`](PLAN_MULTIMODAL_RAG_SLICES.md)  
**Spec:** ADR-010 (AI cita, non certifica) · GET già su `main`: `/api/v1/ai/figures/search?q=`  
**Rischio:** Medio — solo UI + eventuale GET immagine sul controller figure già esistente; PR + **un** Bugbot a slice chiusa; **non** push su `main`

**Scontrino MR-1 (non rifare):** CHIUSO TEST OK, mig. **154** `knowledge_figures`, adapter CLIP locale, GET search. 153 = ISO-6.

---

## Slice unica: MR-2

**Obiettivo:** nella pagina Assistente AI, una query di testo mostra le **tavole** citate (ritaglio + pagina + bbox), riusando il pannello citazioni esistente. Nessun layout di prodotto nuovo. Nessun Gemini sui PNG.

### Contesto

- Backend retrieve è su `main` (MR-1). Tabella **154** già creata su SQL **TEST** (19/08). PROD non ancora.
- Citazioni testo già esistono: `AiAssistantCitations.jsx` sotto i messaggi.
- DNA UI: leggere **prima di JSX** `app/src/design-system/README.md` e `docs/reference/LIBRERIA_UI_SGQ.md`. Copiare la scheda a fasi (riferimento 3) o i chip citazioni già in pagina — non inventare una galleria.

### DoD

1. Dopo una risposta (o una ricerca figure), l’utente vede fino a top-k tavole: **immagine** (o placeholder se manca il file), **pagina**, **bbox**, caption, score. Vuoto → niente errore, nessuna card.
2. `organization_id` solo dal JWT (già nel GET). Nessun id org dal client.
3. Se il PNG non è servibile via URL, aggiungere **minimo** `GET` bytes/file sul controller/route **già** di `figureKnowledge` (stesso modulo). Niente secondo store, niente Gemini.
4. Test L1 (Vitest) sul componente citazioni figura: con lista vuota non crasha; con 1 hit mostra pagina. `cd app && NODE_ENV=test npm run test:run` sul file toccato + `npm run build` se si tocca JSX.
5. **Un** `bugbot run` solo a slice chiusa (L1 verde). Non a ogni push.
6. Nessun PDF copyright in repo. Nessuna UI nuova di prodotto.

### File previsti (disgiunti — tocca SOLO questi)

- `app/src/pages/AiAssistantPage.jsx` (+ CSS della pagina se già esiste)
- `app/src/components/AiAssistantCitations.jsx` (estendere; non creare un layout parallelo)
- test accanto: es. `app/src/tests/AiAssistantCitations.test.jsx` o `app/src/components/AiAssistantCitations.test.jsx`
- **solo se serve l’immagine:** `backend/src/controllers/figureKnowledge.controller.js` + `backend/src/routes/aiChat.routes.js` + test controller + riga già in `deploy-manifest.json` (non aggiungere file backend nuovi se si può evitare)

### Cosa NON toccare

- `knowledgeIndexer.service.js`, Gemini, `knowledge_chunks`
- `figureEmbed.service.js` / persist MR-1 (già fatti)
- `weldingSymbols2553.js`, `backend/scripts/pdf_to_json/`
- migrazioni SQL, `run-migration-*-vps.js`
- `DEPUTYTASK.md`, `DEPUTYTASK1.md`… altri slot
- `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md` (parallelo: bozza 5 righe in questo brief, sync **dopo merge**)
- Slice MR-3…MR-5 (ingest, query visiva, Ollama)

### Verifica

```bash
cd app && NODE_ENV=test npm run test:run -- src/components/AiAssistantCitations.test.jsx
cd app && npm run build
```

### Chiusura

- Spunta DoD MR-2 nel PLAN. **Non** aprire MR-3.
- PR livello Medio; 1 Bugbot; Cloud Agent **non** mergia.
- **TEST OK** (19/08/2026) — Vitest `AiAssistantCitations.test.jsx` 4/4; Jest `figureKnowledge.controller.test.js` 8/8; `npm run build` in `app/`. PR [#475](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/475). MR-3 **non** aperta. GUIDA/roadmap non toccate.

### Bozza hub (dopo merge, non in questa PR)

- GUIDA: una riga — citazioni tavola = stesso pannello Assistente, crop locale, AI non certifica.
- Roadmap § Stato attuale: una riga MR-2 + priorità 9 aggiornata.

---

## Comando per il deputy

Leggi `docs/agent-tasks/DEPUTYTASK5.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI. Non aprire MR-3. Non toccare GUIDA né roadmap. Un solo Bugbot a slice chiusa.
