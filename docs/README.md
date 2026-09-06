# Documentazione SGQ ISO 9001

> Ingresso umano e agente. Stack/bussola: [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md).  
> **Dieta token:** non iniettare GUIDA né roadmap intere — avvio in [AGENTS.md](../AGENTS.md) (`limit: 45` su § Stato). KB prodotto = DB (no vault Obsidian in-app).

---

## Percorsi rapidi

| Obiettivo | Vai a |
|----------|-------|
| **Indice completo con tag** | [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md) |
| **Procedure e lezioni** (a sezioni) | [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) |
| **Priorità** (solo § Stato in avvio) | [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica) |
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
