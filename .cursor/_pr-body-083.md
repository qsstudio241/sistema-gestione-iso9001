## Slice implementate (ADR-013 - Scadenzario Unificato)

### S1 - Detector Excel backend
- `xlsx` aggiunto a `backend/package.json` (stessa versione gia usata nel frontend)
- `backend/src/utils/excelDeadlineDetector.js`: euristica pattern matching su header + verifica contenuto date + confidence score (alta/media/bassa)
- `backend/src/utils/excelDeadlineDetector.test.js`: **27 test Jest tutti verdi** (tarature IT, polizze IT, Due Date EN, file non-scadenzario, multi-foglio, edge case)

### S2 - Migrazione DB 083 (solo file, non eseguita)
- `backend/scripts/run-migration-083-vps.js`: crea `deadline_items` + `deadline_import_config` con tutti i constraint FK, CHECK e indici filtrati per `status = active`
- Idempotente via `IF NOT EXISTS` su ogni step
- Da eseguire quando S3/S4 (endpoint API) saranno deployati

### S5 - Componente DataGridExportable
- `app/src/components/DataGridExportable.jsx`: wrapper di SgqDataGrid con toolbar filtri e pulsante export Excel via SheetJS
- Props: `columns`, `data`, `filters`, `exportFileName`, `renderCell`, `getExportValue` (hook per valori raw)
- Export rispetta i filtri attivi, formatta date come DD/MM/YYYY, adatta larghezza colonne
- CSS standalone, responsive mobile

## Test plan
- [x] Jest L1: 27/27 test verdi su `excelDeadlineDetector.test.js`
- [ ] Build Vite frontend (Netlify CI)
- [ ] DataGridExportable: smoke visivo su pagina di test (S6)
- [ ] Migrazione 083: eseguire su VPS solo dopo deploy S3/S4
