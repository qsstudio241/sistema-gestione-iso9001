# Piano slice — Riesame requisiti contratto (app locale)

> **Destinazione**: repo standalone `RiesmeDeiRequisiti` (`C:\ProgettoAssistentiAI\RiesmeDeiRequisiti`) con React + API Node + SQLite + allegati su disco e analisi capitolato via Ollama; percorso ISO 9001 §8.2 (stati, checklist, gate, documenti) usabile offline senza SGQ. **Prodotto mono-azienda ERAM-Technologies** (MVP single-tenant).
> **Spec / riferimenti**: [`MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md`](../specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md), [`MANUALE_UTENTE_RIESAME_REQUISITI.md`](../how-to/MANUALE_UTENTE_RIESAME_REQUISITI.md)
> **Origine codice**: modulo SGQ `/contract-reviews` (`commercial_cases`)
> **Brief attivo**: [`DEPUTYTASK_RIESAME_APP.md`](DEPUTYTASK_RIESAME_APP.md) — MVP locale chiuso (RL-1..RL-12). Prossima: RL-2b (fase 2)

---

## Fuori scope

- Sync multi-device, IndexedDB, coda sync SGQ (ADR-008)
- Multi-tenant, `organization_id`, RBAC SGQ, licenze modulo (`moduleLicense`, `ai_review`)
- Deploy Netlify / VPS SGQ, migrazioni SQL Server, `deploy-manifest.json`
- NormBroker / RAG norme / embedding ISO in DB
- Vision disegni / estrazione quote da PDF immagine (**fase 2**, slice RL-2b)
- Collegamento Registro Documentale SGQ, `import-from-job`, Import Jobs Sprint 9–10
- Notifiche email / inbox multi-utente / handoff a commessa produzione / copertura saldatori WPQR
- Auth enterprise; MVP = **single-user locale** (nessun login)

---

## Non ancora specificato

- Requisiti RAM Ollama (dipende dal modello scelto in `.env` / Impostazioni)
- Nome commerciale/licenza del prodotto standalone
- Deploy Ollama su server dedicato (rete LAN vs localhost) — dopo MVP desktop
- Parità 1:1 tab UI SGQ vs subset MVP (proposta: 5 tab, no Disegno) — **chiuso in RL-11** (5 tab, no Disegno)
- Export backup SQLite + cartella uploads — **chiuso in RL-12** come procedura README (copia `data/riesame.db` + `data/uploads/`), non UI export

---

## Decisioni già prese

- **Path repo**: `C:\ProgettoAssistentiAI\RiesmeDeiRequisiti` (nome cartella esatto: `RiesmeDeiRequisiti`)
- **Azienda**: mono-azienda **ERAM-Technologies** — MVP single-tenant, profilo capacità pre-seeded (non multi-cliente SGQ)
- **Stack**: monorepo `app/` (Vite React) + `server/` (Express) + `data/` (SQLite + uploads)
- **DB**: SQLite (`better-sqlite3` o `sql.js`); schema derivato da migrazioni SGQ 054/068/095/116
- **AI**: Ollama via HTTP locale; nessun provider cloud nel MVP
- **Modello Ollama**: **dinamico** — configurabile via `.env` (`OLLAMA_MODEL`, `OLLAMA_BASE_URL`) e `data/settings.json` (o equivalente); tab Impostazioni opzionale in RL-7/RL-12 per cambiare modello senza ricompilare. **Nessun modello hardcodato**
- **Slice verticali** (schema→API→UI→test); prima slice = hello world end-to-end
- **Workflow**: 11 stati + 3 gate come SGQ (`contractReviewWorkflow.service.js`)
- **Harness**: clonare pattern Lead/Deputy, wayfinder-sgq, encoding UTF-8, git-autonomy semplificata
- **ProgettoISO resta sorgente di verità** finché l'app locale non è autonoma; nessun submodule obbligatorio

---

## Harness — file da clonare / adattare

| Azione | File |
|--------|------|
| Clonare | `.cursor/skills/wayfinder-sgq/SKILL.md` |
| Clonare | `.cursor/rules/sgq-encoding-quality.mdc` |
| Clonare | `.cursor/rules/sgq-workflow-method.mdc` |
| Clonare | `.cursor/rules/sgq-git-autonomy.mdc` (senza sezione Cloud merge) |
| Clonare | `docs/agent-tasks/HANDOFF_TEMPLATE.md` |
| Clonare pattern | `AGENTS.md` |
| Adattare | `sgq-operating-memory.mdc` → `rl-operating-memory.mdc` |
| Adattare | `sgq-cloud-agent-env.mdc` → `rl-local-env.mdc` |
| Adattare | `PROJECT_CONTEXT.md` (bussola riesame locale, mono-azienda ERAM-Technologies) |
| Adattare | `.cursor/scripts/local-setup.sh` (da `cloud-install.sh`, solo Node+deps) |
| Non clonare | `sgq-sysadmin.mdc`, smoke VPS, NormBroker, design-system SGQ completo |

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **RL-1** | Hello world E2E | Repo init, `server/db/schema.sql`, `GET/POST /api/cases`, pagina React lista+crea, `/api/health` | — | AFK | ✅ |
| **RL-2** | Workflow + cronologia | `workflow.service.js`, transition API, history, UI tab Workflow | RL-1 | AFK | ✅ |
| **RL-3** | Checklist + gate | checklist generate/save, 3 gate transizione, UI tab Checklist | RL-2 | AFK | ✅ |
| **RL-4** | Allegati locali | multer/disk storage, tabella `case_attachments`, upload API + lista | RL-1 | AFK | ✅ |
| **RL-5** | Chiarimenti | tabella + CRUD + UI tab Chiarimenti | RL-2 | AFK | ✅ |
| **RL-6** | Committente + azienda fissa | committente commerciale opzionale (select/campo libero); azienda SGQ fissa **ERAM-Technologies** (no multi-cliente) | RL-1 | AFK | ✅ |
| **RL-7** | Adapter Ollama | `ollamaAdapter.js`, `.env` (`OLLAMA_MODEL`, `OLLAMA_BASE_URL`) + `data/settings.json`, health, chat JSON; tab Impostazioni opzionale (modello dinamico) | RL-1 | AFK | ✅ |
| **RL-8** | Analisi capitolato testo | `caseTextAnalysis.service`, endpoint analyze, tab Analisi AI | RL-7, RL-6 | AFK | ✅ |
| **RL-9** | Profilo capacità ERAM | seed `data/eram-technologies-profile.json` + form in-app per aggiornare certificazioni/processi + prompt builder | RL-8 | AFK | ✅ |
| **RL-10** | PDF → testo | pdf-parse post-upload capitolato/ordine | RL-4, RL-8 | AFK | ✅ |
| **RL-11** | UI port completa | labels, CSS, 5 tab, stati terminali | RL-3,4,5,8 | AFK | ✅ |
| **RL-12** | Packaging | README (prodotto ERAM-Technologies), script avvio, test L1, `.gitignore` data; tab Impostazioni opzionale (modello Ollama dinamico) | RL-11 | AFK | ✅ |
| **RL-2b** | Vision disegni (fase 2) | drawing extraction + tab Disegno | RL-7, RL-4 | AFK |

---

## DoD epic (MVP)

- [x] Creazione caso e percorso stati DRAFT→APPROVED con gate checklist e documento ordine
- [x] Cronologia transizioni con motivazione su passi indietro
- [x] Allegati PDF su disco con metadati ruolo/direzione
- [x] Analisi capitolato incollato via Ollama (JSON requisiti + gap) + estrazione testo da PDF (RL-10)
- [x] Nessuna dipendenza runtime da SGQ / rete cloud
- [x] Test L1: workflow service + API cases + build Vite

---

*Chart the map — sessione Lead 14/08/2026. RL-1..RL-12 su `main` RiesmeDeiRequisiti (15/08/2026). Prossima: RL-2b (fase 2, vision disegni).*
