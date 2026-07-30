# DEPUTYTASK1 — P2 Export Word WPS (modulo ISO 15609-1 Annex A)

**Stato:** CHIUSO  
**Priorità:** P2 — chiude il giro Mason (genera → bozza → **documento stampabile/archiviabile**)  
**Branch:** `cursor/wps-export-word-annex-a-9fe8`  
**Chiuso da:** Deputy 30/07/2026  
**Esito:** TEST OK — export FE programmatico (`wordExportWps.js`, opzione A), pulsante «Word» su riga WPS, Vitest 4/4 + build.

## Consegna v1

| Elemento | Path / nota |
|----------|-------------|
| Export Annex A | `app/src/utils/wordExportWps.js` (`generateWpsAnnexABlob` / `exportWpsAnnexADocx`) |
| UI | `WeldingProceduresPage.jsx` — azione «Word» per riga (campi vuoti se assenti, nessun blocco) |
| Test L1 | `app/src/tests/wordExportWps.test.js` |
| Spec | P2 ✅ v1 in `MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md` |

**Fuori v1 (P2b):** deprecazione `WpsUploadButton`, campi Annex A extra in DB, export WPQR, sketch immagine.
