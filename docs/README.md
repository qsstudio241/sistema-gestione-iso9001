# Documentazione SGQ ISO 9001

> Ingresso umano e agente. Per contesto stack: [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md).

---

## Percorsi rapidi

| Obiettivo | Vai a |
|----------|-------|
| **Indice completo con tag** | [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md) |
| **Procedure e lezioni apprese** | [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) |
| **Priorità e backlog** | [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) |
| **Deploy release** | [how-to/deploy.md](how-to/deploy.md) |
| **Schema DB / API** | [reference/](reference/) |
| **Mini-spec feature** | [specs/](specs/) |
| **Decisioni architettura** | [adr/README.md](adr/README.md) |
| **Task agente attivo** | [agent-tasks/DEPUTYTASK.md](agent-tasks/DEPUTYTASK.md) |
| **Alert, scadenze, tipi documento** | [AGENT_ALERTS_AND_DOC_TYPES.md](AGENT_ALERTS_AND_DOC_TYPES.md) |

---

## Struttura cartelle (Fase 2)

```
docs/
  how-to/      → procedure (deploy, migrazioni)
  reference/   → schemi DB, API
  specs/       → mini-specifiche prodotto
  adr/         → decisioni architetturali
  archive/     → storico
  agent-tasks/ → brief Cursor deputy
```

I file nella root di `docs/` con **solo redirect** esistono per compatibilità link vecchi.
