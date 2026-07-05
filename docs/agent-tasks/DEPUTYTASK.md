# DEPUTYTASK — Ingest norme / catalogo UNI (chiuso)

> **Creato**: 05/07/2026  
> **Chiuso**: 05/07/2026  
> **Stato**: CHIUSO — TEST OK (ingest norme + refactoring patrimonio)  
> **PR**: [#223](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/223) (fix catalogo/estrazione) · [#224](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/224) (dedup, purge, re-audit)  
> **Deploy VPS**: `normIngest`, `uniStoreConnector`, `ruleFieldExtractors`, `documentRegistryNorm` — OK

---

## Esito sessione

| Voce | Esito |
|------|--------|
| Upload ISO/TR 15608 + UNI 15614-1 | Catalogo UNI + codici corretti (PR #223) |
| Purge 28 norme legacy (tutti gli studi tranne Mason) | Hard-delete VPS OK |
| Ricaricamento manuale | QS Studio patrimonio Camellini #1992 OK; Mason #1990/#1991 OK |
| Duplicati in upload | Skip su `standard_code` (stessa org, esclusi obsoleti) — **lasciato com'è** |

## Upgrade backlog (non in scope)

**Agente manutenzione norme** (~30 gg): report duplicati DB + re-audit PDF con pipeline attuale; solo segnalazione, no delete automatico. Script base: `reaudit-norms-from-pdf-vps.js`, `list-norm-duplicates-vps.js`, `normValidityChecker.service.js`.

## Prompt deputy (prossimo task)

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

*(Sovrascrivere questo file al prossimo task.)*
