# Piano slice — Tavole delle norme PDF in Assistente

> **Destinazione**: carichi una **norma PDF** (stesso pulsante di oggi). Dopo il commit, le **tavole** sono in `knowledge_figures` (stesso tenant). In Assistente: domanda di testo → miniatura della tavola citata; ritaglio PNG → confronto CLIP + commento VLM. L’AI **cita** l’immagine in archivio, non la inventa e **non** certifica WPQR/patentino.
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · MR-0…MR-5 già mergiati · ingest norme `commitNormFromFields` · `ingestFiguresFromPdf` (MR-3)
> **Brief pronto**: [`DEPUTYTASK_FIGURE_WPQR.md`](DEPUTYTASK_FIGURE_WPQR.md) — slice **FW-0**. **Non** APERTO (solo docs in questa sessione).
> **Mappa aggiornata**: 20/08/2026 (Lead — riscrittura dopo HITL: buco = ingest norma senza CLIP, non gli slot WPQR)
> **Dipende da**: MR-5 mergiato (#492)

---

## Perché questa riscrittura

L’epic visiva→WPQR (slot JSON, candidati anagrafica) **non è il primo bisogno**.
Il bisogno è: *«chiedo una cosa sulla norma e vedo la tavola; carico un ritaglio e l’assistente confronta con quello che abbiamo già, senza allucinare»*.

Oggi Ask+immagine **funziona solo se** le tavole sono già in `knowledge_figures`. Il pulsante Norme **non** le scrive. `POST /ai/figures/ingest` esiste ma **non è agganciato**.

---

## Fuori scope

- Far dire al VLM «sì/no siete qualificati» o certificare WPQR/patentino/WPS
- Collegare CLIP a WPQR, WPS, patentini, 3.1, allegati NC (non sono il caso d’uso)
- Parser CAD, Gemini/cloud sui PNG
- Allegati generici nella textarea (resta **solo testo**; ritaglio = bottone PNG/JPEG/WebP già in composer)
- Nuova pagina o secondo Assistente
- Inventare soglie ISO assenti da Markdown/codice
- Backfill di tutte le norme già in registro (nebbia: dopo FW-0 se serve)

---

## Non ancora specificato

- Backfill PDF norme già committati senza tavole CLIP
- Se mostrare in revisione ingest «N tavole estratte» (oggi silent)
- Collegamento visivo → candidati WPQR (ex FW-1…3): **parcheggiati**, solo dopo che le tavole arrivano dalle norme

---

## Decisioni già prese (HITL 20/08)

- **Prima le tavole dalle norme**, poi eventuale WPQR
- **Riuso MR-3**: `ingestFiguresFromPdf` dopo il commit norma, stesso `organization_id`
- **Fallimento CLIP non blocca** il commit norma (log + lista vuota)
- **Textarea Assistente = testo**; immagine solo dal bottone ritaglio esistente
- **AI cita, non certifica**

---

## Gap vs funzione attesa

| Aspetto | Oggi | Atteso | Slice |
|---------|------|--------|-------|
| Ingest norma PDF | Testo + campi + revisione; niente CLIP | Stesso flusso **più** extract tavole + persist CLIP sullo stesso PDF | **FW-0** |
| Domanda testo → immagine | MR-2, se le tavole esistono | Stesso pannello, alimentato dalle norme caricate | (già fatto; sbloccato da FW-0) |
| Ritaglio → chiarimenti | MR-4+5, bottone composer | Invariato | (già fatto) |
| WPQR da disegno | Non collegato | Parcheggiato | dopo FW-0, brief nuovo |

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **FW-0** | Hook post-commit norma → CLIP | `normIngest.service.js` `commitNormFromFields` (copre auto-commit **e** conferma staging) chiama `ingestFiguresFromPdf`; L1 mock CLIP; PDF senza tavole = `[]` | MR-5 mergiato | AFK |
| **FW-1** | (parcheggio) slot visivi / candidati WPQR | Non aprire in questa epic | FW-0 in uso reale | — |

**Ordine**: solo **FW-0** ora.

**Hello world (FW-0)**: commit di un PDF norma di prova (fixture senza copyright) → `knowledge_figures` ha ≥0 righe per quella org; ingest CLIP in errore → norma comunque salvata.

---

## Allineamento harness

- Una slice = un Cloud Agent. Non eseguire FW-0 nella stessa run che ha solo riscritto il piano (questa).
- Deputy: context default/basso. Solo `DEPUTYTASK_FIGURE_WPQR.md` + file della slice.
- Se FW-0 non chiude: `HANDOFF_TEMPLATE.md` nel brief, stop.
