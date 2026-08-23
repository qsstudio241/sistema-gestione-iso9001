# DEPUTYTASK2 — CND-4: Template report scope `cnd`

**Stato:** CHIUSO  
**Chiuso:** 23/08/2026  
**Esito:** TEST OK  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md) (HITL 23/08 + estrazione Word: layout = Template report scope `cnd`; placeholder semantici `{pt_acc_l2}`; PDF secondo export dopo CND-4; `.doc` MT → `.docx` una volta)  
**Rischio:** Medio — scope template + eventuale migrazione CHECK; niente auth JWT, niente sync audit, niente `NdtReportsPage`.  
**Parallelo a:** CND-1 (`DEPUTYTASK.md`) e CND-11 (`DEPUTYTASK1.md`) — file **disgiunti**  
**Slot precedente:** SB-1 CHIUSO (16/08)

## Perché

Mason consegna report PT/MT in Word con checkbox. L’app oggi esporta il VT da un file fisso in `public/templates`. Audit e NC usano già **Template report** sul VPS (`GET /report-templates/:id/file`, scope `audit`|`nc`). I CND devono usare **la stessa infrastruttura**, con uno scope `cnd` e una chiave per metodo (VT/MT/PT/UT).

## File previsti

- `app/src/pages/ReportTemplatesAdminPage.jsx` (+ CSS se serve tab)
- `app/src/utils/reportTemplateUpload.js` (marker CND, come NC)
- `backend/src/services/reportTemplate.service.js`
- `backend/src/controllers/reportTemplate.controller.js`
- `app/src/utils/vtWordExport.js` — resolve template VPS per `report_type` (stesso pattern NC), fallback file locale solo offline
- eventuale migrazione **dichiarata prima** in `database/migrations/` se il CHECK `CK_report_templates_scope` va esteso a `'cnd'` (oggi: `audit`, `self_assessment`, `nc`)
- `docs/agent-tasks/DEPUTYTASK2.md`, spunta CND-4 sul PLAN

## Cosa NON toccare

- `NdtReportsPage.jsx` / `.css` (CND-1)
- ingest `report_ndt` / pipeline (CND-11)
- `useNdtAutoSave.js`, `syncService.js` (CND-9)
- Qualifiche, firma grafica, PDF engine nuovo, HTML design-mode
- GUIDA / roadmap hub (traccia nel brief)
- `DEPUTYTASK.md`, `DEPUTYTASK1.md`

## Riuso obbligatorio

- Upload solo `.docx` (`validateDocxFile`) — convertire `MTxxx-2026.doc` **una volta** in `.docx` (LibreOffice/Word), non OLE a runtime
- Tab/scope come Audit vs NC: terza tab **CND**, non una pagina nuova
- Resolve: `organization_id` + `scope=cnd` + `standard_key` = `VT`|`MT`|`PT`|`UT` (stesso ordine: assegnazione org → sistema)
- Placeholder = catalogo **semantico** in appendice PLAN (`{pt_acc_l2}`, `{mt_tr_wet}`, …). **Non** usare i nomi FORMCHECKBOX (`Controllo2`/`Controllo3` riusati 27 volte sul PT). Marker minimi VT già in `vtWordExport.js`; per MT/PT warning marker come `checkNcDocxMarkers`, **senza** cambiare la UI verbale (flag UI = CND-3)
- Nessun motore PDF parallelo e nessun HTML design-mode come filiera report
- `SgqDataGrid` / DNA admin template esistente

## Slice (unica)

1. Estendere scope template a `cnd` (API lista/upload/resolve + tab admin).
2. Seed o upload modelli sistema: VT (quello già usato) + PT/MT da Word Mason (checkbox → `{pt_acc_l2}` ☑/☐). Se la conversione MT `.doc` non è fattibile in Cloud, lasciare slot `MT` con istruzione e template PT `.docx`.
3. Export VT: scarica il file dal VPS (`resolve?scope=cnd&standard_key=VT`) invece di solo `/templates/VT-verbale.docx`, con fallback locale offline.
4. Test L1: lista scope `cnd`; upload `.docx`; resolve per org; `.doc` rifiutato.

## Acceptance

- L1 test service/controller + `cd app && npm run build` se si tocca `app/`
- In Gestione → Template report si vede lo scope CND; si carica un `.docx` PT
- Export verbale VT usa il template risolto (o fallback documentato)
- Nessun tocco a `NdtReportsPage.jsx`

## Comando di lancio

`Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Chiusura (23/08/2026) — TEST OK

- Tab **CND** in Template report; upload `.docx` con metodo VT|MT|PT|UT; `.doc` rifiutato (FE + BE).
- Resolve `GET /report-templates/resolve?scope=cnd&standard_key=VT|MT|PT|UT` (studio → sistema).
- Export VT: `loadVtTemplate` prova il VPS, fallback `/templates/VT-verbale.docx`.
- Migrazione **157** dichiarata: `database/migrations/157_report_templates_scope_cnd.sql` (CHECK + seed). Non eseguita dal Cloud (SQL sul VPS).
- Slot MT: stub `.docx` con `{mt_tr_wet}` ecc. Il `.doc` Mason non era nel repo; convertire una volta in Word/LibreOffice, non OLE a runtime.
- Non toccati: `NdtReportsPage`, ingest, sync.

**L1:** Jest service+controller CND (10) + rbac/file (7) verdi; Vitest upload/tab/resolve (24) verdi; `cd app && npm run build` OK.

**Residuo:** applicare 157 sul VPS prima del seed in produzione; PDF cliente = dopo CND-4 (non in questa slice).

