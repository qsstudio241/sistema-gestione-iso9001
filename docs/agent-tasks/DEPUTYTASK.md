# DEPUTYTASK — VC-4: Export Word checklist Riesame requisiti (opzione B)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 02/09/2026  
**Chiuso:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § VC-4  
**Rischio:** Medio — FE export Word da `commercial_case_checklist` già caricata (RBAC contract-reviews) + UI download; riuso pattern SAL/NC/riesame tecnico; niente migrazione; niente auth/sync breaking  
**Branch:** `cursor/vc4-export-checklist-a5ea`  
**PR:** draft non creabile da Cloud Agent se `gh` GraphQL bloccato — compare: https://github.com/qsstudio241/sistema-gestione-iso9001/compare/main...cursor/vc4-export-checklist-a5ea?expand=1  
**Supersede:** branch `cursor/vc4-export-report-studio-1c5d` (WIP opzione A — solo gap) **non** mergiare  
**Dipende da:** VC-1…VC-3 mergiate (#619/#620/#621); deploy VC-3 già fatto in sessione precedente

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Esito deputy

**TEST OK** — export Word checklist §8.2 (P1–P10 / F1–F6, esiti + note) + appendice gap sintetica opzionale.

| Voce | Dettaglio |
|------|-----------|
| Formato | Word programmatico (`docx` FE) — pattern SAL / riesame tecnico; **non** Riesame di direzione |
| Dati | Checklist già in dettaglio caso (`GET contract-reviews/:id`, stesso RBAC); gap via `GET .../capability-gap-report` best-effort |
| UI | Bottone «Scarica Word checklist» nella slide Checklist, accanto a Genera preliminare/finale |
| Appendice | Se snapshot gap presente: stato + conteggi + prime 8 voci; altrimenti omessa |
| Test L1 | `wordExportContractReviewChecklist.test.js` 4/4 + `npm run build` OK |
| Migrazione | nessuna |

**Prossima slice:** priorità prodotto = **ING-*** (ingest mole file) per PLAN post-merge; **VC-5 non aprire** senza conferma Lead.

---

## HITL prodotto (02/09/2026)

- **Export VC-4 = opzione B**: checklist Riesame requisiti compilata sul caso.
- Gap capacità: appendice sintetica in coda (incluso perché a basso costo).
- Formato Word. **NON** è Riesame di direzione.
- Fedeltà: voci = checklist caso (§8.2); non inventare voci.

## File previsti (toccati)

- `app/src/utils/wordExportContractReviewChecklist.js` (+ test)
- `app/src/pages/ContractReviewPage.jsx`
- `docs/agent-tasks/DEPUTYTASK.md` / `PLAN_VALUTAZIONE_COMMESSE_SLICES.md`

## Cosa NON toccare

- Auth/JWT, sync, migrazioni, SAL engine, Import Jobs, Riesame di direzione (`wordExportReview.js`)
- Ponte gap→checklist / agenti (nebbia / slice successive)
