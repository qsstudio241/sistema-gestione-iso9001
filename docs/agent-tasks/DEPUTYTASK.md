# DEPUTYTASK — CND-8: crea verbale come audit (bozza UUID → form → coda)

**Stato:** CHIUSO  
**Aperto:** 26/08/2026  
**Chiuso:** 26/08/2026 — **TEST OK**  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md)  
**Dipende da:** CND-9 **CHIUSO** (#578) — coda sync NDT agganciata  
**Rischio:** Medio — FE lista/crea verbale; riuso `enqueueNdtReportSync` / pattern `createAudit`; niente auth/migrazioni.  
**Parallelo a:** CND-5a su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti**.

## Fonti Markdown

- Coperte: PLAN_CND (HITL creazione bozza come audit); ADR-008; CND-9 già in coda
- Mancanti: —
- Si parte su: non un form enorme non salvato; bozza locale subito, poi sync

## Perché

Oggi si crea il verbale «da zero» senza allineamento chiaro al flusso audit (UUID bozza → compilazione → coda). CND-8 chiude l’**input** del ciclo operatore: partire subito con una bozza salvabile (anche offline via CND-9).

## DoD (da PLAN_CND)

1. Azione «Nuovo verbale» (o equivalente): crea bozza con UUID locale (schema mentale `createAudit`), form compilabile subito, persistenza via API online **oppure** enqueue CND-9 se offline — **niente** nuova tabella «incarico».
2. Lista verbali: bozze locali/in coda visibili in modo onesto (filtro «oggi» opzionale se banale; non obbligatorio se fuori scope minimo).
3. Non rompere Completa → posa Registro (CND-7), flag PT/MT (CND-3), gate 9712 (CND-2), export Word (CND-W).
4. Riuso UI DNA / pattern lista NC o Qualifiche dove serve; niente pagina «CND 2.0».
5. Test L1 + `npm run build` in `app/`.
6. Spuntare CND-8 in PLAN_CND; brief **CHIUSO** — TEST OK.

## File toccati

- `app/src/pages/NdtReportsPage.jsx` / `.css`
- `app/src/hooks/useNdtAutoSave.js` (`seedNdtLocalDraft`, indice bozze, `listNdtDrafts`)
- `app/src/tests/ndtReportsCreateDraft.cnd8.test.jsx` + allineamento mock CND-2/3/7/9
- `docs/agent-tasks/PLAN_CND_SLICES.md` + questo brief

## Cosa NON toccato

- `DEPUTYTASK1.md` / CND-5a / `EquipmentPage`
- `vtWordExport.js`, `ndtReportRegistryPose*`, `NdtItemAttachments*`
- STUD / WPQR / auth / JWT / migrazioni / CND-10 firma
- GUIDA / roadmap § Stato attuale (parallelo — sync **dopo merge**)

## Verifica

- [x] Nuovo verbale → bozza UUID subito; offline usa coda CND-9
- [x] Nessuna entità «incarico» nuova
- [x] L1 + build OK (`ndtReportsCreateDraft.cnd8` + regressioni NDT; `npm run build`)
- [x] PLAN CND-8 spuntato; brief CHIUSO — **TEST OK**

## Bozza hub (dopo merge, parallelo attivo)

- Roadmap § Stato attuale: riga CND-8 CHIUSO + PR
- GUIDA: una riga lezione «Nuovo verbale = seed UUID subito come createAudit»
