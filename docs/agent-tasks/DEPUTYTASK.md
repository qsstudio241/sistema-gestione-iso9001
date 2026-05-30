# DEPUTYTASK — NC Fase 1 — Chiusura slice 6–11

**Stato:** **TEST OK Fase 1 NC** — chiusura lead, 30/05/2026 (deploy VPS + mig 071)

---

## Tabella slice | stato | commit

| Slice | Descrizione | Stato | Commit |
|-------|-------------|-------|--------|
| 1–5 | Pilastri ISO 10.2, gate, allegati, migrazione 071 | ✅ | `8f66d93` |
| 6 | Creazione NC manuale + badge reclamo + PendingIssuesCascade | ✅ | `b23f79d` |
| 6/8 | Griglia `SgqDataGrid` + dettaglio sotto riga | ✅ | `b23f79d` |
| 7 | Workflow `status-btn` standard | ✅ | `b23f79d` |
| 7/8 | Filtri scadenze API `due_within_days` + UI | ✅ | `b23f79d` |
| 9 | Link audit ↔ NC (griglia + PendingIssuesCascade) | ✅ | `b23f79d` |
| 11 | Test regressione push ISO + GUIDA NC | ✅ | `b23f79d` |
| 8 email | `runNcDueAlertJob` + flag `NC_ALERT_ENABLED` | ✅ | `d80dafa` |
| **Ops** | Migrazione **071** VPS + `deploy-controllers-to-vps.ps1` + health | ✅ | 30/05/2026 |

---

## Residui P2 (non bloccanti Fase 1)

- Impostare `NC_ALERT_ENABLED=true` sul VPS dopo smoke L3 email
- Export CSV/PDF registro NC (Slice 7 report — backlog)
- Filtro azioni cross-NC a livello registro (opzionale)

---

## Comando deputy standard

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Aggiornato 30/05/2026 — NC Fase 1 completata con deploy produzione*
