# DEPUTYTASK — ADR-013 Scadenzario Unificato

**Stato:** CHIUSO — ADR-013 S1-S7 + fix UX scadenzario filtri/link su `main`

---

## Lavoro completato

### Slices S1, S2, S5 (commit iniziali)
- `backend/src/utils/excelDeadlineDetector.js` — detector euristico Excel/CSV (S1)
- `backend/scripts/run-migration-083-vps.js` + migrazione eseguita sul VPS — tabelle `deadline_items`, `deadline_import_config` (S2)
- `app/src/components/DataGridExportable.jsx` — DataGrid con export Excel (S5)

### Slices S3, S4, S6, S7 (commit successivi)
- `backend/src/controllers/deadlines.controller.js` — detect, import, list, priority, CRUD (S3+S4)
- `backend/src/routes/deadlines.routes.js` + registrazione in `server.js` (S3+S4)
- `app/src/services/apiService.js` — metodi deadline (S6)
- `app/src/components/DeadlineImportDialog.jsx` + `.css` (S6)
- `app/src/pages/DeadlinesPage.jsx` + `.css` — pagina `/deadlines` (S6)
- `app/src/components/DocFileDialog.jsx` — trigger detect dopo upload Excel (S6)
- `app/src/components/DocumentRegistry.jsx` — sezione scadenze in PriorityView (S7)
- `app/src/App.jsx` + `AppLayout.jsx` — route e menu "Scadenzari" (S7)
- `backend/scripts/deploy-manifest.json` aggiornato

### Fix finale (ultimo commit)
- `findColumnByPattern` refactored: scansione per pattern (priorità) invece che per colonna
  → "prossima" (data futura) selezionata prima di "ultima" (data passata)

## Smoke test VPS — PASS ✓
File: `Scadenzario Sicurezza-Ambiente_2026-04-24_greta (1).xlsx` (org 1002, doc 1698)
- `detectDeadlines` → `isDeadlineFile=true`, sheet=SCADENZARIO, date=prossima, conf=0.70
- `importDeadlines` → 52 righe inserite, 19 saltate (senza data), status 200
- `listDeadlineItems` → OK
- `getPriorityDeadlines` → OK (scadenze attive restituite)

## Slices rimanenti (da pianificare)
- S8: notifiche email scadenze imminenti
- S9: cascade delete deadline_items quando documento/azienda eliminati
- S10: auto-refresh items all'aggiornamento del file sorgente

## Chiusura sessione (09/06/2026)
- PR #100 mergiata con `--merge` su `main` (commit `f320075`)
- `git pull origin main` eseguito — workspace allineato
- `docs/GUIDA_CONSOLIDATA.md` aggiornato con lezioni ADR-013
- Prossime slices (S8/S9/S10) tracciate in `PROJECT_ROADMAP.md`

## Chiusura sessione filtri/link scadenzario (09/06/2026)
- Fix UX ripristinato direttamente su `main`: commit `a1c4cc1` (`feat: standardizza filtri scadenzario`) e `fecf114` (`docs: documenta pattern scadenzario`).
- Comportamento atteso: le card riepilogo `/deadlines` filtrano come nel modulo NC; la colonna "File origine" apre il documento con deep link Registro Documenti.
- Smoke UI eseguito con mock API locale: filtri Scadute/In scadenza/Completate/Attive OK; link file origine OK.
- Regola operativa: ripristini UI/scadenzario non devono toccare password o hash utenti. Le credenziali sono ambito separato e vanno modificate solo su richiesta esplicita.
- TEST OK.
