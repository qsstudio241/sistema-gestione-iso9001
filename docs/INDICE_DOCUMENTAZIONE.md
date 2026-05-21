# Indice e convenzioni documentazione

> Punto di ingresso per capire dove si trova cosa. Aggiornato: 2026-05-21.  
> **TOC interno guida operativa**: [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md#indice-rapido-navigazione).

---

## Legenda tag

| Tag | Significato |
|-----|-------------|
| **attivo** | Documentazione corrente — aggiornare quando cambia il sistema |
| **storico** | Solo consultazione — non duplicare contenuti altrove |
| **agente** | Brief/task per Cursor Agents (`DEPUTYTASK`, backlog AI) |
| **normativa** | Testi norma o checklist di dominio (non doc tecnica deploy) |
| **tooling** | Istruzioni GitHub Copilot / agenti IDE |

---

## Ingressi obbligatori (ordine sessione)

| Tag | File | Note |
|-----|------|------|
| attivo | [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) | Stack, infra, workflow |
| attivo | [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) | Fasi, backlog, open points |
| attivo | [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) | Esperienza operativa, deploy, Word, DB, DoD test |
| attivo | [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md) | Questo file |

---

## Documentazione attiva (`docs/`)

| Tag | Scopo | File |
|-----|-------|------|
| attivo | Mini-spec commerciale §8.2 | [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) |
| attivo | Office round-trip WebDAV | [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md) |
| attivo | Schema DB (modifiche schema) | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) |
| attivo | Quick-ref DB | [DATABASE.md](DATABASE.md) |
| attivo | Quick-ref API | [BACKEND_API.md](BACKEND_API.md) |
| attivo | Mapping tabelle | [DATABASE_MAPPING.md](DATABASE_MAPPING.md) |
| attivo | Deploy Netlify | [NETLIFY_DEPLOYMENT.md](NETLIFY_DEPLOYMENT.md) |
| attivo | Checklist release | [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md) |
| attivo | Deploy backend VPS | [DEPLOY_BACKEND_VPS.md](DEPLOY_BACKEND_VPS.md) |
| attivo | Troubleshooting deploy | [DEPLOY_TROUBLESHOOTING.md](DEPLOY_TROUBLESHOOTING.md) |
| attivo | Accesso SSH/API agenti | [ACCESSO_DEPLOY_AGENTS.md](ACCESSO_DEPLOY_AGENTS.md) |
| attivo | Offline / sync / logout | [GESTIONE_PERDITA_CONNESSIONE.md](GESTIONE_PERDITA_CONNESSIONE.md) |
| attivo | RBAC multi-tenant | [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| attivo | Utenti, checklist, report | [SCHEMA_UTENTI_CHECKLIST_SISTEMI_REPORT.md](SCHEMA_UTENTI_CHECKLIST_SISTEMI_REPORT.md) |
| attivo | Split tenant DB | [MIGRATION_PLAN_SPLIT_TENANTS.md](MIGRATION_PLAN_SPLIT_TENANTS.md) |
| attivo | Manuali utente/ops | [MANUALE_UTENTE.md](MANUALE_UTENTE.md), [MANUALE_OPERATIVO_FASE1.md](MANUALE_OPERATIVO_FASE1.md) |
| attivo | Riferimenti infra | [REFERENCE.md](REFERENCE.md) |
| attivo | Flussi audit / tipologie | [FLUSSO_TIPOLOGIA_AUDIT.md](FLUSSO_TIPOLOGIA_AUDIT.md), [TIPI_AUDIT_E_FLESSIBILITA.md](TIPI_AUDIT_E_FLESSIBILITA.md) |
| attivo | Assegnazioni | [ASSEGNAZIONE_REPORT_E_CHECKLIST.md](ASSEGNAZIONE_REPORT_E_CHECKLIST.md), [ASSEGNAZIONE_STANDARD_UTENTI.md](ASSEGNAZIONE_STANDARD_UTENTI.md) |
| attivo | Template Word placeholder | [ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md](ISTRUZIONI_PLACEHOLDER_TEMPLATE_WORD.md) |
| attivo | Roadmap template custom | [ROADMAP_TEMPLATE_E_CHECKLIST_PERSONALIZZATE.md](ROADMAP_TEMPLATE_E_CHECKLIST_PERSONALIZZATE.md) |
| attivo | Backup DB / branch | [BACKUP_DATABASE_E_USO_BRANCH.md](BACKUP_DATABASE_E_USO_BRANCH.md) |
| attivo | Verifica isolamento dati | [VERIFICA_ISOLAMENTO_DATI.md](VERIFICA_ISOLAMENTO_DATI.md) |
| attivo | Debug mobile | [MOBILE_DEBUG_UTILS.md](MOBILE_DEBUG_UTILS.md) |
| attivo | Piano modulo saldatura | [piano_modulo_saldatura_v2.plan.md](piano_modulo_saldatura_v2.plan.md) |

**Hub deploy (oggi frammentato, Fase 2):** checklist → `DEPLOY_CHECKLIST_RELEASE` + VPS → `DEPLOY_BACKEND_VPS` + errori → `DEPLOY_TROUBLESHOOTING` + agenti → `ACCESSO_DEPLOY_AGENTS`. Sintesi operativa in [GUIDA_CONSOLIDATA § A](GUIDA_CONSOLIDATA.md#a-checklist-custom-sync-deploy-vps).

**Open points trasversali:** [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) (*Open points e memoria trasversale*) + [adr/ADR-007](adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md).

---

## ADR — decisioni architetturali

| Tag | File | Note |
|-----|------|------|
| attivo | [adr/README.md](adr/README.md) | Indice completo; numeri duplicati (002/003) — identificare dal **nome file** |
| attivo | [adr/ADR-008-event-sourcing-sync.md](adr/ADR-008-event-sourcing-sync.md) | **Vincolante** per sync — leggere prima di toccare sync/lock |
| attivo | [adr/ADR-009-multi-standard-architettura-per-norma.md](adr/ADR-009-multi-standard-architettura-per-norma.md) | Multi-standard / document_type |
| attivo | [adr/ADR-010-ai-agentic-architecture.md](adr/ADR-010-ai-agentic-architecture.md) | AI agentica, NormBroker, licenze |

Elenco storico ADR-001…007: tabella in [adr/README.md](adr/README.md).

---

## Agent tasks (`docs/agent-tasks/`)

| Tag | File | Note |
|-----|------|------|
| agente | [agent-tasks/DEPUTYTASK.md](agent-tasks/DEPUTYTASK.md) | **Unico brief attivo** — sovrascritto a ogni task |
| agente | [agent-tasks/README.md](agent-tasks/README.md) | Convenzione deputy |
| agente | `TASK_AI_*.md`, `TASK_SPRINT*.md`, … | Backlog/spec — **non** aggiornare come fonte operativa |
| agente | [agent-tasks/MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md](agent-tasks/MINI_CHECKLIST_VALIDAZIONE_DEPUTY.md) | Chiusura deputy |

---

## Storico e archive

| Tag | Percorso | Note |
|-----|----------|------|
| storico | [archive/sessions/](archive/sessions/) | `SESSION_NOTES_*` feb–mar 2026 |
| storico | [archive/sessions/COMMIT_MESSAGES.md](archive/sessions/COMMIT_MESSAGES.md) | Template commit sessione 08/02/2026 |
| storico | [archive/](archive/) | `CLEANUP_ROADMAP`, `ROADMAP_RESET_COMPLETO` |
| storico | [sessions/README.md](sessions/README.md) | Punta a guida + archive |

---

## Normative e checklist cliente (dominio)

| Tag | Percorso | Note |
|-----|----------|------|
| normativa | [Normative/](Normative/) | UNI ISO 9001, 14001, 45001, 3834-* |
| normativa | [../CheckList/](../CheckList/) | Template checklist cliente |
| normativa | [../Check List Audit/](../Check%20List%20Audit/) | Checklist audit in campo |

---

## Root e moduli

| Tag | File | Note |
|-----|------|------|
| attivo | [../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) | Ingresso AI |
| tooling | [../.github/copilot-instructions.md](../.github/copilot-instructions.md) | Istruzioni Copilot |
| tooling | [../.github/agents/](../.github/agents/) | Planner / Implementer / Reviewer |
| attivo | [../app/README.md](../app/README.md), [../backend/README.md](../backend/README.md) | Avvio moduli |

---

## Convenzioni operative

- **Esperienza e procedure**: solo [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) + [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) — **non** creare `SESSION_NOTES_*.md`.
- **Principi di scrittura doc**: [GUIDA_CONSOLIDATA — Principi di documentazione](GUIDA_CONSOLIDATA.md#principi-di-documentazione-chiarezza-e-best-practice).
- **Deputy**: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Roadmap riorganizzazione documentazione

| Fase | Stato | Contenuto |
|------|-------|-----------|
| **1** | **Fatto (2026-05-21)** | TOC in `GUIDA_CONSOLIDATA`, tag in questo indice, `COMMIT_MESSAGES` in archive, ADR 008–010 in `adr/README` |
| **2** | Pianificata | Cartelle `how-to/`, `reference/`, hub deploy unico |
| **3** | Pianificata | Rinumerazione ADR univoca (opzionale), split guida per tema |

Fase 2–3: vedi proposta storica sotto (non obbligatoria subito).

<details>
<summary>Proposta Fase 2–3 (riferimento)</summary>

- Root: `PROJECT_CONTEXT.md` + `README.md` umano.
- `docs/how-to/deploy.md` unifica `DEPLOY_*`.
- ADR: sequenza univoca o suffissi `ADR-003a` nel README senza rinominare file.
- Task agente completati → `archive/agent-tasks/`.

</details>
