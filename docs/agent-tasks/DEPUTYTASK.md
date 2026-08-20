# DEPUTYTASK — Ingest archivio IA-5 (screening + posa)

**Stato:** CHIUSO — TEST OK, mergiata [#509](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/509) (20/08/2026)  
**Aperto:** 20/08/2026  
**Chiuso:** 20/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Rischio:** Medio — Cloud **non** mergia.

---

## Esito IA-5

- Helper `screenImportFile` (path + nome + testo corto)
- `POST /import-jobs/:id/screen-and-place`
- Auto-posa solo `confidence=high` + tipo mappato + azienda + non-qualifica
- Guess in `ai_extraction_json.screening`
- Pulsante **Screening e posa** in Import PDF
- **Non** caso Riesame (IA-6), **non** coda admin (IA-5b)

Prossima: **IA-5b** (coda «da completare»).

---

## Bozza sync hub (questa PR, chat sola)

- Roadmap: IA-1–IA-5 in `main` (#506/#507/#509). Prossima IA-5b.
- GUIDA: Carica cartella + Screening e posa; path in `original_name`; posa solo con azienda.
