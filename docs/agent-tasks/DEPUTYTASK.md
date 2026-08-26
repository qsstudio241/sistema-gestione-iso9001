# DEPUTYTASK — STUD-2: ingest AI WPQR stud / P+T / doppio materiale

**Stato:** CHIUSO — TEST OK  
**Aperto:** 26/08/2026  
**Chiuso:** 26/08/2026  
**Branch:** `cursor/wpqr-stud-ingest-166d`  
**Stream:** [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) (STUD-1 **CHIUSO** #585)  
**Report:** [`docs/gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md`](../gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md)  
**Dipende da:** STUD-1 **CHIUSO** (campi DB/FE/schema già in prod, mig. 159)  
**Rischio:** Medio — prompt/schema ingest + mapping review→DB; **niente** auth/sync/migrazioni distruttive / range 14555  
**Parallelo a:** STUD-3-A su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) — **file disgiunti** (qui solo ingest; lì solo estratto docs).

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: ISO 15614-1 (NORMA_00019 + estratto range); STUD-1 campi (SW, qualifying_element,
  diameter_*, base_material_*_2, product_type P+T); schema wpqr già esteso in documentTypeSchemas
- Mancanti per QUESTA slice: niente di bloccante — range 14555 = STUD-3 (altro slot)
- Si parte su: raffinare prompt + normalizzazione ingest così che da PDF/verbale Mason
  escano SW, elemento, D prigioniero, PM2, P+T senza inventare soglie 14555
```

## Perché

STUD-1 ha i campi in form/DB. L’ingest AI può ancora trattare stud come FW generico, confondere diametro tubo vs prigioniero, o non estrarre Parent Metal 2 / `qualifying_element` / `P+T`. STUD-2 chiude il percorso **PDF → revisione → commit** per quei campi.

## DoD

1. Prompt / `aiExpectedSchema` (BE + mirror FE se presente): istruzioni esplicite per `joint_type=SW`, `qualifying_element`, diametro prigioniero se SW, `base_material_group_2` / `base_material_spec_2`, `product_type=P+T` quando dichiarato «entrambi».
2. `wpqrIngest.service.js`: normalizzazione robusta (sinonimi stud/prigioniero → SW o qualifying_element; non forzare FW; non calcolare range 14555).
3. Test jest mirati: almeno un caso SW + PM2 e un caso P+T; regressione BW/FW/P/T.
4. Completeness manual-edit / reprocessable: se aggiungi chiavi AI, allinea whitelist (CI `manualEditCompletenessCheck` / pattern STUD-1).
5. **Niente** motorino range ISO 14555; **niente** tocco a `WeldingProceduresPage.jsx` salvo bug banale di schema condiviso (preferire solo `documentTypeSchemas` + ingest).
6. L1: jest mirati backend + eventuale vitest se tocchi FE schema; `npm run build` in `app/` se tocchi `app/`.
7. Brief **CHIUSO — TEST OK**; spunta backlog in stream STUD.

## File previsti

- `backend/src/services/wpqrIngest.service.js`
- `backend/src/services/wpqrIngest.service.test.js`
- `backend/src/data/documentTypeSchemas.js`
- `app/src/data/documentTypeSchemas.js` (solo se mirror prompt/schema)
- `backend/src/data/reprocessableFields.js` / test completeness **solo se** nuove chiavi AI
- `docs/agent-tasks/DEPUTYTASK.md` (questo brief)
- `docs/agent-tasks/DEPUTYTASK_WPQR_STUD.md` (riga backlog STUD-2)

## Cosa NON toccare

- `DEPUTYTASK1.md` / STUD-3-A / `docs/Normative/NORMA_00033*` (scrittura) / nuovo file range 14555 in `docs/reference/`
- `WeldingProceduresPage.jsx` (form STUD-1 già fatto) — evita conflitto parallelo
- `wpsGenerator.service.js` / regole range / catalogo `weldingProcesses4063.js` (STUD-3-B o slice dopo estratto)
- Auth, JWT, sync, migrazioni SQL
- GUIDA / roadmap § Stato attuale (c’è parallelo STUD-3-A + eventuale fix CND) — bozza hub **dopo merge**
- CND / NDT

## Verifica

- [x] Ingest SW: campi stud valorizzati in review/mapping senza inventare range
- [x] Regressione BW/FW e product_type P|T
- [x] L1 verdi; brief CHIUSO — TEST OK

## Esito (26/08/2026)

Prompt FE+BE: SW ≠ FW, D1 = diametro prigioniero, PM2, P+T solo se dichiarato «entrambi», vietato inventare range 14555.

Normalizzazione ingest (`wpqrIngest.service.js`): sinonimi stud/prigioniero → SW (anche se l'AI ha messo FW); `entrambi`/`piastra e tubo` → P+T; D1 dal testo se manca il diametro; SW non usa Tabella 7 BW. Fallback regole: `extractJointType` riconosce SW prima di FW.

Nessuna chiave AI nuova (whitelist STUD-1 già ok). Nessun motorino 14555. `WeldingProceduresPage.jsx` non toccato. GUIDA/roadmap: sync **dopo merge** (parallelo STUD-3-A).

**L1:** jest 58 pass (`wpqrIngest` + extractors + encoding repair + completeness); `npm run build` in `app/` OK.

## Bozza hub (dopo merge, se c’era parallelo)

- Roadmap: riga STUD-2 CHIUSO + PR
- GUIDA: una riga «ingest distingue SW ≠ FW; diametro contestuale»
