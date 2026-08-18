# DEPUTYTASK5 — Multimodal RAG MR-0: estrai figure + bbox (pdf-to-json, locale)

**Stato:** APERTO  
**Aperto:** 18/08/2026 (Lead wayfinder — Chart the map Multimodal RAG)  
**Piano:** [`PLAN_MULTIMODAL_RAG_SLICES.md`](PLAN_MULTIMODAL_RAG_SLICES.md)  
**Spec:** skill [`pdf-to-json`](../../.cursor/skills/pdf-to-json/SKILL.md) · `backend/scripts/pdf_to_json/README.md`  
**Rischio:** Medio — PR + gate Bugbot; **non** push su `main`; **non** toccare `DEPUTYTASK.md` (SAL S1a ancora APERTO)

---

## Slice unica di questa sessione: MR-0

**Obiettivo**: estendere il tool locale `pdf-to-json` così, su un PDF di prova, estrae le tavole (immagini raster *e* regioni vettoriali) con bounding box e le scrive su disco. Nessun embedding, nessun DB, nessuna UI. Tutto offline.

### Contesto (non riscrivere)

- Oggi il tool fa testo + tabelle + OCR locale. **Non** emette figure/bbox (`README.md`, `extract.py`)
- Motore già in requirements: pymupdf, Pillow, reportlab. Usali. Niente nuove API cloud
- ISO 2553 in officina è spesso **vettoriale**: `page.get_images()` da solo non basta — servono anche cluster di `page.get_drawings()` rasterizzati
- Catalogo `weldingSymbols2553.js` esiste già: **non** duplicarlo e **non** importarlo in questa slice
- PDF norma reale = copyright: **non** committarlo. Fixture sintetica nel package test

### DoD

1. Flag CLI `--extract-figures` (default off): accanto a `.md`/`.json` crea `figures/` + `*.figures.json`
2. Ogni figura: `id`, `page` (1-based), `bbox` `[x0,y0,x1,y1]` in punti pagina, `kind` `raster|vector`, `path` relativo al PNG, `caption` se c’è testo vicino (best-effort, può essere null)
3. Raster: immagini XObject pymupdf + bbox reale di pagina (non solo xref)
4. Vector: raggruppa drawing vicini, scarta rumore (linee isolate / footer), rasterizza la regione in PNG
5. Test L1 con PDF fixture generato in-process (reportlab: una pagina testo + un rettangolo/simbolo disegnato + un’immagine raster minima). Almeno 1 raster e 1 vector, bbox non degeneri, PNG esistenti e non vuoti
6. Pagina senza figure → `figures: []`, exit 0
7. README del tool + riga nella skill: documentare il flag; restare «nessuna chiamata cloud»
8. Nessun commit di PDF coperti da copyright, di modelli, di `.venv`, di segreti

### File previsti

- `backend/scripts/pdf_to_json/extract_figures.py` (o nome equivalente nello stesso package)
- `backend/scripts/pdf_to_json/extract.py` / `cli.py` — solo aggancio flag, non riscrivere il testo
- `backend/scripts/pdf_to_json/tests/` — fixture + assert
- `backend/scripts/pdf_to_json/README.md`
- `.cursor/skills/pdf-to-json/SKILL.md` — una sezione breve sul flag

### Cosa NON toccare

- `knowledgeIndexer.service.js`, `normChunker.service.js`, adapter Gemini/embedding
- Migrazioni / `knowledge_chunks` / nuova tabella (è MR-1)
- UI, Assistente AI, ingest commesse, WPS
- `weldingSymbols2553.js` e i Markdown in `docs/Normative/`
- `DEPUTYTASK.md` (SAL S1a)
- Slice MR-1…MR-5

### Verifica

```bash
# dalla root repo, Python del progetto (stesso della skill pdf-to-json)
python -m backend.scripts.pdf_to_json.tests.test_extract_figures
# oppure pytest sul package tests/ se è già il runner
```

Adattare al runner già usato da `backend/scripts/pdf_to_json/tests/`. Deve girare **senza rete**.

### Chiusura

- Aggiorna PLAN: spunta DoD MR-0; next brief = MR-1 su un nuovo `DEPUTYTASK5.md` (sovrascrivi questo file solo a slice chiusa) oppure lascia handoff
- PR livello Medio + gate Bugbot
- Chiudi con **TEST OK** o **FIX NON APPLICABILI** + handoff se incompleto

---

## Comando per il deputy

Leggi `docs/agent-tasks/DEPUTYTASK5.md` ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI. Non aprire MR-1.
