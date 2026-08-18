# DEPUTYTASK5 — Multimodal RAG MR-1: persisti + embed locale + GET testo→figura

**Stato:** CHIUSO — TEST OK (18/08/2026, [PR #469](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/469)). **Non aprire MR-2** in questa run.  
**Aperto:** 18/08/2026 (Lead wayfinder B — Work through the map, dopo merge MR-0 [PR #464](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/464))  
**Piano:** [`PLAN_MULTIMODAL_RAG_SLICES.md`](PLAN_MULTIMODAL_RAG_SLICES.md)  
**Spec:** ADR-010 (AI cita, non certifica) · `knowledgeIndexer.service.js` (RAG testo Gemini, **invariato**) · MR-0 `extract_figures.py`  
**Rischio:** Medio — migrazione **additiva** + endpoint GET; PR + gate Bugbot; **non** push su `main`; **non** toccare `DEPUTYTASK.md` (SAL S1a ancora APERTO)

---

## Esito (18/08/2026)

**TEST OK.** Slice MR-1 implementata:

- Migrazione `database/migrations/153_knowledge_figures.sql` + runner `backend/scripts/run-migration-153-vps.js` (non applicata da Cloud)
- Adapter CLIP locale `figureEmbed.service.js` (L1 mock; runtime senza pesi → `FIGURE_EMBED_UNAVAILABLE` / GET 503)
- Persist + search `figureKnowledge.service.js` (isolamento `organization_id` + `embedding_space`)
- GET `/api/v1/ai/figures/search?q=` su `aiChat.routes.js` (JWT + licenza `ai_chat`)
- Jest: 9 test verdi + uniqueness migrazione 153

**Non aperto MR-2.** `DEPUTYTASK.md` (SAL S1a) non toccato.

Dopo merge di questa PR: SCP + `run-migration-153-vps.js` su TEST poi PROD. Poi (run **nuova**): aprire MR-2.

---

## Slice unica di questa sessione: MR-1

**Obiettivo**: dato l’output MR-0 (`*.figures.json` + PNG), salvare le figure in SQL Server (`knowledge_figures`), calcolare embedding **locale** (stesso spazio testo↔immagine) e restituire le tavole giuste con un GET testo→figura, isolate per `organization_id`. Nessuna UI. Nessun Gemini sui byte delle tavole.

### Contesto (non riscrivere)

- MR-0 è su `main`: CLI `--extract-figures` scrive `figures/` + `*.figures.json` (`id`, `page`, `bbox`, `kind`, `path`, `caption`)
- RAG testo esistente: `knowledge_chunks.embedding` = JSON Gemini (`aiProviderAdapter.embed`). **Non** mescolare dimensioni/modelli
- Decisioni chiuse: tabella nuova `knowledge_figures` + colonna `embedding_space`; default `jinaai/jina-clip-v2` (IT+EN); override env; fallback `clip-ViT-B-32` se VRAM stretta
- Catalogo `weldingSymbols2553.js` resta la fonte codici — **non** duplicarlo
- Cosine similarity già in `knowledgeIndexer.service.js` (`cosineSimilarity`) — riusare (export o copia minima), non riscrivere il RAG testo
- Cartella migrazioni canonica: **`database/migrations/`** (root). `backend/database/migrations/` è morta. **Nessun numero riservato in anticipo**: prendere il prossimo libero su `origin/main` al momento del commit (`ls database/migrations/ | sort`; oggi l’ultimo è **152**, buco 150 storico)
- Cloud Agent **non** raggiunge SQL Server: scrivere SQL + `run-migration-NNN-vps.js`; **non** applicare la migrazione da questa VM

### DoD

1. Migrazione idempotente `153_knowledge_figures.sql` (IF NOT EXISTS): tabella `knowledge_figures` con almeno  
   `id`, `organization_id` NOT NULL, `company_id` NULL, `source_pdf`, `page` (1-based), `bbox` (JSON `[x0,y0,x1,y1]`), `kind` (`raster`\|`vector`), `caption` NULL, `png_path`, `embedding` NVARCHAR(MAX) NULL (JSON float[]), `embedding_space` NVARCHAR NOT NULL, `created_at`. Indice `(organization_id, embedding_space)`. Niente `ON DELETE CASCADE` avventato. Niente `GO` se lo script VPS splitta su `IF NOT EXISTS`
2. Runner `backend/scripts/run-migration-153-vps.js` sul pattern 149/152 (PROD + `SGQ_MIGRATION_TARGET=test`)
3. Adapter embed locale (`figureEmbed.service.js` o equivalente): interfaccia `embedText` / `embedImage` + getter `embeddingSpace`. Default modello `jinaai/jina-clip-v2`; env override; fallback `clip-ViT-B-32`. **I test L1 usano un mock** (vettori corti finti) — **non** scaricare pesi in CI/Cloud, **non** committare `.venv` / modelli
4. Service persist + retrieve: upsert da lista figure MR-0 (PNG su disco o buffer) → righe con `embedding` + `embedding_space`; `searchFiguresByText(query, organizationId, { companyId, topK })` filtra `organization_id` **e** stesso `embedding_space`, cosine, top-k. Query org A **non** vede righe org B
5. GET autenticato testo→figura (stesso assistente, stessa licenza `ai_chat`): es. `GET /api/v1/ai/figures/search?q=` (query obbligatorio). Scope `organization_id` dal JWT, mai dal client. Risposta: `{ figures: [{ id, page, bbox, kind, caption, path, score, embedding_space }] }`. Vuoto → `{ figures: [] }` 200, non 500
6. Test L1 Jest (mock DB + mock embed): persist scrive `embedding_space`; retrieve testo trova la figura “giusta” (score maggiore); isolamento cross-org; query senza match → lista vuota. `npx jest` sul file toccato
7. Nuovi `.js` in `backend/src/` aggiunti a `backend/scripts/deploy-manifest.json`
8. Nessun Gemini/`aiProviderAdapter.embed` sui PNG; nessuna UI; nessun PDF copyright; gate Bugbot prima di dichiarare la PR pronta

### File previsti

- `database/migrations/153_knowledge_figures.sql` + `backend/scripts/run-migration-153-vps.js`
- `backend/src/services/figureEmbed.service.js` (nome equivalente ok)
- `backend/src/services/figureKnowledge.service.js` (persist + search)
- `backend/src/controllers/` + `backend/src/routes/` — GET search (preferire `aiChat.routes.js` già montato, o file nuovo minimo + `server.js` + manifest)
- test Jest accanto ai service/controller
- `backend/scripts/deploy-manifest.json`

### Cosa NON toccare

- `knowledgeIndexer.service.js` / `normChunker.service.js` / `geminiAdapter.js` / `aiProviderAdapter.js` (salvo **export** di `cosineSimilarity` se già esiste — zero cambi al RAG testo)
- `knowledge_chunks` (niente ALTER, niente INSERT figure lì)
- UI, `AiAssistantPage`, ingest commesse, WPS, `documentIngestPipeline`
- `weldingSymbols2553.js`, Markdown in `docs/Normative/`
- `backend/scripts/pdf_to_json/` (MR-0 chiuso; non rifare extract)
- `DEPUTYTASK.md` (SAL S1a)
- Slice MR-2…MR-5 (niente query immagine, niente Ollama, niente job ingest norma)

### Verifica

```bash
# numero migrazione unico (dopo aver scelto NNN su origin/main)
node backend/scripts/migrationNumberUniqueness.test.js

cd backend && npx jest src/services/figureKnowledge.service.test.js --forceExit
# + test controller se presente
```

Senza rete, senza download del modello. Mock obbligatorio.

### Chiusura

- Aggiorna PLAN: spunta DoD MR-1; **non** aprire MR-2 nella stessa run
- PR livello Medio + gate Bugbot; migrazione VPS **dopo** merge (SCP + runner), non in questa slice se il Cloud non ha ancora il merge
- Chiudi con **TEST OK** o **FIX NON APPLICABILI** + handoff se incompleto

---

## Comando per aprire MR-2 (dopo merge di questa PR — non ora)

Leggi `docs/agent-tasks/PLAN_MULTIMODAL_RAG_SLICES.md` e apri MR-2 in `DEPUTYTASK5.md`.
