# DEPUTYTASK — NC Fase 1 · Chiusura slice 6–11

**Stato:** **CHIUSO / TEST OK Fase 1 NC** — simulazione operativa completata, 30/05/2026

---

## Tabella slice | stato | commit

| Slice | Descrizione | Stato | Commit |
|-------|-------------|-------|--------|
| 1–5 | Pilastri ISO 10.2, gate, allegati, migrazione 071 | ✅ | `8f66d93` |
| 6 | Creazione NC manuale + badge reclamo + PendingIssuesCascade | ✅ | `b23f79d` |
| 6/8 | Griglia `SgqDataGrid` + dettaglio sotto riga | ✅ | `b23f79d` / fix select `d80dafa` |
| 7 | Workflow `status-btn` standard | ✅ | `b23f79d` |
| 7/8 | Filtri scadenze API `due_within_days` + UI | ✅ | `b23f79d` |
| 9 | Link audit ↔ NC (griglia + PendingIssuesCascade) | ✅ | `b23f79d` |
| 11 | Test regressione push ISO + GUIDA NC | ✅ | `b23f79d` |
| 8 email | Alert scadenze NC (`NC_ALERT_ENABLED`) | ✅ code | `d80dafa` |
| Simulazione | Smoke produzione Ruolo A+B + workflow API | ✅ | sessione 30/05/2026 |
| FK sezione | Errore 400 sezione incompatible (non 500) | ✅ | commit sessione |

---

## Residui P2 (non bloccanti Fase 1)

- Smoke L3 email NC quando SMTP VPS attivo (`NC_ALERT_ENABLED=true` + `SMTP_*`)
- Export CSV/PDF registro NC (Slice 7 report — backlog)
- Sezioni ISO dinamiche in `NcCreateModal` per audit multi-standard
- Filtro azioni cross-NC a livello registro (opzionale)
- Agente AI CAPA (Fase 2)

---

## Comando deputy standard

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Aggiornato 30/05/2026 — NC Fase 1 chiusa con simulazione TEST OK*
