# DEPUTYTASK — Estensioni Riesame Requisiti

**Stato:** S2 TEST OK agente — slice **N1** in corso  
**Baseline:** PR [#86](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/86) (S1+S2)  
**Piano completo:** [TASK_RIESAME_ESTENSIONI_SLICES.md](TASK_RIESAME_ESTENSIONI_SLICES.md)

## Slice corrente: N1 — Eventi notifica backend

| Task | Dettaglio |
|------|-----------|
| N1.1 | Evento `pending_approval` su QUOTE_APPROVAL e FINAL_REVIEW→APPROVED |
| N1.2 | Evento `assigned` su cambio `current_assignee_id` |
| N1.3 | Tabella `commercial_case_notifications` (migrazione **074**) |
| N1.4 | Test Jest + deploy VPS |

## Completato — S2 supplier_id (02/06/2026)

- Migrazione **073**, backend + UI dropdown/badge/P9, Jest OK, VPS deploy OK
- PR [#86](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/86)

## Epic successive (ordine)

1. ~~R1–R3~~ ✅  
2. ~~S1–S2~~ ✅  
3. **N1** ← adesso  
4. N2 email  
5. H0 (H-A stub) → H1 handoff
