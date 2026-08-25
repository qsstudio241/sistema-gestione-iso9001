# DEPUTYTASK1 — CND-2: gate ispettore 9712 + idoneità visiva

**Stato:** APERTO  
**Aperto:** 25/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md) (= ISO-9; **non** da PLAN 3834)  
**Rischio:** Medio — FE + BE NDT; niente auth/sync/schema distruttivo.  
**Parallelo a:** NG-3 su [`DEPUTYTASK.md`](DEPUTYTASK.md) — **file disgiunti** (questa slice = verbali NDT).

## Fonti Markdown

- Coperte: estratto [`ISO_9712_2022_NDT_QUALIFICATION.md`](../reference/ISO_9712_2022_NDT_QUALIFICATION.md); qualifiche NDT in anagrafica; `visionFitness.service.js` (se presente)
- Mancanti: testo integrale ISO 9712 in `docs/Normative/` → tracciato in [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md); **non blocca** il gate se l’estratto + dati qualifiche bastano
- Si parte su: gate UI/API su verbale usando qualifiche + visione già in DB

## Perché

L’operatore può ancora risultare «ispettore» a testo libero senza legame al patentino 9712 e all’idoneità visiva. CND-2 chiude il gate per studio e per azienda con licenza `cnd`/`saldatura`.

## DoD (da PLAN_CND)

1. Prima di consentire giudizio/firma sul verbale: verificare qualifica 9712 **valida** per il metodo del verbale **e** visita medica/visione ok (`visionFitness` / pattern già in repo).
2. Stesso codice per ambito studio e azienda cliente (licenza).
3. UI: messaggio chiaro se gate fallisce; azioni operative restano visibili (`disabled` + `title` se manca prerequisito).
4. Test L1 mirati + build `app/`; smoke percorso CND/qualifiche se tocchi API deployata.
5. Aggiornare PLAN_CND (spuntare CND-2); brief CHIUSO.

## File previsti

- `app/src/pages/NdtReportsPage.jsx` (+ css solo se serve)
- `backend/src/controllers/ndtReports.controller.js`
- riuso GET qualifiche + `visionFitness.service.js` (o equivalente già in repo)
- `app/src/tests/` mirato
- `docs/agent-tasks/PLAN_CND_SLICES.md`, questo brief

## Cosa NON toccare

- `DEPUTYTASK.md` / skill gap / `NORME_MANCANTI` (salvo 1 riga se scopri lacuna 9712 nuova)
- CND-3 flag PT/MT (stesso JSX — **non** in parallelo su questa pagina oltre il gate)
- Template Word, ingest `report_ndt`, auth, sync, migrazioni distruttive
- Inventare clausole 9712 non presenti nell’estratto

## Verifica

- [ ] Gate 9712 + visione attivo sul flusso verbale
- [ ] L1 + build OK
- [ ] PLAN_CND CND-2 spuntato; brief CHIUSO — TEST OK
