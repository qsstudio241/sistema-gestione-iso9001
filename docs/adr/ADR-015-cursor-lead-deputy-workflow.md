# ADR-015: Cursor Lead/Deputy Workflow (supera ADR-001)

---

**Stato**: Accettato  
**Data**: 2026-06-30  
**Autore**: Senior Lead (Cursor Agent)  
**Tag**: governance, workflow, agente

---

## Contesto e Problema

ADR-001 (2025-12-14) descriveva un workflow a tre agenti (Planner / Implementer / Reviewer) basato su GitHub Copilot, con riferimenti a path obsoleti (`src/` anziché `app/`) e processi non più in uso.

Il progetto ha adottato **Cursor** come IDE principale con un modello **Lead/Deputy**:
- il Lead pianifica, decide l'architettura e prepara brief (`DEPUTYTASK.md`);
- il Deputy esegue task circoscritti, commit atomici, test L1 e apre/aggiorna PR.

I vecchi percorsi `.github/agents/` e le istruzioni Copilot (`copilot-instructions.md`) restano nel repo come archivio storico ma **non** governano il workflow corrente.

---

## Decisione

**Il workflow di sviluppo ufficiale è Lead/Deputy su Cursor**, come descritto in `sgq-operating-memory.mdc` e nel metodo operativo `sgq-workflow-method.mdc`.

### Principi vincolanti

1. **Brief attivo**: sempre in `docs/agent-tasks/DEPUTYTASK.md` (file unico, sovrascritto a ogni task).
2. **Processo approvazione ADR**: Lead redige ADR → Deputy lo implementa → merge PR → diventa vincolante.
3. **Commit atomici**: una slice verticale = un commit verificabile (DoD esplicita).
4. **Test L1 obbligatori** prima del merge: build Vite (`app/`) + test Jest/Vitest mirati; per fix a basso rischio (1–2 file, nessuna logica sync/DB) è accettabile affidarsi alla CI Netlify.
5. **Nessun SESSION_NOTES_*.md**: tutta l'esperienza operativa in `GUIDA_CONSOLIDATA.md` + `PROJECT_ROADMAP.md`.

### Path correnti (post-migrazione Fase 2, 2026-05)

| Componente | Path |
|------------|------|
| Frontend React | `app/` |
| Backend Node/Express | `backend/src/` |
| Regole agente | `.cursor/rules/*.mdc` |
| Brief deputy | `docs/agent-tasks/DEPUTYTASK.md` |
| ADR | `docs/adr/` |
| How-to / deploy | `docs/how-to/` |

### Path legacy (solo archivio — non usare per workflow corrente)

| Path | Nota |
|------|------|
| `.github/agents/` | Workflow Copilot 3-agenti — **obsoleto** |
| `.github/copilot-instructions.md` | Istruzioni Copilot — **obsoleto** |
| `src/` (root) | Path pre-Fase 2 — il codice è ora in `app/` e `backend/src/` |

---

## Conseguenze

**Positive**
- Governance chiara: un solo brief attivo, commit tracciabili, PR per ogni slice.
- Riduzione confusione tra workflow Copilot e workflow Cursor.
- Path corretti nei brief → il Deputy trova i file senza ambiguità.

**Negative / rischi**
- Nessun breaking change; i file `.github/agents/` restano per riferimento storico.
- I link ad ADR-001 nei documenti più vecchi rimangono validi (ADR-001 è marcato "Superato da ADR-015" ma non cancellato).

---

## Riferimenti

- [ADR-001-multi-agent-workflow.md](ADR-001-multi-agent-workflow.md) — **Superato da questo ADR**
- [ADR-010-ai-agentic-architecture.md](ADR-010-ai-agentic-architecture.md) — Architettura AI agentica
- [`.cursor/rules/sgq-operating-memory.mdc`](../../.cursor/rules/sgq-operating-memory.mdc) — Golden rules operativi
- [`.cursor/rules/sgq-workflow-method.mdc`](../../.cursor/rules/sgq-workflow-method.mdc) — Metodo slice/multitasking
- [docs/agent-tasks/DEPUTYTASK.md](../agent-tasks/DEPUTYTASK.md) — Brief attivo
