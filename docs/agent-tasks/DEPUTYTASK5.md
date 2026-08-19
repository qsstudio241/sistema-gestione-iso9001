# DEPUTYTASK5 — Multimodal RAG MR-3: ingest norma → extract + embed figure

**Stato:** APERTO  
**Aperto:** 19/08/2026 (dopo merge MR-2 [PR #475](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/475); hub docs [PR #480](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/480))  
**Piano:** [`PLAN_MULTIMODAL_RAG_SLICES.md`](PLAN_MULTIMODAL_RAG_SLICES.md)  
**Spec:** ADR-010 (AI cita, non certifica) · MR-0 `extract_figures.py` · MR-1 `persistFigures` / CLIP locale  
**Rischio:** Medio — job/API ingest, niente schema breaking; PR + **un** Bugbot a slice chiusa; **non** push su `main`

**Scontrini (non rifare):**  
- MR-0 CHIUSO #464 — CLI `--extract-figures`  
- MR-1 CHIUSO #469 — tabella **154** `knowledge_figures`, GET search (SQL TEST già applicato; PROD a parte)  
- MR-2 CHIUSO #475 — UI citazioni tavola  

---

## Slice unica: MR-3

**Obiettivo:** dato un PDF normativo **già sul disco** (fixture in test; in runtime path tenant), estrarre le tavole (MR-0) e persistirle con embedding locale (MR-1), isolate per `organization_id`. Un solo passaggio operatore/API. Nessuna UI nuova. Nessun Gemini sui PNG. Nessun fork di `documentIngestPipeline`.

### Contesto

- Extract: `backend/scripts/pdf_to_json/` flag `--extract-figures` (PNG + `*.figures.json`).
- Persist: `persistFigures` in `figureKnowledge.service.js` (mock embed in L1).
- Catalogo `weldingSymbols2553.js` resta la fonte codici — non duplicarlo.
- Pipeline ingest documenti/certificati/WPS **non** si clona: si **chiama** extract+persist da un servizio nuovo (e, se naturale, 5 righe *dopo* un ingest norma già riuscito — senza refactor della pipeline).

### DoD

1. Servizio `figureIngest.service.js` (o nome equivalente): input `organizationId` + path PDF → extract figure → `persistFigures`. Org dal chiamante/JWT, mai dal client come id libero.
2. PDF senza figure → `{ figures: [] }` / zero insert, exit ok, niente 500.
3. Test L1 Jest: fixture ReportLab già in `pdf_to_json/tests` (o mock dello spawn extract); persist chiamato con `organization_id` e `embedding_space`; org A non scrive/legge org B. **Mock CLIP** — niente download pesi. Nessun PDF copyright in Git.
4. Entrypoint unico: `POST /api/v1/ai/figures/ingest` (stessa auth/licenza `ai_chat` o admin già usata in AI) **oppure** hook minimo post-ingest norma. Multipart o path server già autorizzato; niente upload cloud.
5. Nuovi `.js` in `backend/src/` aggiunti a `deploy-manifest.json`.
6. **Un** Bugbot solo a slice chiusa (L1 verde).
7. Nessun Gemini sui byte tavola; non aprire MR-4/MR-5.

### File previsti (disgiunti — tocca SOLO questi)

- `backend/src/services/figureIngest.service.js` (**nuovo**, colla MR-0+MR-1)
- `backend/src/services/figureIngest.service.test.js`
- `backend/src/controllers/figureKnowledge.controller.js` + test (aggiungere ingest)
- `backend/src/routes/aiChat.routes.js` (POST ingest)
- `backend/scripts/deploy-manifest.json` (riga del service nuovo)
- *Opzionale, max ~15 righe:* `backend/src/services/normIngest.service.js` solo chiamata dopo successo, senza cambiare lo staging/OCR

### Cosa NON toccare

- `documentIngestPipeline.service.js` (niente fork, niente copia)
- `knowledgeIndexer.service.js` / Gemini / `knowledge_chunks`
- `extract_figures.py` / CLI MR-0 (riusare, non riscrivere)
- `figureEmbed.service.js` (già fatto; mock nei test)
- UI Assistente (`AiAssistantPage`, `AiAssistantCitations`)
- `weldingSymbols2553.js`, PDF in `docs/Normative/`
- migrazioni SQL (154 già c’è)
- `DEPUTYTASK.md` e altri slot
- `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md` (bozza 5 righe qui sotto; sync **dopo merge**)
- PR aperte MC (`materialCertificates.*`)

### Verifica

```bash
cd backend && npx jest src/services/figureIngest.service.test.js src/controllers/figureKnowledge.controller.test.js --forceExit
```

Senza rete, senza download CLIP.

### Chiusura

- Spunta DoD MR-3 nel PLAN. **Non** aprire MR-4.
- PR Medio; 1 Bugbot; Cloud Agent **non** mergia.
- Chiudi con **TEST OK** o **FIX NON APPLICABILI**.

### Bozza hub (dopo merge, non in questa PR codice)

- GUIDA: ingest figure = extract locale + persist CLIP; stesso tenant; AI non certifica.
- Roadmap: una riga MR-3 + priorità RAG aggiornata.

---

## Comando per il deputy

Leggi `docs/agent-tasks/DEPUTYTASK5.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI. Non aprire MR-4. Non toccare GUIDA né roadmap. Un solo Bugbot a slice chiusa.
