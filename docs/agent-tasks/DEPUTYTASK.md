# DEPUTYTASK — CND-3: UI flag PT/MT → method_params JSON

**Stato:** CHIUSO  
**Aperto:** 25/08/2026  
**Chiuso:** 26/08/2026  
**Esito:** TEST OK  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md)  
**Dipende da:** CND-1 + CND-2 **CHIUSI** (#549 / #561) — stesso JSX ora libero  
**Rischio:** Medio — FE verbale NDT; niente auth/sync/schema distruttivo.  
**Parallelo a:** NG-4 su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti** (questa slice = solo verbali CND).

## Fonti Markdown

- Coperte: catalogo flag in appendice [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md) (estratto Word Mason PT/MT 23/08); spike [`spike-cnd-pt-preview.html`](spike-cnd-pt-preview.html) come anteprima gruppi (non layout report)
- Mancanti: testo integrale ISO 3452-1 / 17638 / 23277 / 23278 in `docs/Normative/` → backlog; **non inventare** soglie oltre i flag del modello
- Si parte su: UI + JSON `method_params` 1:1 con placeholder semantici già elencati nel PLAN

## Perché

Sul verbale i parametri di metodo esistono solo per **VT** (lux). PT e MT hanno già modelli Word Mason e scope Template report (CND-4), ma in UI mancano i flag di tecnica/accettazione/difetti → `method_params`. Senza CND-3 il Word non può essere popolato dai dati operatore.

## DoD (da PLAN_CND)

1. Se `report_type` = **PT**: sezione metodo con gruppi esclusivi (radio / `status-btn`) e campi testo dal catalogo appendice PT → salvataggio in `method_params.pt` (o struttura equivalente documentata nel brief alla chiusura).
2. Se `report_type` = **MT**: stessa cosa per catalogo MT → `method_params.mt`. VT invariato (lux già presenti).
3. Un verbale = un metodo: **non** mescolare flag PT e MT. Niente tabelle SQL nuove; riuso colonna JSON già prevista.
4. Placeholder semantici (`{pt_acc_l2}`, `{mt_tr_wet}`, …) allineati all’appendice — **non** nomi FORMCHECKBOX Word.
5. Riuso UI: `status-btn`, `notes-textarea`, sezioni come drawer NC / DNA design-system. Niente card decorative.
6. Test L1 mirati (Vitest su sezioni PT/MT) + `npm run build` in `app/`.
7. Spuntare CND-3 in PLAN_CND; brief **CHIUSO** — TEST OK.

## Struttura JSON (chiusura)

Un verbale = un `report_type`. `sanitizeMethodParams` in `app/src/utils/ndtMethodParams.js` tiene un solo namespace.

- **VT** (invariato, piatto): `{ illuminance_min, illuminance_max, illuminance_measured, power_w, wavelength }`
- **PT**: `{ pt: { acc, surface, cleaning[], application, inspection_pct, pen, pen_lot, sol, sol_lot, det, det_lot, lux, temp, final, defects: { [codice]: { present, outcome } } } }`
- **MT**: `{ mt: { tracer, mag, mag_mode, pole_pitch, curr_type, curr_a, field, demag, surf, inspection_pct, judg, defects: { [codice]: boolean } } }`

Nomi e date restano sulla testata del verbale (`responsible`, `inspector`, `inspection_date`, …). Placeholder `{pt_acc_l2}` / `{mt_tr_wet}` / `{pt_d_100_yn}` nel helper — export Word = slice successiva.

## File previsti

- `app/src/pages/NdtReportsPage.jsx` / `.css` (sezioni metodo PT/MT)
- eventuale helper piccolo riusabile solo se già esiste pattern simile (Ponytail: non creare file se basta JSX)
- `app/src/tests/` — test mirato CND-3
- `docs/agent-tasks/PLAN_CND_SLICES.md` + questo brief (chiusura)

## Cosa NON toccare

- `DEPUTYTASK1.md` / NG-4 / `normBroker` / `aiChat` / `gapAnalysis`
- Template Word / `vtWordExport` / ReportTemplates (CND-4 già chiuso; export flag→Word = slice successiva se serve)
- CND-5 UT, CND-6 allegati, CND-7 registro, CND-9 sync
- Auth, JWT, sync audit, migrazioni distruttive
- GUIDA / roadmap § Stato attuale (parallelo NG-4 — sync **dopo merge**)

## Verifica

- [x] Flag PT e MT visibili e salvati in `method_params` sul verbale giusto
- [x] VT invariato; nessun merge PT↔MT
- [x] L1 + build OK
- [x] PLAN CND-3 spuntato; brief CHIUSO — TEST OK
