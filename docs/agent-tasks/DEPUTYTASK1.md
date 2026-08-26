# DEPUTYTASK1 — CND-W: export Word PT/MT da method_params → placeholder

**Stato:** CHIUSO — TEST OK  
**Aperto:** 26/08/2026  
**Chiuso:** 26/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md) (dopo CND-3 + CND-4)  
**Dipende da:** CND-3 (#571) + CND-4 (#547) **CHIUSI**  
**Rischio:** Medio — FE export Word; niente auth/sync/DB.  
**Parallelo a:** CND-9 su [`DEPUTYTASK.md`](DEPUTYTASK.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti**.

## Fonti Markdown

- Coperte: appendice flag PT/MT in PLAN_CND (placeholder semantici `{pt_acc_l2}`, `{mt_tr_wet}`, …); `ndtMethodParams.js`; scope Template report `cnd`
- Mancanti: testo integrale 3452/17638 — **non inventare** soglie; solo mappare flag UI → placeholder
- Si parte su: `vtWordExport.js` oggi espone soprattutto lux VT; PT/MT JSON non popolano i checkbox Word

## Perché

CND-3 salva i flag; CND-4 risolve il template per metodo. Manca il ponte **dati → Word**: senza CND-W l’operatore compila PT/MT in app e il `.docx` esce incompleto.

## DoD

1. `buildVtTemplateData` (o helper dedicato) espone chiavi allineate ai placeholder semantici dell’appendice PLAN per `report_type` PT e MT (`method_params.pt` / `.mt`).
2. Resolve template: riusare percorso CND-4 (VPS Template report / fallback) per VT|MT|PT|UT — **non** hardcodare un quarto motore.
3. Gruppi esclusivi → un solo placeholder “acceso” coerente col Word (checkbox/radio); niente nomi FORMCHECKBOX come chiavi.
4. VT lux invariato; regressione export VT coperta da test.
5. Test L1 (unit su mapping dati + eventuale smoke export) + `npm run build`.
6. Aggiornare PLAN_CND (nota CND-W / export); brief **CHIUSO** — TEST OK.

## File previsti

- `app/src/utils/vtWordExport.js` (+ test)
- eventuale riuso `ndtMethodParams.js` (solo lettura/mapping, non riscrivere UI)
- `docs/agent-tasks/PLAN_CND_SLICES.md` + questo brief

## Cosa NON toccare

- `DEPUTYTASK.md` / CND-9 / `useNdtAutoSave` / `syncService`
- `NdtReportsPage.jsx` layout/flag (CND-3) salvo bottone export se già presente
- posa registro / allegati / STUD / WPQR / auth
- GUIDA / roadmap § Stato attuale (parallelo — sync **dopo merge**)

## Esito

- `buildPtMtPlaceholderData` + merge in `buildVtTemplateData`: PT/MT → chiavi PLAN (`pt_acc_l2`, `mt_tr_wet`, …) con ☑/☐ sui gruppi esclusivi; cleaning multi; testi consumabili/campi MT; difetti PT `_yn`/`_a`.
- Resolve template: invariato (CND-4 `loadVtTemplate`).
- VT lux invariati (test regressione).
- L1: `vtWordExport.cndW.placeholders.test.js` + `vtWordExport.cndResolve.test.js` + build.

## Verifica

- [x] Export PT/MT include flag da `method_params`
- [x] VT non regredisce
- [x] L1 + build OK
- [x] Brief CHIUSO — TEST OK

## Bozza sync docs (dopo merge — parallelo CND-9 / STUD)

- GUIDA lezioni: riga CND-W — `method_params` → placeholder semantici ☑/☐ in `vtWordExport`; non FORMCHECKBOX.
- Roadmap § Stato attuale: CND-W chiusa; resta CND-9 + STUD-1.
