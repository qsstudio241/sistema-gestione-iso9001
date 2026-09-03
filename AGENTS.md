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

**Domanda tipo «stato di avanzamento del progetto e priorità da affrontare»**: rispondi sintetizzando da [`docs/PROJECT_ROADMAP.md` § Stato attuale e priorità](docs/PROJECT_ROADMAP.md#stato-attuale-e-priorità-fonte-unica) (moduli maturi + sessione più recente + tabella priorità) — è la fonte unica pensata apposta per questa domanda, non il banner storico più sotto nello stesso file né l'archivio marzo 2026 in [`docs/archive/PROJECT_CONTEXT_STATO_FUNZIONALITA_2026-03.md`](docs/archive/PROJECT_CONTEXT_STATO_FUNZIONALITA_2026-03.md). **Aggiorna quella sezione a fine sessione** se emergono nuove priorità o se una priorità elencata viene chiusa. In **parallelo** (altra chat/`DEPUTYTASK*` aperto): non nella PR di codice — bozza nel proprio brief, sync dopo merge ([`sgq-workflow-method.mdc`](.cursor/rules/sgq-workflow-method.mdc) § File di traccia).

## Workflow Lead / Deputy

| Ruolo | Cosa fa |
|-------|---------|
| **Lead** | Piano, architettura, brief in `DEPUTYTASK*.md` (anche più file in parallelo). Epic grandi: skill `wayfinder-sgq` prima del brief. |
| **Deputy** | Allinea Git → slice verticali, commit atomici, test L1, PR |

**Una sessione = una slice.** Se non chiudi: compila l'handoff nel `DEPUTYTASK*.md` attivo ([template](docs/agent-tasks/HANDOFF_TEMPLATE.md)) e ferma — nuova sessione, contesto pulito. Non installare skill GitHub (Ponytail, Caveman, Impeccable, wiki Obsidian): i gate sono sotto.

Non usare `.github/agents/` (legacy Copilot). Policy anti-disallineamento: `.cursor/rules/sgq-operating-memory.mdc` (sezione *Allineamento Git autonomo*).

## Cursor Cloud specific instructions

### Ambiente VM

- Config repo: `.cursor/environment.json` → install idempotente via `.cursor/scripts/cloud-install.sh` (`app/` + `backend/`).
- Segreti: solo **Cursor Dashboard → Cloud Agents → Secrets** (mai in Git). Elenco: [docs/how-to/ACCESSO_DEPLOY_AGENTS.md](docs/how-to/ACCESSO_DEPLOY_AGENTS.md).
- SQL Server **non** raggiungibile dal Cloud Agent (DNS): migrazioni via SCP + `node` sul VPS (`run-migration-*-vps.js`).
- Deploy backend: `bash backend/scripts/deploy-to-vps.sh` + verifica PID/`health`.
- **Branch PR:** prima di ogni `git push` sul feature branch e prima di create_pr/update_pr: `git fetch origin main` + `git merge origin/main`. Se `main` è avanti, allinea **ora** (anche gli OPEN restanti dopo un merge nello stack); vietato push/PR «e poi si allinea». **Non** mergiare su `main`; **non** chiedere al committente `git pull` / «Update branch». Fonte: [`.cursor/rules/sgq-git-autonomy.mdc`](.cursor/rules/sgq-git-autonomy.mdc) § Aggiornare il branch della PR.

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

### Smoke UI autenticato (percorsi critici)

Dopo deploy o PR che tocca questi flussi, eseguire **il percorso toccato** (non tutti). Login: script Node + `SGQ_APP_EMAIL` / `SGQ_APP_PASSWORD` — **non** MCP Playwright (non legge le env; non è collegato in Cloud). Playwright+Chromium arrivano da `cloud-install.sh` (devDependency `backend/`): **non** reinstallare in `/tmp`. Template: `sgq-bug-fix-methodology.mdc` Fase 6.

| Percorso | Come |
|----------|------|
| Login + NC + Qualifiche + SAL + WPS/WPQR | `node backend/scripts/smoke-percorsi-critici.mjs` (`SGQ_SMOKE_PATHS` per filtrare) |
| Ingest WPQR (API test) | `node backend/scripts/smoke-ingest-e2e-test.js` |
| Copertura ERAM (tenant 1004) | `node backend/scripts/smoke-eram-coverage-ui.js` |

PR di livello Medio: gate **Bugbot** prima di dichiararla pronta (`sgq-git-autonomy.mdc`). Su logica normativa lo stesso deputy non è verificatore di se stesso.

## Regole repo da rispettare

- Multi-tenant: scope `organization_id` / pattern RBAC esistenti.
- Riuso UI: `QuestionCard`, `status-btn`, `notes-textarea`, `AttachmentSection`, `AiDisclaimer` — vedi `docs/reference/LIBRERIA_UI_SGQ.md`. DNA visivo: `app/src/design-system/README.md`.
- **Prima di codice nuovo** (file/componente/CSS/endpoint): deve esistere? esiste già? libreria già in repo? una riga basta? altrimenti il minimo. Dettaglio: `.cursor/rules/sgq-operating-memory.mdc` § Gate Ponytail.
- Encoding UTF-8, accenti italiani corretti (regola `sgq-encoding-quality`).
- Zero segreti in file versionati o chat.
- Doc operativa: aggiorna `docs/GUIDA_CONSOLIDATA.md` (non creare `SESSION_NOTES_*`). In parallelo: GUIDA/roadmap **dopo il merge**, non nella PR di codice.

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
| Handoff sessione interrotta | [`docs/agent-tasks/HANDOFF_TEMPLATE.md`](docs/agent-tasks/HANDOFF_TEMPLATE.md) |
