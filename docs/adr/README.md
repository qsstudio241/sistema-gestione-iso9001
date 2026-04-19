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

## Processo Approvazione

1. **Planner Agent** redige ADR in `/docs/adr/`
2. **Reviewer Agent** valuta coerenza con style.instructions.md
3. **Commit ADR** → diventa vincolante per Implementer Agent

## Indice ADR

Tutti i documenti in `docs/adr/`. Per numeri con più file (es. due ADR-002, tre ADR-003) il nome file è univoco.

| File | Titolo | Stato |
|------|--------|-------|
| [ADR-001-multi-agent-workflow](./ADR-001-multi-agent-workflow.md) | Multi-Agent Workflow con Tool Approval | Accettato |
| [ADR-002-offline-first-sync](./ADR-002-offline-first-sync.md) | Offline-First Sync Strategy | Accettato |
| [ADR-002-checklist-alignment-strategy](./ADR-002-checklist-alignment-strategy.md) | Checklist Alignment Strategy | Accettato |
| [ADR-003-pwa-mobile-android-strategy](./ADR-003-pwa-mobile-android-strategy.md) | PWA Mobile Android Strategy | Accettato |
| [ADR-003-bidirectional-sync](./ADR-003-bidirectional-sync.md) | Sync bidirezionale | Accettato |
| [ADR-003-database-architecture-processes-analysis](./ADR-003-database-architecture-processes-analysis.md) | Database Architecture / Processi | Accettato |
| [ADR-004-mobile-auth-localstorage](./ADR-004-mobile-auth-localstorage.md) | Auth mobile (localStorage JWT) | Accettato |
| [ADR-005-attachment-storage-strategy](./ADR-005-attachment-storage-strategy.md) | Strategia storage allegati | Accettato |
| [ADR-006-auto-reconcile-cache-sync](./ADR-006-auto-reconcile-cache-sync.md) | Auto-reconcile cache / multi-device | Proposta approvata |
| [ADR-007-logout-offline-backup-e-mirror-cartella-pc](./ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) | Logout senza perdita lavoro locale + backup PC | Proposto |

## Convenzioni

- **Naming**: `ADR-NNN-titolo-kebab-case.md`
- **Numerazione**: Sequenziale, mai riutilizzare numeri
- **Lingua**: Italiano (terminologia ISO 9001:2015 conforme UNI)
- **Formato**: Markdown con frontmatter YAML

## Riferimenti

- **ISO 9001:2015 punto 7.5**: Informazioni documentate
- **ISO 9001:2015 punto 6.1**: Azioni per affrontare rischi e opportunità
