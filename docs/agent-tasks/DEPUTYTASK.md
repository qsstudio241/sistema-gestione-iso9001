# DEPUTYTASK — Import cartella: piano di carico (lotti da 80)

**Stato:** APERTO  
**Aperto:** 21/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)  
**Rischio:** Medio — solo FE (inventory/piano/lotti); tetto server 80 invariato; Cloud **non** mergia.  
**Branch:** `cursor/import-folder-plan-d492`

---

## Perché

Utente sproveduto sceglie `Documenti` (anche 1473 file). L’app non deve caricare subito: mostra un piano, aspetta conferma, poi lotti da 80. Priorità: cartelle riconoscibili (Capitolati/commessa) prima di Scan, per arrivare presto ai file di commessa.

## File previsti

- `app/src/utils/importFolderUpload.js`
- `app/src/utils/importFolderPlan.js`
- `app/src/tests/importFolderUpload.test.js`
- `app/src/tests/importFolderPlan.test.js`
- `app/src/pages/ImportJobsPage.jsx`
- `app/src/pages/ImportJobsPage.css`
- `app/src/tests/importJobsPage.folderPlan.test.jsx`

## Cosa NON toccare

contractReview, MC, SAL, OCR, tetto 80 server, unificare mappe folder, `PROJECT_CONTEXT.md`, GUIDA/roadmap (bozza sotto: altri agent sullo stesso repo).

## Slice

1. Dopo picker + consenso Chrome: **non** upload subito. Inventory in browser (FileList + webkitRelativePath): conta, somma size, raggruppa per cartella di primo livello, salta junk come `takeImportFiles`.
2. Piano visibile: totale file+MB; tabella cartelle (nome, n., size, label onesta path-only); «Servono N lotti da 80. Tempo orientativo: …».
3. Checkbox per cartella (default tutte). **Carica i lotti selezionati** / Annulla piano (torna a 0, nessun upload).
4. Conferma → upload sequenziale lotti da 80. Ordine: tipi indovinati (capitolato/commessa in testa), poi altro. Stessa `company_id`. Titoli `Documenti / Capitolati (1/2)` o `Documenti 3/19`.
5. Avanzamento «Lotto 3/19 — Procedure». Annulla = stop lotti successivi (non cestino). Lotti già caricati restano.
6. Gate azienda già in vigore: senza `company_id` niente picker.

## Bozza hub (dopo merge)

- GUIDA: Import cartella mostra piano di carico prima dell’upload; lotti da 80; Annulla ferma i successivi.
- Roadmap § Stato attuale: una riga su piano di carico Import cartella.
