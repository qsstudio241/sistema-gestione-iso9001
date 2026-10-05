# DEPUTYTASK_COPERTURA — COV-2: adapter `wpqr_procedure` pieno (15614 · 14555 stud · 15613)

**Stato:** CHIUSO — TEST OK (06/10/2026)  
**Aperto:** 05/10/2026  
**Piano:** [`PLAN_COPERTURA_SCALABILE_SLICES.md`](PLAN_COPERTURA_SCALABILE_SLICES.md) § COV-2  
**Dipende da:** COV-1 CHIUSO (PR #702, su `main`) — scontrino in [`DEPUTYTASK.md`](DEPUTYTASK.md)  
**Rischio:** Medio — BE additivo, nessuna migrazione, nessuna modifica a auth/sync/schema  
**Stream:** `DEPUTYTASK_COPERTURA.md` (epic copertura: COV-3/4/5 riusano questo file solo dopo che COV-2 è CHIUSO e la riga titolo/file è aggiornata)  
**Branch suggerito:** `cursor/cov-2-wpqr-adapter-<suffisso>`

---

## Obiettivo (una slice = un risultato verificabile)

Sostituire lo stub `not_implemented` di `wpqrProcedure.adapter.js` con un match reale: dato un **requisito di giunto/procedura**, restituire per ogni WPQR dell'organizzazione `match` / `partial` / `no_match` con motivi leggibili, **riusando** le funzioni già esistenti (`wpsGenerator.service.js` + `weldingQualificationRules*.js`). Nessuna logica di copertura duplicata.

## Gate norme (dichiarato)

- **Coperte (MD+JSON in `docs/Normative/`, regole JS già in repo):** ISO 15614-1 (NORMA_00019/00043) → `weldingQualificationRules15614.js`; 15614-2 (NORMA_00031) → `weldingQualificationRules15614_2.js`; 14555 stud (NORMA_00033) → `weldingQualificationRules14555.js`.
- **Parziale:** ISO 15613:2025 (NORMA_00045) è digitalizzata ma **non esiste catalogo JS di soglie** (backlog: «non catalogo JS»). In COV-2 la 15613 è **solo etichetta/base di qualifica** sul record WPQR (nessuna soglia nuova). **Vietato inventare** campi di validità 15613.
- **Mancanti:** nessun PDF richiesto per COV-2. Se emerge una clausola 15613 necessaria → riga in `docs/reference/NORME_MANCANTI_BACKLOG.md` + richiesta HITL, non codice.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte | UI | API / persistenza |
|------|------------------|----|-------------------|
| `welding_process` | 15614-1 § campo di validità processo; colonne `wpqr_records` | campo già in `CoverageVerifyPanel` (da `requirementFields`) | `POST /qualifications/coverage/verify` (esistente) |
| `joint_type` BW/FW/SW | `jointTypeCompatible` (wpsGenerator); 14555 per SW | select esistente | idem |
| `thickness_mm` (+ `thickness_b_mm` se doppio range t1/t2) | `checkThicknessCoverage` + 15614-1/-2 | number | idem |
| `diameter_mm` (tubo) | `checkDiameterCoverage` / `describePlateCoversPipeDiameter*` | number | idem |
| `throat_mm` (FW) | `checkThroatCoverage` | number | idem |
| `material_group` (+ `material_group_b`) | `isParentMaterialCombinationCovered` / `resolveSteelGradeToGroup` | text | idem |
| stud: sezione, posizione, atmosfera | `weldingQualificationRules14555.js` (`isPositionCovered14555`, `describeQualifiedStudSectionRange`, …) | solo se già esposto da `requirementFields` | idem |
| base qualifica (15614 / 14555 / 15613) | etichetta sul record WPQR | colonna esito/`detail` | idem — **nessuna** nuova colonna |

Se un campo del requisito non è nel WPQR (dato `NULL`), l'esito è `partial` con motivo esplicito, non `match` silenzioso.

## Cosa fare

1. **Adapter:** `backend/src/services/capabilityCoverage/adapters/wpqrProcedure.adapter.js` → `implemented: true`, `maturity: 'full'` (o equivalente già usato da `publicDomainMeta`). `match(req, ctx)`: caricare i WPQR con `loadWpqrRecords(ctx.organizationId, ctx.companyId)` (o pool iniettato come in `welder9606`), per ciascun record comporre i check riusati e aggregare in `CapabilityMatch` (`capability_id` = id WPQR, `capability` con numero WPQR / norma / processo, `reasons`, `detail`).
2. **Aggregazione esito:** tutti i check applicabili ok → `match`; almeno uno `partial` e nessun `no_match` → `partial`; almeno un fallimento → `no_match`. Ordinare i risultati match → partial → no_match.
3. **`requirementFields`:** estendere con i campi della tabella (diametro, gola, gruppo B, spessore B) senza rompere i payload COV-1 (campi esistenti invariati).
4. **Test L1 Jest** (`wpqrProcedure.adapter.test.js` accanto all'adapter, DB mockato): match pieno, no_match per spessore/processo, partial per dato mancante, SW/stud con 14555, record 15613 senza soglie (nessun match inventato), nessun WPQR → lista vuota con messaggio. Aggiornare `coverageEngine.service.test.js` solo se il contratto domini cambia (lo stub non deve più comparire come `not_implemented`).
5. **FE:** solo se `CoverageVerifyPanel` non rende i nuovi `requirementFields` dinamicamente — in quel caso fix minimo + test Vitest esistente `coverageVerifyPanel.test.jsx`. Preferire zero modifiche FE.
6. Aggiornare `PLAN_COPERTURA_SCALABILE_SLICES.md` (DoD COV-2 spuntato, riga «Brief attivo»). GUIDA/roadmap: se non ci sono altri `DEPUTYTASK*` APERTI (al momento nessuno) nella **stessa** PR, una riga in roadmap § Stato attuale.

## File previsti (codice)

- `backend/src/services/capabilityCoverage/adapters/wpqrProcedure.adapter.js`
- `backend/src/services/capabilityCoverage/adapters/wpqrProcedure.adapter.test.js` (nuovo)
- `backend/src/services/capabilityCoverage/coverageEngine.service.test.js` (solo ritocchi)
- `backend/src/services/capabilityCoverage/registerDefaultAdapters.js` (solo se serve)
- Solo lettura/riuso: `backend/src/services/wpsGenerator.service.js` (se serve export di una funzione già esistente, aggiungere solo l'export, nessun cambio di logica)
- `app/src/components/CoverageVerifyPanel.jsx` + `app/src/tests/coverageVerifyPanel.test.jsx` (solo se necessario)
- Doc: `docs/agent-tasks/PLAN_COPERTURA_SCALABILE_SLICES.md`, questo brief, `docs/PROJECT_ROADMAP.md` (una riga)

## Cosa NON toccare

- **Logica di calcolo** in `wpsGenerator.service.js` e `weldingQualificationRules*.js` (solo riuso/export)
- Adapter `welder9606` e `cnd9712` (COV-3)
- `qualifications.controller.js` / `.routes.js` (rotte COV-1 già pronte; `getCoverage` → COV-4)
- Generatore WPS (nessuna riscrittura), ingest, JEV, Acrobat, regole 4063
- Migrazioni SQL (**nessuna** in COV-2), `deploy-manifest.json` (nessun nuovo `.js` runtime: il test non va nel manifest; aggiornarlo solo se si aggiunge un file in `backend/src/` non di test)
- auth.middleware, JWT, `syncService`

## Disgiunzione da altri brief

Su `origin/main` **nessun** `DEPUTYTASK*` è APERTO eccetto questo (verificato 05/10/2026; `DEPUTYTASK_AI_CHECKLIST.md` è «IN REVIEW», file diversi: AI checklist, nessuna sovrapposizione con `capabilityCoverage/`). PR aperte: nessuna.

## DoD

- [x] `GET /qualifications/coverage/domains` mostra `wpqr_procedure` come implementato
- [x] `POST /qualifications/coverage/verify` con `domain: wpqr_procedure` restituisce match/partial/no_match reali
- [x] Nessuna soglia 15613 inventata; 15613 solo come etichetta
- [x] Jest mirato verde (`cd backend && npx jest src/services/capabilityCoverage`)
- [x] Se toccato FE: `cd app && NODE_ENV=test npm run test:run -- coverageVerifyPanel` + `npm run build`
- [x] `node backend/scripts/check-harness-boot.js` OK
- [x] Branch allineato a `origin/main` prima di push/PR; `bugbot run` una sola volta a slice chiusa

## Esito (CHIUSO — TEST OK)

- Adapter `wpqr_procedure` pieno: `implemented: true`, `maturity: 'full'`. Check riusati: `jointTypeCompatible`, `checkThicknessCoverage` (t1/t2 + B), `checkDiameterCoverage`, `checkThroatCoverage`, `isParentMaterialCombinationCovered` / `resolveSteelGradeToGroup` (15614-1), `isSimilarMaterialsCovered14555` (14555, solo stesso gruppo). Processo: confronto token locale (nessuna funzione esistente).
- Aggregazione: qualunque fail → `no_match`; altrimenti qualunque dato mancante/non verificabile → `partial`; altrimenti `match`. Ordinamento match → partial → no_match.
- Base di qualifica in `capability.qualification_basis` (15614-1 / 15614-2 / 14555 / 15613). 15613: nessuna soglia; le funzioni riusate ricevono una copia del record senza `thickness_tested`/`product_type` così non ricadono nelle tabelle 15614; materiale e gola restano `partial`.
- 14555 stud: spessore = §10.2.8.6 (partial), gola non applicabile (no_match), sezione/posizione/atmosfera non verificate (nessuna colonna WPQR) → `detail.stud_scope`.
- 15614-2 e gruppi >11: combinazione materiali non codificata → `partial` (verifica manuale), stesso gruppo → ok.
- `requirementFields`: aggiunti `thickness_b_mm`, `diameter_mm`, `throat_mm`, `material_group_b`.
- Nessuna WPQR: `matches: []` + `message` (nuovo campo opzionale `emptyMessage` adapter → `verifyCoverage`); FE mostra `result.message` (3 righe in `CoverageVerifyPanel.jsx` + test).
- Test: Jest `capabilityCoverage` 36/36; Vitest `coverageVerifyPanel` 4/4; `npm run build` OK; `check-harness-boot` OK; `check-utf8-encoding` OK.

**File toccati:** `wpqrProcedure.adapter.js`, `wpqrProcedure.adapter.test.js` (nuovo), `coverageEngine.service.js` (campo `message`), `coverageEngine.service.test.js`, `CoverageVerifyPanel.jsx`, `coverageVerifyPanel.test.jsx`, `PLAN_COPERTURA_SCALABILE_SLICES.md`, questo brief, `PROJECT_ROADMAP.md` (una riga). Non toccati: `wpsGenerator.service.js`, `weldingQualificationRules*.js`, controller/routes, migrazioni, `deploy-manifest.json`.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_COPERTURA.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — compilare dal template [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md) solo se la slice non si chiude)_
