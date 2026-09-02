# DEPUTYTASK — ING-2: Matching docs → ruoli catalogo / gate Analizza

**Stato:** APERTO  
**Aperto:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § ING-2  
**Rischio:** Medio — FE util + UI su catalogo VC-2/ING-1; riuso PATCH allegato; niente migrazione; niente auth/sync  
**Branch:** `cursor/ing2-catalog-role-matching-1c5d`  
**Dipende da:** ING-1 su `main` (#624)  
**Parallelo:** ING-4 PR #625 — **file disgiunti** (non toccare template checklist / mig 162)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Obiettivo

Estendere il matching auto → `commercial_doc_role` oltre le euristiche nome di ING-1 (MIME/path/confidence + conferma bulk più smart) e rafforzare il gate **Analizza documenti** con readiness + CTA verso batch HITL. Nessun secondo storage; niente LLM.

## File previsti

- `app/src/utils/caseDocCatalog.js` (+ test)
- `app/src/pages/ContractReviewPage.jsx` (+ CSS minimo se serve)
- `docs/agent-tasks/DEPUTYTASK.md` (questo)
- `docs/agent-tasks/PLAN_VALUTAZIONE_COMMESSE_SLICES.md` (spunta ING-2 a chiusura)

## Cosa NON toccare

- Template checklist ING-4: `commercialChecklistTemplate*`, `ContractChecklistTemplatesPage*`, `commercialChecklistDefaults*`, mig `162_*`, `run-migration-162*`
- Auth/JWT, sync, migrazioni nuove
- Duplicare pannello batch ING-1 (estendere, non rifare)

## Criteri di accettazione

1. Matcher con confidence (`high`/`medium`) da nome/path + MIME/estensione
2. Batch: auto-seleziona solo indizi forti; azioni Seleziona indizi forti / tutte le proposte
3. Gate Analizza: readiness + soft-warn se restano da catalogare; CTA batch se bloccato con indizi
4. Test L1 `caseDocCatalog.test.js` + build OK
5. Nota chiusura: mig 162 dopo merge #625 (PR ancora aperta)

## Handoff (se interrotto)

Vedi [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md).
