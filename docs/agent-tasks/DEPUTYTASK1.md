# DEPUTYTASK1 — CND-5a: ruoli strumento non-VT (etichette su anagrafica)

**Stato:** APERTO  
**Aperto:** 26/08/2026  
**Piano:** [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md) (parte AFK di CND-5; **senza** parametri UT)  
**Dipende da:** CND-2/3 chiusi; modello Word UT **assente** → niente UI UT su verbale in questa slice  
**Rischio:** Basso/Medio — solo `EquipmentPage` (etichette/ruoli); niente `NdtReportsPage`, niente auth/DB.  
**Parallelo a:** CND-8 su [`DEPUTYTASK.md`](DEPUTYTASK.md) e STUD-1 su [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) — **file disgiunti**.

## Fonti Markdown

- Coperte: PLAN_CND (ruoli sonda/giogo); ADR-016 strumenti trasversali
- Mancanti: modello Mason UT → parametri UT restano backlog CND-5 pieno
- Si parte su: etichette ruolo in anagrafica strumenti già usata da VT (gauge/luxmeter/lamp)

## Perché

Strumenti restano VT-centrici in UI. CND-5a sblocca etichette/ruoli per MT/PT/UT (giogo, sonda, kit) **senza** aprire parametri UT sul verbale (manca modello).

## DoD

1. Su `EquipmentPage` (o selettore ruolo già esistente): aggiungere/mostrare ruoli non-VT utili (es. giogo / sonda / kit PT) riusando il campo ruolo già in DB — **niente** nuova tabella.
2. Etichette in italiano corrette (UTF-8); DNA design-system; niente card decorative.
3. **Vietato** toccare `NdtReportsPage.jsx` / `method_params` UT / Word UT.
4. Test L1 mirato se c’è pattern test Equipment; altrimenti build `app/` + smoke manuale documentato.
5. Spuntare in PLAN_CND la nota CND-5a (o riga parallelo); brief **CHIUSO** — TEST OK.
6. Residuo esplicito: parametri UT sul verbale = CND-5 restante (HITL modello).

## File previsti

- `app/src/pages/EquipmentPage.jsx` / `.css` (solo etichette/ruoli)
- eventuale costante ruoli già condivisa con NDT — **non** duplicare se esiste
- `docs/agent-tasks/PLAN_CND_SLICES.md` + questo brief

## Cosa NON toccare

- `DEPUTYTASK.md` / CND-8 / `NdtReportsPage*` / `useNdtAutoSave` / `syncService`
- `vtWordExport`, posa registro, allegati, STUD/WPQR, auth, migrazioni
- GUIDA / roadmap § Stato attuale (parallelo — sync **dopo merge**)

## Verifica

- [ ] Ruoli non-VT selezionabili in anagrafica strumenti
- [ ] Nessun tocco verbale UT
- [ ] Build OK (+ test se presenti)
- [ ] Brief CHIUSO — TEST OK; residuo CND-5 UT dichiarato
