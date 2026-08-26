# DEPUTYTASK — CND-9: rete di salvataggio officina (IndexedDB syncQueue)

**Stato:** APERTO  
**Aperto:** 26/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md)  
**Dipende da:** CND-1 **CHIUSO**; tipi `create_ndt_report` / `update_ndt_report` **già** in `syncService`  
**Rischio:** Medio — FE sync/offline CND; **non** copiare motore `audit_events`; niente auth JWT / migrazioni.  
**Parallelo a:** CND-W su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti**.

## Fonti Markdown

- Coperte: PLAN_CND (HITL offline officina); ADR-008; commenti in `useNdtAutoSave.js` (enqueue già presente ma non agganciato al flusso save)
- Mancanti: —
- Si parte su: collegare autosave/fallimento rete → coda IndexedDB esistente, non un secondo DB

## Perché

In officina senza rete la bozza resta solo in `localStorage`. La coda `syncQueue` e i tipi NDT esistono già: manca il collegamento operativo (CND-9).

## DoD (da PLAN_CND)

1. Su create/update verbale fallito per offline/rete: chiamare `enqueueNdtReportSync` (o equivalente già in repo) con payload coerente; al reconnect la coda processa i tipi NDT (verificare che `syncService` li gestisca davvero — se manca handler, aggiungere il minimo).
2. `useNdtAutoSave` resta backup locale; **non** sostituire con copia di `audit_events`.
3. Dopo sync riuscito: clear draft localStorage; UX discreta (banner / stato sync) riusando pattern audit/NC se esiste.
4. Foto allegati: se fuori scope sicuro in questa slice, documentare residuo (non rompere CND-6).
5. Test L1 mirati (hook / sync tipi NDT) + `npm run build` in `app/`.
6. Spuntare CND-9 in PLAN_CND; brief **CHIUSO** — TEST OK.

## File previsti

- `app/src/hooks/useNdtAutoSave.js`
- eventuale gancio minimo in `NdtReportsPage.jsx` (solo save/offline) — **vietato** riscrivere flag PT/MT, gate 9712, hint NC
- `app/src/services/syncService.js` (o file dove già vivono i tipi NDT) — solo handler NDT se assente
- test mirati + `docs/agent-tasks/PLAN_CND_SLICES.md` + questo brief

## Cosa NON toccare

- `DEPUTYTASK1.md` / CND-W / `vtWordExport.js` / Template report
- `ndtReportRegistryPose*` / controller posa (CND-7)
- `NdtItemAttachments*` (CND-6) salvo nota residuo foto offline
- STUD / WPQR / auth / JWT / migrazioni / `audit_events` nuovo motore
- GUIDA / roadmap § Stato attuale (parallelo — sync **dopo merge**)

## Verifica

- [ ] Offline → enqueue; online → drain coda NDT
- [ ] Nessun secondo IndexedDB / audit_events
- [ ] L1 + build OK
- [ ] PLAN CND-9 spuntato; brief CHIUSO — TEST OK
