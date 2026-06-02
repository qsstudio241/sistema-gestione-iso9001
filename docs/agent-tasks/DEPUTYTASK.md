# DEPUTYTASK — Estensioni Riesame Requisiti

**Stato:** R2 completata — slice **R3** pronta  
**Baseline `main`:** merge PR [#81](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/81) + hotfix [#82](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/82)  
**Piano completo:** [TASK_RIESAME_ESTENSIONI_SLICES.md](TASK_RIESAME_ESTENSIONI_SLICES.md)

## Comando nuova chat (incolla in Agents)

```
Leggi docs/agent-tasks/DEPUTYTASK.md e docs/agent-tasks/TASK_RIESAME_ESTENSIONI_SLICES.md (slice R3).
Esegui la slice R3 (link bidirezionale job ↔ caso).
Chiudi con TEST OK o FIX NON APPLICABILI.
```

## Slice corrente: R3 — Link bidirezionale

| Task | Dettaglio |
|------|-----------|
| Migrazione **070** | `source_import_job_id` su `commercial_cases`; `commercial_case_id` su `import_job_files` |
| UI caso | Badge «Origine: Import job #N» |
| UI job | Badge «Caso Riesame #N»; evita doppio create |
| Idempotenza | 409 con link caso esistente |

**Nota:** migrazione **069** già applicata su VPS — fix `CHK_attachments_parent` per allegati `commercial_case_id` (PR #82).

## Completato — R2 TEST OK (02/06/2026)

- PR [#81](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/81): pulsante «Crea caso Riesame», modale, `importContractCaseFromJob`, redirect
- PR [#82](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/82): migrazione 069 DB (blocco INSERT allegati)
- Smoke L3 Playwright autonomo: Import PDF → estrai → crea caso → tab Documenti → refresh OK (caso #5 org 1001)

## Epic successive (ordine)

1. ~~R1 API import~~ ✅  
2. ~~R2 UI Import Jobs~~ ✅  
3. **R3** link bidirezionale ← **adesso**  
4. S1–S2 fornitori  
5. N1–N2 notifiche  
6. H0 → H1 handoff commessa
