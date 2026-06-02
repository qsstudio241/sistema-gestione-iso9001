# DEPUTYTASK — Estensioni Riesame Requisiti

**Stato:** R3 TEST OK — slice **S1** pronta  
**Baseline `main`:** merge PR [#83](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/83) + hotfix [#84](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/84)  
**Piano completo:** [TASK_RIESAME_ESTENSIONI_SLICES.md](TASK_RIESAME_ESTENSIONI_SLICES.md)

## Comando nuova chat (incolla in Agents)

```
Leggi docs/agent-tasks/DEPUTYTASK.md e docs/agent-tasks/TASK_RIESAME_ESTENSIONI_SLICES.md (slice S1).
Esegui la slice S1 (UI fornitori — counterparty tab Documenti).
Chiudi con TEST OK o FIX NON APPLICABILI.
```

## Slice corrente: S1 — UI fornitori (counterparty)

| Task | Dettaglio |
|------|-----------|
| S1.1 | Tab Documenti: select Controparte Cliente/Fornitore/Interno |
| S1.2 | Select Direzione in entrata/uscita |
| S1.3 | Upload allegati con stessi campi |
| S1.4 | Badge visivo per riga |

## Completato — R3 TEST OK (02/06/2026)

- PR [#83](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/83): migrazione **070**, link bidirezionale job↔caso, badge UI
- PR [#84](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/84): hotfix `rowCase` — badge origine visibile in dettaglio caso
- Smoke L3 Epic R: **14/14** su `systemgest.netlify.app` (job #10 → caso #7, org 1001)

## Epic successive (ordine)

1. ~~R1 API import~~ ✅  
2. ~~R2 UI Import Jobs~~ ✅  
3. ~~R3 link bidirezionale~~ ✅  
4. **S1–S2 fornitori** ← **adesso**  
5. N1–N2 notifiche  
6. H0 → H1 handoff commessa
