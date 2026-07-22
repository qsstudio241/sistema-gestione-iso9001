# Architecture Decision Records (ADR)

## Cos'è un ADR?

Un **Architecture Decision Record** documenta decisioni architetturali significative prese durante lo sviluppo del progetto, seguendo il principio di tracciabilità richiesto dalla **ISO 9001:2015 punto 7.5** (Informazioni documentate).

## Struttura ADR

Ogni ADR segue il template standard:

- **Stato**: Proposto | Accettato | Superato | Deprecato
- **Contesto**: Problema o opportunità
- **Decisione**: Scelta architetturale
- **Conseguenze**: Impatti (positivi e negativi)
- **Rischi & Mitigazioni**: Analisi rischi (ISO 9001:2015 punto 6.1)

## Processo Approvazione (workflow corrente Lead/Deputy — ADR-015)

1. **Lead** redige ADR in `docs/adr/`
2. **Deputy** implementa e verifica coerenza con il codebase
3. **Commit ADR** → merge PR → diventa vincolante

> I riferimenti a "Planner / Implementer / Reviewer Agent" sono legacy (ADR-001, superato da ADR-015).

## Indice ADR

Tutti i documenti in `docs/adr/`.

### Numerazione duplicata (legacy)

Esistono **più file con lo stesso prefisso numerico**. **Non rinominare** i file (rischio link rotti). Per citare un ADR usare sempre il **nome file completo**, non solo il numero.

| Prefisso | File distinti | Quando citare quale |
|----------|---------------|---------------------|
| **ADR-002** | [ADR-002-offline-first-sync](./ADR-002-offline-first-sync.md) | Sync offline-first, strategia cache |
| | [ADR-002-checklist-alignment-strategy](./ADR-002-checklist-alignment-strategy.md) | Allineamento checklist ISO/custom |
| **ADR-003** | [ADR-003-pwa-mobile-android-strategy](./ADR-003-pwa-mobile-android-strategy.md) | PWA Android |
| | [ADR-003-bidirectional-sync](./ADR-003-bidirectional-sync.md) | Sync bidirezionale (pre–ADR-008) |
| | [ADR-003-database-architecture-processes-analysis](./ADR-003-database-architecture-processes-analysis.md) | Architettura DB / processi |

**Sync corrente:** [ADR-008](./ADR-008-event-sourcing-sync.md) sostituisce parzialmente 002/003/006 — citare ADR-008 per nuovo codice sync.

Rinumerazione sequenziale univoca: backlog doc Fase 3 (vedi [INDICE_DOCUMENTAZIONE.md](../INDICE_DOCUMENTAZIONE.md)).

### ADR critici per sviluppo corrente

| File | Titolo | Stato |
|------|--------|-------|
| [ADR-008-event-sourcing-sync](./ADR-008-event-sourcing-sync.md) | Event-Sourced Sync (target sync) | Accettato |
| [ADR-009-multi-standard-architettura-per-norma](./ADR-009-multi-standard-architettura-per-norma.md) | Multi-standard / document_type per norma | Accettato |
| [ADR-010-ai-agentic-architecture](./ADR-010-ai-agentic-architecture.md) | Architettura AI agentica (NormBroker, RAG) | Accettato |
| [ADR-011-registry-norm-sot](./ADR-011-registry-norm-sot.md) | Registro documentale SoT metadati norma | Accettato |

### Elenco completo

| File | Titolo | Stato |
|------|--------|-------|
| [ADR-001-multi-agent-workflow](./ADR-001-multi-agent-workflow.md) | Multi-Agent Workflow con Tool Approval | **Superato da ADR-015** |
| [ADR-015-cursor-lead-deputy-workflow](./ADR-015-cursor-lead-deputy-workflow.md) | Cursor Lead/Deputy Workflow | Accettato |
| [ADR-002-offline-first-sync](./ADR-002-offline-first-sync.md) | Offline-First Sync Strategy | Accettato |
| [ADR-002-checklist-alignment-strategy](./ADR-002-checklist-alignment-strategy.md) | Checklist Alignment Strategy | Accettato |
| [ADR-003-pwa-mobile-android-strategy](./ADR-003-pwa-mobile-android-strategy.md) | PWA Mobile Android Strategy | Accettato |
| [ADR-003-bidirectional-sync](./ADR-003-bidirectional-sync.md) | Sync bidirezionale | Accettato |
| [ADR-003-database-architecture-processes-analysis](./ADR-003-database-architecture-processes-analysis.md) | Database Architecture / Processi | Accettato |
| [ADR-004-mobile-auth-localstorage](./ADR-004-mobile-auth-localstorage.md) | Auth mobile (localStorage JWT) | Accettato |
| [ADR-005-attachment-storage-strategy](./ADR-005-attachment-storage-strategy.md) | Strategia storage allegati | Accettato |
| [ADR-006-auto-reconcile-cache-sync](./ADR-006-auto-reconcile-cache-sync.md) | Auto-reconcile cache / multi-device | Proposta approvata |
| [ADR-007-logout-offline-backup-e-mirror-cartella-pc](./ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) | Logout senza perdita lavoro locale + backup PC | Proposto |
| [ADR-008-event-sourcing-sync](./ADR-008-event-sourcing-sync.md) | Event-Sourced Sync (sostituisce parzialmente 002/003/006) | Accettato |
| [ADR-009-multi-standard-architettura-per-norma](./ADR-009-multi-standard-architettura-per-norma.md) | Multi-standard / AI-ready per norma | Accettato |
| [ADR-010-ai-agentic-architecture](./ADR-010-ai-agentic-architecture.md) | AI agentica: NormBroker, RAG, licenze | Accettato |
| [ADR-011-registry-norm-sot](./ADR-011-registry-norm-sot.md) | Registro documentale SoT metadati norma (R1–R7) | Accettato |

## Convenzioni

- **Naming**: `ADR-NNN-titolo-kebab-case.md`
- **Numerazione**: Sequenziale, mai riutilizzare numeri
- **Lingua**: Italiano (terminologia ISO 9001:2015 conforme UNI)
- **Formato**: Markdown con frontmatter YAML

## Riferimenti

- **ISO 9001:2015 punto 7.5**: Informazioni documentate
- **ISO 9001:2015 punto 6.1**: Azioni per affrontare rischi e opportunità
