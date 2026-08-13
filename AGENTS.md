# AGENTS.md — ProgettoISO (SGQ ISO 9001)

Istruzioni operative per agenti Cursor (desktop e Cloud). Fonte di governance: [ADR-015](docs/adr/ADR-015-cursor-lead-deputy-workflow.md).

## Avvio sessione (ordine obbligatorio)

**Dieta di contesto:** non leggere GUIDA né la roadmap per intero «per orientarsi». Obiettivo: avvio obbligatorio sotto ~50 KB di Markdown (misura: `node backend/scripts/check-harness-boot.js`).

0. **Allinea Git in autonomia** (se c'è terminale): `git fetch origin main` e, se lavori su `main` o stai per leggere/eseguire un brief, `git pull origin main`. **Non** chiedere al committente di farlo. Obbligatorio prima di qualsiasi `DEPUTYTASK*.md`.
1. `PROJECT_CONTEXT.md` — stack + **bussola moduli** (tabella «Se lavori su…»).
2. `docs/PROJECT_ROADMAP.md` **solo** la sezione [Stato attuale e priorità](docs/PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica) (prime ~40 righe). Banner storico e backlog lungo: solo se serve quella voce.
3. Brief attivo: `docs/agent-tasks/DEPUTYTASK.md` e/o `DEPUTYTASK1.md` / `DEPUTYTASK2.md` (lavori paralleli).
4. Dalla bussola: apri i 2–4 file del modulo. Nei primi file aperti devono comparire quelli del brief, non GUIDA.
5. `docs/GUIDA_CONSOLIDATA.md` **solo se** il task è deploy, Word, sync, encoding, o una lezione già citata nel brief — e **solo la sezione indicata**, non il file intero.
6. **Se il task tocca UI** (JSX, CSS, pagine, modal, drawer, filtri, form visibili): leggi **prima di scrivere markup** [`app/src/design-system/README.md`](app/src/design-system/README.md) e [`docs/reference/LIBRERIA_UI_SGQ.md`](docs/reference/LIBRERIA_UI_SGQ.md). Copia una delle 3 schermate; non inventare un look nuovo.

**Bussola moduli — quando aggiornarla:** se aggiungi, rinomini o sposti un modulo (nuova pagina, nuovo controller, nuova spec), aggiorna la tabella in `PROJECT_CONTEXT.md` **nella stessa PR**. Non toccarla per un bugfix su file già elencati. I path in backtick devono esistere (`node backend/scripts/check-harness-boot.js`).

Rispondi in **italiano**, operativo e sintetico.

**Domanda tipo «stato di avanzamento del progetto e priorità da affrontare»**: rispondi sintetizzando da [`docs/PROJECT_ROADMAP.md` § Stato attuale e priorità](docs/PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica) (moduli maturi + sessione più recente + tabella priorità) — è la fonte unica pensata apposta per questa domanda, non il banner storico più sotto nello stesso file né l'archivio marzo 2026 in [`docs/archive/PROJECT_CONTEXT_STATO_FUNZIONALITA_2026-03.md`](docs/archive/PROJECT_CONTEXT_STATO_FUNZIONALITA_2026-03.md). **Aggiorna quella sezione a fine sessione** se emergono nuove priorità o se una priorità elencata viene chiusa.

## Workflow Lead / Deputy

| Ruolo | Cosa fa |
|-------|---------|
| **Lead** | Piano, architettura, brief in `DEPUTYTASK*.md` (anche più file in parallelo). Epic grandi: skill `wayfinder-sgq` prima del brief. |
| **Deputy** | Allinea Git → slice verticali, commit atomici, test L1, PR |

Non usare `.github/agents/` (legacy Copilot). Policy anti-disallineamento: `.cursor/rules/sgq-operating-memory.mdc` (sezione *Allineamento Git autonomo*).

## Cursor Cloud specific instructions

### Ambiente VM

- Config repo: `.cursor/environment.json` → install idempotente via `.cursor/scripts/cloud-install.sh` (`app/` + `backend/`).
- Segreti: solo **Cursor Dashboard → Cloud Agents → Secrets** (mai in Git). Elenco: [docs/how-to/ACCESSO_DEPLOY_AGENTS.md](docs/how-to/ACCESSO_DEPLOY_AGENTS.md).
- SQL Server **non** raggiungibile dal Cloud Agent (DNS): migrazioni via SCP + `node` sul VPS (`run-migration-*-vps.js`).
- Deploy backend: `bash backend/scripts/deploy-to-vps.sh` + verifica PID/`health`.

### Context window e costo (policy vincolante)

Su [cursor.com/agents](https://cursor.com/agents) usa **Edit** accanto al modello per bilanciare capability/cost.

| Tipo run | Context window | Modello tipico |
|----------|----------------|----------------|
| **Deputy** (task da `DEPUTYTASK.md`, 1–3 file, fix UI, test L1) | **Default / basso** | fast / standard |
| **Lead** (audit ampio, sync, RBAC, multi-modulo) | **Alto / 1M solo se serve** | high |
| Esplorazione lunga con rischio compaction | Alto | high |

**Non** usare 1M di default: era il comportamento costoso precedente. Preferire brief mirati + regole repo + ricerca file mirata. L'avvio non deve saturare la smart zone (~100k) con GUIDA+roadmap intere.

Lavoro più grande di una sessione: skill **wayfinder-sgq** (mappa `PLAN_*_SLICES.md` + un `DEPUTYTASK` per run). Non installare il pacchetto intero `mattpocock/skills` (conflitto con ADR-015).

### Test L1 (frontend)

```bash
cd app && NODE_ENV=test npm run test:run
cd app && npm run build
```

Per fix a basso rischio (1–2 file, no sync/DB): accettabile affidarsi a CI Netlify dopo push.

### Smoke UI autenticato

Pattern Playwright in `/tmp` con `SGQ_APP_EMAIL` / `SGQ_APP_PASSWORD` (Secrets). Non usare MCP Playwright per il login (non legge le env). Template: regola `sgq-bug-fix-methodology.mdc` Fase 6.

## Regole repo da rispettare

- Multi-tenant: scope `organization_id` / pattern RBAC esistenti.
- Riuso UI: `QuestionCard`, `status-btn`, `notes-textarea`, `AttachmentSection`, `AiDisclaimer` — vedi `docs/reference/LIBRERIA_UI_SGQ.md`. DNA visivo: `app/src/design-system/README.md`.
- Encoding UTF-8, accenti italiani corretti (regola `sgq-encoding-quality`).
- Zero segreti in file versionati o chat.
- Doc operativa: aggiorna `docs/GUIDA_CONSOLIDATA.md` (non creare `SESSION_NOTES_*`).

## Riferimenti rapidi

| Tema | Path |
|------|------|
| Bussola moduli | `PROJECT_CONTEXT.md` (tabella «Se lavori su…») |
| Deploy / SSH / Secrets | `docs/how-to/ACCESSO_DEPLOY_AGENTS.md` |
| Esperienza operativa | `docs/GUIDA_CONSOLIDATA.md` (a sezioni, non intera) |
| Libreria UI | `docs/reference/LIBRERIA_UI_SGQ.md` |
| DNA visivo UI | [`app/src/design-system/README.md`](app/src/design-system/README.md) |
| Memoria operativa | `.cursor/rules/sgq-operating-memory.mdc` |
| Metodo slice | `.cursor/rules/sgq-workflow-method.mdc` |
| Policy Cloud / context | `.cursor/rules/sgq-cloud-agent-env.mdc` |
| Epic > 1 sessione (smart zone) | [`.cursor/skills/wayfinder-sgq/SKILL.md`](.cursor/skills/wayfinder-sgq/SKILL.md) |
