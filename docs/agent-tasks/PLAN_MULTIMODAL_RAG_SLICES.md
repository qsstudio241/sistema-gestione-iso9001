# Piano slice — Multimodal RAG (figure normative in locale)

> **Destinazione**: l’SGQ ingerisce PDF normativi con tavole (es. simboli saldatura ISO 2553 / AWS A2.4), conserva testo *e* ritagli di figura con bounding box, e li recupera in uno spazio vettoriale **locale** così l’assistente può citare la tavola e, in seguito, confrontarla con un disegno/WPS caricato. Verificabile: dato un PDF di prova, una query testo (e poi una query immagine) restituisce la figura giusta con pagina + bbox, senza chiamate cloud sui byte delle tavole.
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) (AI cita, non certifica; audit trail) · skill [`pdf-to-json`](../../.cursor/skills/pdf-to-json/SKILL.md) · indexer esistente `knowledgeIndexer.service.js` / `knowledge_chunks` · catalogo già in repo [`ISO-2553-simboli-saldatura.md`](../reference/ISO-2553-simboli-saldatura.md) + `weldingSymbols2553.js`
> **Brief attivo**: MR-0 **CHIUSO** (TEST OK, 18/08/2026). Prossima slice **MR-1** (non aperta in questa sessione). `DEPUTYTASK.md` resta SAL S1a, non usarlo.
> **Mappa creata**: 18/08/2026 (Lead wayfinder A — Chart the map)
> **Vincolo prodotto (HITL 18/08)**: sviluppare **tutto in locale** con un modello adatto. I byte delle figure non escono verso Gemini né altri parser cloud.

---

## Fuori scope

- Sostituire `pdf-to-json` (testo/tabelle/OCR locale restano com’è; qui si **estende**)
- Secondo vector store / pgvector / DB nuovo (PLAN_SECOND_BRAIN e PLAN_HARNESS_HARDENING: il RAG testo resta su SQL Server + JSON)
- API cloud di parsing/visione (Unstructured, LlamaParse, Document AI, Gemini sugli *byte figura*)
- Sostituire gli embedding **testo** Gemini già in `knowledge_chunks` (pista parallela; non in questa epic)
- AI che scrive o certifica WPS / conformità / “è questo il simbolo giusto per il giunto”
- Confrontatore CAD nativo (DWG/DXF parser) — solo ritaglio raster/PDF in MR-4
- Multi-tenant: figure di un’azienda visibili a un’altra
- Commitare PDF normativi coperti da copyright nel repo

---

## Non ancora specificato

- Quale PDF “Simboli Saldatura.pdf” userà l’officina in produzione (resta sul PC operatore; i test usano fixture)
- Se/quando sostituire anche il ramo testo Gemini con CLIP locale (nebbia: budget VRAM vs qualità IT)
- UX di confronto WPS↔tavola in pagina WPS (oltre retrieve in Assistente AI)
- Retention/cancellazione file figura su disco vs riga DB
- Soglia di similarità e quante tavole mostrare (top-k) — si misura dopo MR-1

---

## Decisioni già prese

- **Locale-only sulle figure** (18/08, committente) — nessun upload delle tavole a provider cloud
- **Estendere, non sostituire** `backend/scripts/pdf_to_json/` (pdfplumber testo + pymupdf fallback già in tool)
- **Due spazi vettoriali**: testo Gemini in `knowledge_chunks` (invariato); figure in tabella nuova `knowledge_figures` con colonna `embedding_space` (niente mix di dimensioni/modelli)
- **Estrazione bbox**: pymupdf — `page.get_images()` + bbox per raster; cluster di `page.get_drawings()` rasterizzati in PNG per tavole vettoriali (ISO 2553 è spesso vettoriale, non una JPEG)
- **Embedding locale**: adapter dedicato, default `jinaai/jina-clip-v2` (stesso spazio query testo ↔ crop figura, IT+EN). Override env. Fallback `clip-ViT-B-32` se la macchina deputy non regge
- **Vedere (generazione)**: Ollama `qwen2.5vl:7b` in MR-5, sui crop già recuperati — non a ingest
- **Catalogo 2553 esistente** (`weldingSymbols2553.js`) resta la fonte simboli/codici; il RAG visivo lo affianca, non lo duplica come truth
- **Nessun numero di migrazione riservato** in anticipo (sequenza condivisa `database/migrations/`)
- **MR-0 non tocca** indexer, Gemini, UI, SQL
- **MR-0 chiuso (18/08)** — CLI `--extract-figures` + `extract_figures.py`: raster (`get_images` + bbox pagina) e cluster `get_drawings()` → PNG + `*.figures.json`. Fixture ReportLab, test L1 unittest senza rete. Nessun embed/DB/UI.

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **MR-0** | Hello world: estrai figure + bbox da un PDF | `backend/scripts/pdf_to_json/` (`extract_figures.py`, CLI `--extract-figures`, fixture ReportLab, test, README) | — | AFK, **fatto** |
| **MR-1** | Persisti + embed locale + GET retrieve testo→figura | migrazione `knowledge_figures` + service embed locale + GET `/api/…` (isolation `organization_id`) + test L1 con vettori mock/reali corti | MR-0 | AFK |
| **MR-2** | UI: query testo cita la tavola | `AiAssistantPage` (o pannello citazioni esistente): crop + pagina + bbox; niente nuovo layout di prodotto | MR-1 | AFK |
| **MR-3** | Ingest norma → extract + embed | aggancio pipeline/job su PDF normativo; riuso MR-0+MR-1; niente fork `documentIngestPipeline` | MR-1 | AFK |
| **MR-4** | Query visiva (disegno → simboli) | upload ritaglio/pagina; stesso spazio CLIP; top-k figure; test L1 con due crop della fixture | MR-1 | AFK |
| **MR-5** | VLM locale risponde con figure citate | Ollama `qwen2.5vl:7b` + crop recuperati + `logAiInteraction`; AI cita, non certifica (ADR-010) | MR-2, MR-4 | AFK |

**Ordine**: MR-0 → MR-1 → poi MR-2 e MR-3/MR-4 possono parallellizzarsi su file disgiunti (UI vs ingest vs query visiva). MR-5 per ultimo.

**Hello world (MR-0)**: **fatto.** Dalla CLI, su un PDF fixture con almeno una tavola disegnata, escono PNG + JSON `{page, bbox, kind: raster|vector, caption?}` senza rete.

### DoD MR-0 (spuntato 18/08/2026)

- [x] Flag CLI `--extract-figures` (default off): `figures/` + `*.figures.json`
- [x] Ogni figura: `id`, `page`, `bbox`, `kind` `raster|vector`, `path`, `caption` best-effort
- [x] Raster: XObject + bbox di pagina (non solo xref)
- [x] Vector: cluster `get_drawings()`, rumore scartato, PNG
- [x] Test L1 fixture ReportLab: ≥1 raster e ≥1 vector, bbox non degeneri, PNG non vuoti
- [x] Pagina/PDF senza figure → `figures: []`, exit 0
- [x] README + skill; nessuna chiamata cloud
- [x] Nessun PDF copyright / modelli / `.venv` / segreti

---

## Architettura target (vincolo, non da implementare in MR-0)

```
PDF norma (operatore)
    → pdf-to-json testo/md/json          (già esiste, locale)
    → pdf-to-json figures/ + figures.json (MR-0: bbox + PNG)
    → knowledge_figures + CLIP locale     (MR-1)
    → retrieve testo (MR-1/2) | retrieve immagine (MR-4)
    → (MR-5) Ollama VLM sui crop, citazioni, HITL umano
```

Non aprire un secondo “cervello”. Stesso assistente, stesse regole di Ambito.

---

## Allineamento harness

- Una slice = un Cloud Agent. Non eseguire MR-1 nella stessa run di MR-0.
- Deputy: context default/basso. Solo `DEPUTYTASK5.md` + file della slice.
- Se MR-0 non chiude: `HANDOFF_TEMPLATE.md` nel brief, stop.
