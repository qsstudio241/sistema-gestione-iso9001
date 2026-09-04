# DEPUTYTASK_VIEWER_CHROME — Chrome unico anteprima documenti

**Stato:** APERTO  
**Aperto:** 04/09/2026  
**Rischio:** Medio — UI additiva viewer + regola/docs; niente auth/sync/DB  
**Branch:** `cursor/doc-viewer-chrome-std-b42c`

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK_VIEWER_CHROME.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Perché

Word ha già «Schermo intero»; PDF e Excel restano stretti. Il committente vuole lo **stesso chrome** su tutti i viewer in-app e la regola «standardizzazione sempre quando possibile».

## DoD

- [ ] PDF, Word, Excel: Chiudi + Scarica (se previsto) + Schermo intero / Riduci
- [ ] Schermo intero = overlay viewport (classe CSS), non Fullscreen API, non finestra Windows
- [ ] Nessun look OS (─ □ ✕)
- [ ] `DocFileDialog` e `IngestDialogShell` non convertiti a fullscreen viewer
- [ ] Regola Cursor + riga in `LIBRERIA_UI_SGQ.md`
- [ ] Test L1 sul toggle/classe fullscreen

## File previsti

- `app/src/components/DocumentViewerChrome.jsx` (nuovo)
- `app/src/components/DocumentPdfViewer.jsx` + `.css`
- `app/src/components/DocumentDocxViewer.jsx`
- `app/src/components/SpreadsheetViewer.jsx` + `.css`
- `app/src/tests/documentViewerChrome.test.jsx`
- `app/src/tests/documentPdfViewer.chrome.test.jsx`
- `app/src/tests/spreadsheetViewer.test.jsx`
- `docs/reference/LIBRERIA_UI_SGQ.md`
- `.cursor/rules/sgq-document-viewer-chrome.mdc`
- `app/src/design-system/README.md` (1 riga overlay)
- `docs/agent-tasks/DEPUTYTASK_VIEWER_CHROME.md`

## Cosa NON toccare

- `DocFileDialog.jsx` (form file, non viewer)
- `IngestDialogShell.jsx` (ha già il suo expand)
- `DEPUTYTASK.md` e altri slot APERTO
- auth / sync / backend / migrazioni

## Handoff / GUIDA (bozza se parallelo)

- **Lezione**: nuovo viewer = stesso `DocumentViewerChrome`; vietato terzo layout e pulsanti OS.
- **Roadmap**: 1 riga «chrome unico anteprima documenti» dopo merge se c'era parallelo.
