# AGENTS.md — ProgettoISO (SGQ ISO 9001)

Istruzioni operative per agenti Cursor (desktop e Cloud). Fonte di governance: [ADR-015](docs/adr/ADR-015-cursor-lead-deputy-workflow.md).

## Avvio sessione (ordine obbligatorio)

**Dieta di contesto:** non leggere GUIDA né la roadmap per intero «per orientarsi». Obiettivo: avvio obbligatorio sotto ~50 KB di Markdown (misura: `node backend/scripts/check-harness-boot.js`).

0. **Allinea Git in autonomia** (se c'è terminale): `git fetch origin main` e, se lavori su `main` o stai per leggere/eseguire un brief, `git pull origin main`. **Non** chiedere al committente di farlo. Obbligatorio prima di qualsiasi `DEPUTYTASK*.md`.
1. `PROJECT_CONTEXT.md` — stack + **bussola moduli** (tabella «Se lavori su…»).
2. `docs/PROJECT_ROADMAP.md`: **non invocare Read senza `limit`** — il file supera 900 righe. Usa `limit: 45` (sezione [Stato attuale e priorità](docs/PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica)). Banner storico e backlog lungo: solo se il brief cita esplicitamente quella voce, e solo con `offset`/`limit` mirato — mai il file intero.
3. Brief attivo: `docs/agent-tasks/DEPUTYTASK.md` e/o `DEPUTYTASK1.md` / `DEPUTYTASK2.md` (lavori paralleli). Se il brief ha una sezione **Handoff**, parti da quella (contesto pulito).
4. Dalla bussola: apri i 2–4 file del modulo. Nei primi file aperti devono comparire quelli del brief, non GUIDA.
5. `docs/GUIDA_CONSOLIDATA.md` **solo se** il task è deploy, Word, sync, encoding, o una lezione già citata nel brief — e **solo la sezione indicata**, non il file intero.
6. **Se il task tocca UI** (JSX, CSS, pagine, modal, drawer, filtri, form visibili): leggi **prima di scrivere markup** [`app/src/design-system/README.md`](app/src/design-system/README.md) e [`docs/reference/LIBRERIA_UI_SGQ.md`](docs/reference/LIBRERIA_UI_SGQ.md). Copia una delle 3 schermate; non inventare un look nuovo.

**Bussola moduli — quando aggiornarla:** se aggiungi, rinomini o sposti un modulo (nuova pagina, nuovo controller, nuova spec), aggiorna la tabella in `PROJECT_CONTEXT.md` **nella stessa PR**. Non toccarla per un bugfix su file già elencati. I path in backtick devono esistere (`node backend/scripts/check-harness-boot.js`).

Rispondi in **italiano**, operativo e sintetico.

**Stato / priorità:** sintetizzare da [`docs/PROJECT_ROADMAP.md` § Stato attuale](docs/PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica) (`limit: 45`). Aggiornare quella sezione a fine sessione se cambiano priorità. In parallelo: bozza nel brief, sync hub dopo merge ([`sgq-workflow-method.mdc`](.cursor/rules/sgq-workflow-method.mdc) § File di traccia).

## Workflow Lead / Deputy

| Ruolo | Cosa fa |
|-------|---------|
| **Lead** | Piano, architettura, brief in `DEPUTYTASK*.md` (anche più file in parallelo). Epic grandi: skill `wayfinder-sgq` prima del brief. |
| **Deputy** | Allinea Git → slice verticali, commit atomici, test L1, PR |

**Una sessione = una slice.** Se non chiudi: handoff ([template](docs/agent-tasks/HANDOFF_TEMPLATE.md)) nel brief attivo e ferma. Non installare skill GitHub (Ponytail, Caveman, Impeccable, wiki Obsidian): i gate sono sotto. Non usare `.github/agents/` (legacy). Git: [`.cursor/rules/sgq-operating-memory.mdc`](.cursor/rules/sgq-operating-memory.mdc) + [`sgq-git-autonomy.mdc`](.cursor/rules/sgq-git-autonomy.mdc).

## Cursor Cloud (sintesi — dettaglio nelle rules)

Fonte: [`.cursor/rules/sgq-cloud-agent-env.mdc`](.cursor/rules/sgq-cloud-agent-env.mdc) · branch PR: [`sgq-git-autonomy.mdc`](.cursor/rules/sgq-git-autonomy.mdc) § Aggiornare il branch · secrets/deploy: [ACCESSO_DEPLOY_AGENTS.md](docs/how-to/ACCESSO_DEPLOY_AGENTS.md).

- Install: `.cursor/environment.json` → `cloud-install.sh` (`app/` + `backend/`).
- SQL Server non raggiungibile dal Cloud (DNS): migrazioni SCP + `run-migration-*-vps.js` sul VPS.
- Context: Deputy = default/basso; **non** 1M di default; epic → skill `wayfinder-sgq`.
- **Gate hard branch PR** (prima di OGNI `git push` feature **e** prima di create/update PR / ManagePullRequest):
  ```bash
  git fetch origin main && git merge origin/main
  ```
  Vietato chiedere «Update branch» / `git pull` al committente; vietato push/PR «e poi si allinea». Se PR fallisce o `main` è avanti → merge **prima** di riprovare. Dopo merge di un'altra PR dello stack → allinea subito i branch OPEN. L'agente **non** mergia su `main`.
- L1 FE: `cd app && NODE_ENV=test npm run test:run` + `npm run build`. Smoke autenticato: `node backend/scripts/smoke-percorsi-critici.mjs` (Chromium da `cloud-install`, non `/tmp`).

## Regole repo (puntatori)

- Multi-tenant / RBAC: pattern esistenti su `organization_id`.
- UI: blocco unico + DNA — `LIBRERIA_UI_SGQ.md` · `app/src/design-system/README.md`. Gate Ponytail: `sgq-operating-memory.mdc`.
- Encoding: `sgq-encoding-quality.mdc`. Zero segreti in Git/chat.
- Doc: aggiorna GUIDA **a sezioni** (no `SESSION_NOTES_*`). In parallelo: hub dopo merge.

## Riferimenti rapidi

| Tema | Path |
|------|------|
| Bussola moduli | `PROJECT_CONTEXT.md` |
| Deploy / SSH / Secrets | `docs/how-to/ACCESSO_DEPLOY_AGENTS.md` |
| Esperienza operativa | `docs/GUIDA_CONSOLIDATA.md` (a sezioni) |
| Libreria UI / DNA | `docs/reference/LIBRERIA_UI_SGQ.md` · `app/src/design-system/README.md` |
| Memoria / metodo / git / Cloud | `sgq-operating-memory.mdc` · `sgq-workflow-method.mdc` · `sgq-git-autonomy.mdc` · `sgq-cloud-agent-env.mdc` |
| Epic > 1 sessione | [`.cursor/skills/wayfinder-sgq/SKILL.md`](.cursor/skills/wayfinder-sgq/SKILL.md) |
| Handoff | [`docs/agent-tasks/HANDOFF_TEMPLATE.md`](docs/agent-tasks/HANDOFF_TEMPLATE.md) |
