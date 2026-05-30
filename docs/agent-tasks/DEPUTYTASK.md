# DEPUTYTASK — CHIUSO (TEST OK)

**Sessione:** 30/05/2026 — Modulo Documenti: upload, download, risultati norme batch.

## Obiettivo

Diagnostica e fix caricamento/upload in DocumentRegistry, DocumentTree, API allegati documenti.

## Root cause individuate

| Problema | Causa | Fix |
|----------|--------|-----|
| Download / link «Scarica» e Office Viewer su file registro | Route `GET /documents/:id/file/download` usava solo `authenticate` (Bearer); `?token=` ignorato | `authenticateDownload` su route download in `docfile.routes.js` |
| Scarica da DocFileDialog fragile senza token in URL | `<a href>` con `?token=` da localStorage | `apiService.downloadDocFile()` via fetch + Bearer + blob |
| Risultati upload norme batch senza titolo/codice in UI | API restituiva metadati solo in `metadata.{...}` | `flattenNormUploadEntry` backend + `normalizeNormUploadResults` frontend |
| Refresh albero dopo batch fallito | `onUploadComplete` sempre chiamato | Callback solo se `countNormUploadSuccesses > 0` |
| Pulsanti norme non visibili con cartella selezionata nell'albero | `isNormsFolder` leggeva solo ultimo breadcrumb (documento) | Usa `tree.selectedNode` se `doc_type === 'folder'` |
| Sottocartelle in lista centrale non navigabili | Click apriva pannello dettaglio invece di entrare in cartella | Click su `doc_type === 'folder'` → `handleTreeNodeSelect` |

## File modificati

- `backend/src/routes/docfile.routes.js`
- `backend/src/controllers/normUpload.controller.js`
- `backend/src/config/multer.js` (export unico)
- `app/src/services/apiService.js`
- `app/src/components/DocFileDialog.jsx`
- `app/src/components/NormUploadButton.jsx`
- `app/src/components/DocumentRegistry.jsx`
- `app/src/utils/normUploadResults.js` (nuovo)
- `app/src/tests/normUploadResults.test.js` (nuovo)

## Test L1 eseguiti

| Suite | Esito |
|-------|--------|
| `app` — `normUploadResults.test.js` (3) | **PASS** |
| `app` — `normUploadButton.test.jsx` + `documentRegistryFile.test.js` (15) | **PASS** |
| `backend` — `document.controller.test.js` + `documentRegistryFile.test.js` (11) | **PASS** |

## Smoke manuale

- `GET https://www.fr-busato.it:8443/api/v1/health` → `status: healthy`, DB OK (30/05/2026).
- **Deploy VPS backend**: dopo push, copiare `docfile.routes.js` e `normUpload.controller.js` + restart `sgq-backend` (script deploy o scp noto in guida).

## Verifica operativa consigliata (L3)

1. Registro documenti → tab **Albero** → cartella **NORME E LEGGI** → upload 1 PDF batch → verificare titolo/codice nei risultati e documento in lista.
2. Aprire **Allegato** su un documento → **Scarica** e **Visualizza PDF** senza errore 401.
3. Sottocartella nella lista centrale: click sulla riga cartella → entra nella cartella (non pannello dettaglio documento).

## Commit / push

- **Hash:** `1c602b9` — `fix(documenti): upload/download registro e risultati norme batch`
- **Push:** `origin/main` OK (`5aca078..1c602b9`)

*Aggiornato 30/05/2026 — TEST OK.*
