# DEPUTYTASK — Import cartella: tutti i tipi di file

**Stato:** CHIUSO — TEST OK L1 (20/08/2026)  
**Aperto:** 20/08/2026  
**Chiuso:** 20/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Rischio:** Medio — Cloud **non** mergia.

---

## Esito

- Path relativo per qualsiasi estensione
- Multer accetta tutti i file
- FE tiene docx/xlsx/dwg/immagini/PDF; salta solo Thumbs.db / .DS_Store
- Estrazione testo solo sui PDF
- Screening anche senza testo (nome/cartella)

«Carica PDF» resta solo PDF. Dopo merge: deploy VPS (stessi file import).
