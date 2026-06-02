# DEPUTYTASK — Estensioni Riesame Requisiti

**Stato:** S1 implementata — PR in review; slice **S2** prossima  
**Baseline `main`:** merge PR [#83](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/83) + hotfix [#84](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/84)  
**Piano completo:** [TASK_RIESAME_ESTENSIONI_SLICES.md](TASK_RIESAME_ESTENSIONI_SLICES.md)

## Comando nuova chat (incolla in Agents)

```
Leggi docs/agent-tasks/DEPUTYTASK.md e docs/agent-tasks/TASK_RIESAME_ESTENSIONI_SLICES.md (slice S2).
Esegui la slice S2 (supplier_id + dropdown fornitore).
Chiudi con TEST OK o FIX NON APPLICABILI.
```

## Slice corrente: S2 — Anagrafica fornitore (supplier_id)

| Task | Dettaglio |
|------|-----------|
| S2.1 | Verifica tabella `suppliers` |
| S2.2 | Migrazione **071** `supplier_id` |
| S2.3 | Dropdown fornitore se counterparty=supplier |
| S2.4 | Highlight checklist P9 subforniture |

## Completato — S1 UI counterparty (02/06/2026)

| Task | Dettaglio |
|------|-----------|
| S1.1–S1.4 | Select Controparte/Direzione su collega registro + upload; badge «Fornitore · in» per riga |

File: `ContractReviewPage.jsx`, `contractReviewLabels.js`, test L1 + build OK.

## Completato — R3 TEST OK (02/06/2026)

- PR [#83](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/83): migrazione **070**, link bidirezionale job↔caso, badge UI
- PR [#84](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/84): hotfix `rowCase` — badge origine visibile in dettaglio caso
- Smoke L3 Epic R: **14/14** su `systemgest.netlify.app` (job #10 → caso #7, org 1001)

## Epic successive (ordine)

1. ~~R1 API import~~ ✅  
2. ~~R2 UI Import Jobs~~ ✅  
3. ~~R3 link bidirezionale~~ ✅  
4. ~~S1 fornitori UI~~ ✅ — vedi sotto  
5. **S2 fornitori DB** ← **adesso**  
6. N1–N2 notifiche  
7. H0 → H1 handoff commessa
