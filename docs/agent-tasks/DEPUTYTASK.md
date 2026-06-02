# DEPUTYTASK — Estensioni Riesame Requisiti

**Stato:** R1 completata — slice **R2** da avviare  
**Piano completo:** [TASK_RIESAME_ESTENSIONI_SLICES.md](TASK_RIESAME_ESTENSIONI_SLICES.md)

## Comando nuova chat

```
Leggi docs/agent-tasks/TASK_RIESAME_ESTENSIONI_SLICES.md ed esegui la slice R2 (UI Import Jobs).
Chiudi con TEST OK o FIX NON APPLICABILI.
```

## Slice corrente: R2

Pulsante «Crea caso Riesame» in ImportJobsPage + modale conferma + apiService.

## Slice R1 — TEST OK

- Endpoint `POST /api/v1/contract-reviews/import-from-job`
- Jest: happy path, 404 org, 409 già linkato, 400 senza file
- Deploy VPS backend
