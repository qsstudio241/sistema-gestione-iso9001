# Indice e convenzioni documentazione

> Punto di ingresso per capire dove si trova cosa. Aggiornato: 2026-06-07.  
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
| attivo | [AGENTS.md](../AGENTS.md) | Avvio dieta: CONTEXT + roadmap **solo** § Stato; GUIDA a sezioni |
| attivo | [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) | Stack, bussola moduli, regole critiche |
| attivo | [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) | In avvio: **solo** § Stato attuale e priorità |
| attivo | [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) | Esperienza operativa **a sezioni** (non intera in avvio) |
| attivo | [HANDOFF_TEMPLATE.md](agent-tasks/HANDOFF_TEMPLATE.md) | Slice non chiusa: copiare nel DEPUTYTASK attivo |
| attivo | [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md) | Questo file |
| attivo | [README.md](README.md) | Mappa cartelle how-to / reference / specs |

---

## Struttura cartelle (Fase 2)

| Cartella | Contenuto | README |
|----------|-----------|--------|
| [how-to/](how-to/) | Procedure deploy, migrazioni DB | [how-to/README.md](how-to/README.md) |
| [reference/](reference/) | Schema DB, API, mapping | [reference/README.md](reference/README.md) |
| [specs/](specs/) | Mini-specifiche prodotto | [specs/README.md](specs/README.md) |
| [docs/README.md](README.md) | Ingresso umano | — |

I file nella root di `docs/` con titolo *Documento spostato* sono **redirect** per link vecchi.

---

## How-to — procedure

| Tag | Scopo | File |
|-----|-------|------|
| attivo | **Hub deploy** | [how-to/deploy.md](how-to/deploy.md) |
| attivo | Checklist release | [how-to/DEPLOY_CHECKLIST_RELEASE.md](how-to/DEPLOY_CHECKLIST_RELEASE.md) |
| attivo | Deploy backend VPS | [how-to/DEPLOY_BACKEND_VPS.md](how-to/DEPLOY_BACKEND_VPS.md) |
| attivo | Troubleshooting deploy | [how-to/DEPLOY_TROUBLESHOOTING.md](how-to/DEPLOY_TROUBLESHOOTING.md) |
| attivo | Deploy Netlify | [how-to/NETLIFY_DEPLOYMENT.md](how-to/NETLIFY_DEPLOYMENT.md) |
| attivo | Accesso SSH/API agenti | [how-to/ACCESSO_DEPLOY_AGENTS.md](how-to/ACCESSO_DEPLOY_AGENTS.md) |
| attivo | Hub migrazioni DB | [how-to/database-migrations.md](how-to/database-migrations.md) |

---

## Reference — schemi e API

| Tag | Scopo | File |
|-----|-------|------|
| attivo | Schema DB | [reference/DATABASE_SCHEMA.md](reference/DATABASE_SCHEMA.md) |
| attivo | Quick-ref DB | [reference/DATABASE.md](reference/DATABASE.md) |
| attivo | Quick-ref API | [reference/BACKEND_API.md](reference/BACKEND_API.md) |
| attivo | Mapping tabelle | [reference/DATABASE_MAPPING.md](reference/DATABASE_MAPPING.md) |
| attivo | Libreria componenti UI | [reference/LIBRERIA_UI_SGQ.md](reference/LIBRERIA_UI_SGQ.md) |
| attivo | DNA visivo UI (token, anti-pattern, 3 schermate) | [`app/src/design-system/README.md`](../app/src/design-system/README.md) |

---

## Specs — requisiti prodotto

| Tag | Scopo | File |
|-----|-------|------|
| attivo | Check prodotto Mobile + AI | [specs/PRODUCT_CHECK_MOBILE_AI.md](specs/PRODUCT_CHECK_MOBILE_AI.md) |
| attivo | Riesame requisiti §8.2 | [specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) |
| attivo | Office WebDAV | [specs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](specs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md) |
| attivo | Modulo saldatura | [specs/piano_modulo_saldatura_v2.plan.md](specs/piano_modulo_saldatura_v2.plan.md) |
| proposto | Material Compliance AI (certificati 3.1) | [specs/MODULO_MATERIAL_COMPLIANCE_AI.md](specs/MODULO_MATERIAL_COMPLIANCE_AI.md) · [PLAN](agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md) · ADR-020…024 |

---

## Documentazione attiva (root `docs/`)

| Tag | Scopo | File |
|-----|-------|------|
| attivo | Offline / sync / logout | [GESTIONE_PERDITA_CONNESSIONE.md](GESTIONE_PERDITA_CONNESSIONE.md) |
| attivo | RBAC multi-tenant | [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| agente | Alert, scadenze, tipi documento | [AGENT_ALERTS_AND_DOC_TYPES.md](AGENT_ALERTS_AND_DOC_TYPES.md) |
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

**Deploy:** ingresso unico [how-to/deploy.md](how-to/deploy.md). Esperienza operativa: [GUIDA_CONSOLIDATA § A](GUIDA_CONSOLIDATA.md#a-checklist-custom-sync-deploy-vps).

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
| agente | [agent-tasks/HANDOFF_TEMPLATE.md](agent-tasks/HANDOFF_TEMPLATE.md) | Slice non chiusa: copiare nel brief, nuova sessione |
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
| attivo | [../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) | Ingresso AI + bussola moduli |
| attivo | [../AGENTS.md](../AGENTS.md) | Cloud Agent / context window |
| attivo | [../.cursor/environment.json](../.cursor/environment.json) | Install dipendenze VM Cloud |
| **legacy** | [../.github/copilot-instructions.md](../.github/copilot-instructions.md) | Istruzioni Copilot — **non usare** (superato da ADR-015) |
| **legacy** | [../.github/agents/](../.github/agents/) | Planner / Implementer / Reviewer — **non usare** (superato da ADR-015) |
| attivo | [../app/README.md](../app/README.md), [../backend/README.md](../backend/README.md) | Avvio moduli |

---

## Regole `.cursor/rules` (metodo e memoria operativa)

| Tag | File | Scopo |
|-----|------|-------|
| metodo | [`.cursor/rules/sgq-operating-memory.mdc`](../.cursor/rules/sgq-operating-memory.mdc) | Golden rules, riuso UI, SSH/VPS, chiusura sessione (sempre attiva) |
| metodo | [`.cursor/rules/sgq-workflow-method.mdc`](../.cursor/rules/sgq-workflow-method.mdc) | **Slice + multitasking + worktree + triage PR** (attiva su task corposi/paralleli) |
| metodo | [`.cursor/rules/sgq-bug-fix-methodology.mdc`](../.cursor/rules/sgq-bug-fix-methodology.mdc) | Diagnosi bug, log VPS, smoke E2E |
| metodo | [`.cursor/rules/sgq-self-learning.mdc`](../.cursor/rules/sgq-self-learning.mdc) | Protocollo chiusura sessione / lezioni |
| qualità | [`.cursor/rules/sgq-encoding-quality.mdc`](../.cursor/rules/sgq-encoding-quality.mdc) | UTF-8 senza BOM, accenti, no `U+FFFD` |

---

## Convenzioni operative

- **Esperienza e procedure**: solo [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) + [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) — **non** creare `SESSION_NOTES_*.md`.
- **Lezioni apprese (fonte unica)**: [GUIDA_CONSOLIDATA — Lezioni apprese consolidate](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica).
- **Metodo di lavoro (slice/multitasking)**: regola [`sgq-workflow-method.mdc`](../.cursor/rules/sgq-workflow-method.mdc).
- **Task futuri parcheggiati**: [PROJECT_ROADMAP — Backlog parcheggiato](PROJECT_ROADMAP.md#backlog-parcheggiato-task-futuri--fonte-unica).
- **Principi di scrittura doc**: [GUIDA_CONSOLIDATA — Principi di documentazione](GUIDA_CONSOLIDATA.md#principi-di-documentazione-chiarezza-e-best-practice).
- **Deputy**: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Roadmap riorganizzazione documentazione

**Chiusura sessione 2026-05-21:** Fase 1 e 2 su `main`. [PR #58](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/58) (Fase 1) **merged**; Fase 2 in commit `b5f303b`. Nessuna azione GitHub pendente.

| Fase | Stato | Contenuto |
|------|-------|-----------|
| **1** | **Fatto (2026-05-21)** | TOC in `GUIDA_CONSOLIDATA`, tag in questo indice, `COMMIT_MESSAGES` in archive, ADR 008–010 in `adr/README` — [PR #58](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/58) |
| **2** | **Fatto (2026-05-21)** | Cartelle `how-to/`, `reference/`, `specs/`; hub [deploy.md](how-to/deploy.md); stub redirect in root `docs/` |
| **3** | **In corso** | Slice 3a–3b chiuse 31/05/2026 (ADR-011, archivio `TASK_AI_*`); vedi [GUIDA — Procedura chiusura autonoma](GUIDA_CONSOLIDATA.md#procedura-chiusura-autonoma) |

### Fase 3 — piano operativo (prossima sessione doc)

Eseguire **una slice per commit**; dopo ogni slice: `rg` link rotti, aggiornare questo indice.

| Slice | Priorità | Obiettivo | Definition of Done |
|-------|----------|-----------|-------------------|
| **3a** | Alta | **ADR leggibili** | **Fatto (31/05/2026)** — [adr/README.md](adr/README.md): ADR-011; tabella duplicati 002/003 per nome file |
| **3b** | Media | **Archivio agent-tasks** | **Fatto (31/05/2026)** — `TASK_AI_*` → [archive/agent-tasks/](archive/agent-tasks/); stub in `agent-tasks/` |
| **3c** | Bassa | **Cartella `explanation/`** (opzionale) | Spostare con `git mv`: `ARCHITETTURA_UTENTI_RBAC`, `FLUSSO_TIPOLOGIA_AUDIT`, `GESTIONE_PERDITA_CONNESSIONE`, `SCHEMA_UTENTI_*`; stub in root; riga in [README.md](README.md) |
| **3d** | Bassa | **GUIDA più snella** | Estrarre how-to ripetibili (Word verbale, smoke L3, sync) in `docs/how-to/`; in `GUIDA_CONSOLIDATA` restano TOC + § *Esperienza* + link — **non** duplicare procedure intere |
| **3e** | Differita | **Pulizia stub** | Rimuovere stub `docs/DEPLOY_*.md` ecc. solo se `rg` nel repo = 0 riferimenti (conservare ≥1 release dopo Fase 2) |
| **3f** | Bassa | **README root repo** | Breve ingresso umano accanto a `PROJECT_CONTEXT.md` (stack, link a `docs/README.md`) |

**Ordine consigliato:** 3a → 3b → (3c se serve) → 3d; 3e solo a distanza; 3f quando utile.

**Non fare in Fase 3:** rinominare file ADR (rischio link esterni); creare `SESSION_NOTES_*`; spostare normative/checklist cliente.
