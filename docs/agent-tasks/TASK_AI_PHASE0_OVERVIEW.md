# ADR-010 Fase 0 — Fondazione AI: overview task paralleli

> **Riferimento vincolante**: [docs/adr/ADR-010-ai-agentic-architecture.md](../adr/ADR-010-ai-agentic-architecture.md)
> **Parallelismo**: TASK 0-A, 0-B, 0-C eseguibili in parallelo. TASK 0-D dopo 0-A.

---

## Come lanciare i task su Cursor multitask

Aprire 3 agenti Cursor in parallelo, ognuno con il proprio brief:

1. **Agente 1**: `Leggi docs/agent-tasks/TASK_AI_0A_PROVIDER_ADAPTER.md ed eseguilo.`
2. **Agente 2**: `Leggi docs/agent-tasks/TASK_AI_0B_NORM_REQUIREMENTS_DB.md ed eseguilo.`
3. **Agente 3**: `Leggi docs/agent-tasks/TASK_AI_0C_LICENSES_AUDIT_TRAIL.md ed eseguilo.`

Dopo che l'agente 1 (0-A) ha completato:

4. **Agente 4**: `Leggi docs/agent-tasks/TASK_AI_0D_MIGRATE_IMPORT.md ed eseguilo.`

---

## Mappa file — nessun conflitto Git tra task

| Task | File creati/modificati | Conflitto possibile |
|---|---|---|
| 0-A | `backend/src/services/aiProviderAdapter.js`, `backend/src/services/adapters/*.js` | Nessuno |
| 0-B | `backend/database/migrations/052_*.sql`, `backend/scripts/import-norms-from-markdown.js` | Nessuno |
| 0-C | `backend/src/services/moduleLicense.service.js` (modifica), `backend/database/migrations/053_*.sql`, `backend/src/middleware/aiAuditTrail.middleware.js` | Nessuno |
| 0-D | `backend/src/services/importAiExtraction.service.js` (refactor) | Con 0-A (usa il suo output) |

---

## Definition of Done per Fase 0

- [ ] `aiProviderAdapter.js` funziona con Gemini Flash (test con chiave reale o mock)
- [ ] 6 norme da `docs/Normative/*.md` caricate in tabella `norm_requirements` strutturate per clausola
- [ ] `ai_assist`, `ai_norms`, `ai_review` presenti in `KNOWN_MODULE_KEYS`
- [ ] Tabella `ai_interactions` creata con migrazione
- [ ] `importAiExtraction.service.js` usa l'adapter invece di `fetch` diretto
- [ ] Tutti i test L1 passano, build pulita
