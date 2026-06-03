# DEPUTYTASK — Visualizzazione Excel in-app

**Stato:** TEST OK (L1 + smoke file SAVECO scadenzario) — in attesa merge PR  
**PR:** [#93](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/93)

## Completato

| Step | Esito |
|------|-------|
| `DocFileDialog` → `SpreadsheetViewer` (no Office Online) | ✅ |
| `SpreadsheetViewer` → `getDocFileBlob` (auth come PDF/Word) | ✅ |
| Test L1 `spreadsheetViewer.test.jsx` | ✅ 10/10 |
| Build Vite | ✅ |
| Smoke file SAVECO scadenzario (71 KB, 4 fogli SheetJS) | ✅ |

## Smoke utente post-merge (org Camellini / QS)

1. Registro documenti → Ambito **SAVECO**
2. Documento **Scadenzario** (SC01) → Allegato → **Visualizza**
3. Atteso: overlay tabella con fogli TO_DO, SCADENZARIO, … (no errore Office Online)
