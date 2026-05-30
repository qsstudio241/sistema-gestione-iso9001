# DEPUTYTASK — NC Fase 1 · Chiusura slice 6–11

**Stato:** **TEST OK Fase 1 NC** — lead, 30/05/2026

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
| 8 email | Hook commentato alertScheduler (SMTP non configurato) | ✅ doc | `b23f79d` |

---

## Residui P2 (non bloccanti Fase 1)

- Smoke L3 email NC quando SMTP VPS attivo (`ALERT_ENABLED=true`)
- **Deploy VPS**: migrazione 071 + `deploy-controllers-to-vps.ps1` (credenziali SSH assenti in questo agente)
- Export CSV/PDF registro NC (Slice 7 report — backlog)
- Filtro azioni cross-NC a livello registro (opzionale)

---

## Comando deputy standard

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Aggiornato 30/05/2026 — NC Fase 1 completata*
