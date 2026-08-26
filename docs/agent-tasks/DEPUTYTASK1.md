# DEPUTYTASK1 — CND-W: export Word PT/MT da method_params → placeholder

**Stato:** APERTO  
**Aperto:** 26/08/2026  
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

## Verifica

- [ ] Export PT/MT include flag da `method_params`
- [ ] VT non regredisce
- [ ] L1 + build OK
- [ ] Brief CHIUSO — TEST OK
