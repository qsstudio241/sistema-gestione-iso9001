# DEPUTYTASK1 — CND-2: gate ispettore 9712 + idoneità visiva

**Stato:** CHIUSO — TEST OK  
**Aperto:** 25/08/2026  
**Chiuso:** 25/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md) (= ISO-9; **non** da PLAN 3834)  
**Rischio:** Medio — FE + BE NDT; niente auth/sync/schema distruttivo.  
**Parallelo a:** NG-3 su [`DEPUTYTASK.md`](DEPUTYTASK.md) — **file disgiunti** (questa slice = verbali NDT).

## Fonti Markdown

- Coperte: estratto [`ISO_9712_2022_NDT_QUALIFICATION.md`](../reference/ISO_9712_2022_NDT_QUALIFICATION.md); qualifiche NDT in anagrafica; `visionFitness.service.js`
- Mancanti: testo integrale ISO 9712 in `docs/Normative/` → già in backlog; **non ha bloccato**
- Si parte su: gate UI/API su verbale usando qualifiche + visione già in DB

## Perché

L’operatore può ancora risultare «ispettore» a testo libero senza legame al patentino 9712 e all’idoneità visiva. CND-2 chiude il gate per studio e per azienda con licenza `cnd`/`saldatura`.

## DoD (da PLAN_CND)

1. Prima di consentire giudizio/firma sul verbale: verificare qualifica 9712 **valida** per il metodo del verbale **e** visita medica/visione ok (`visionFitness` / pattern già in repo).
2. Stesso codice per ambito studio e azienda cliente (licenza).
3. UI: messaggio chiaro se gate fallisce; azioni operative restano visibili (`disabled` + `title` se manca prerequisito).
4. Test L1 mirati + build `app/`; smoke percorso CND/qualifiche se tocchi API deployata.
5. Aggiornare PLAN_CND (spuntare CND-2); brief CHIUSO.

## File toccati

- `backend/src/services/ndtInspectorGate.service.js` (+ test Jest)
- `backend/src/controllers/ndtReports.controller.js` (+ test gate 409)
- `backend/src/routes/ndtReports.routes.js` — `GET /ndt-reports/inspector-eligibility`
- `backend/scripts/deploy-manifest.json`
- `app/src/pages/NdtReportsPage.jsx` / `.css`
- `app/src/services/apiService.js`
- `app/src/tests/ndtReportsInspectorGate.test.jsx`
- `docs/agent-tasks/PLAN_CND_SLICES.md`, questo brief

Niente migrazione: match per nome ispettore sulle qualifiche esistenti (colonna `inspector_qualification_id` non necessaria).

## Cosa NON toccare (rispettato)

- `DEPUTYTASK.md` / skill gap / `NORME_MANCANTI`
- CND-3 flag PT/MT
- Template Word, ingest `report_ndt`, auth, sync, migrazioni distruttive
- GUIDA / roadmap § Stato attuale (parallelo NG-3 — sync dopo merge)

## Verifica

- [x] Gate 9712 + visione attivo sul flusso verbale (UI + API completed/approved)
- [x] L1 + build OK (Jest gate/controller; Vitest CND-1/CND-2/strumenti; `app` build)
- [x] PLAN_CND CND-2 spuntato; brief CHIUSO — TEST OK

## Bozza dopo merge (parallelo NG-3)

- GUIDA: 1 riga lezione — gate verbale CND riusa Qualifiche + `visionFitness`, non una anagrafica operatori; Completa/giudizio restano visibili (`disabled`+`title`).
- Roadmap § Stato attuale: CND-2 gate 9712+visione sul verbale; prossima codice CND-3 (flag PT/MT).
