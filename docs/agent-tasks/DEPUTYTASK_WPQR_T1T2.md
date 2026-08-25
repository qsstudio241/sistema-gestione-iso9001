# DEPUTYTASK_WPQR_T1T2 — Doppi range t1/t2 + ISO 15614-2

**Stato:** APERTO — codice su branch, in attesa PR/merge + migrazione 158 VPS  
**Aperto:** 25/08/2026  
**Branch:** `cursor/wpqr-t1t2-15614-2-887f`  
**Rischio:** Medio — migrazione additiva nullable, ingest/API/UI WPQR, regole 15614-2; niente auth/sync.  
**Parallelo:** NG-0/NG-1 su altri slot — file **disgiunti** (qui niente operating-memory / NORME_MANCANTI).

## Perché

Mason: FW con t1/t2 distinti persi; alluminio senza 15614-2. PDF consegnati 25/08.

## DoD

1. Colonne `thickness_t1_*` / `thickness_t2_*` (mig. **158**) + runner VPS  
2. Schema FE/BE + mapping ingest + create/update WPQR + form Modifica  
3. `checkThicknessCoverage` con range duali (orientamento o scambio)  
4. Digitalizzazione NORMA_00031 (15614-2) / 00032 (9606-2) + estratto operativo + regole JS Tabella 5/6/7  
5. Select norma WPQR: 15614-1 / 15614-2  
6. Test L1 verdi  

## File previsti

- `database/migrations/158_wpqr_thickness_t1_t2.sql`
- `backend/scripts/run-migration-158-vps.js`
- `backend/src/services/wpqrIngest.service.js`, `wpsGenerator.service.js`
- `backend/src/controllers/welding.controller.js`
- `backend/src/data/documentTypeSchemas.js`, `weldingQualificationRules15614_2.js` (+ test)
- `app/src/data/documentTypeSchemas.js`, `weldingQualificationRules15614_2.js`, `WeldingProceduresPage.jsx`
- `docs/Normative/NORMA_00031*`, `NORMA_00032*`, `SOURCE_PDF_INDEX.md`
- `docs/reference/ISO-15614-2-range-validita-WPQR.md`
- `backend/scripts/deploy-manifest.json`

## Cosa NON toccare

- auth / sync / JWT  
- `DEPUTYTASK.md` (NG-0)  
- Matrice gruppi alluminio Tabella 4 (backlog)  
- Regole complete 9606-2 (solo digitalizzazione MD)

## Deploy post-merge

```bash
# SCP + node run-migration-158-vps.js sul VPS, poi deploy-to-vps.sh
```
