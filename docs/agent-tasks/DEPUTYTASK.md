# DEPUTYTASK — Import cartella: tutti i tipi + screening a campioni

**Stato:** CHIUSO — TEST OK L1 (20/08/2026)  
**Aperto:** 20/08/2026  
**Chiuso:** 20/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**PR:** [#511](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/511)  
**Rischio:** Medio — Cloud **non** mergia.

---

## Esito

- Path relativo per qualsiasi estensione; Multer e FE tengono docx/xlsx/dwg/immagini/PDF
- Estrazione testo: PDF, Word, Excel, txt (immagini/DWG: nessun testo, OCR = IA-8)
- Screening: 30 → 90 → 200 righe, tetto 8 000 caratteri; stop quando il tipo non è più `low`
- Pulsante «Estrai testo» (non più «solo PDF»)

L1: `importExtractText`, `importProgressiveScreen`, `importScreening`, `importJobs.controller` — 41 verdi.

Dopo merge #511: deploy VPS 20/08 PID `1108923`→`1134259`, health 200. Manifest: `importExtractText.js` + `importProgressiveScreen.js`. Bugbot/Security non comparsi; merge umano.
