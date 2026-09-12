# DEPUTY — Riesame app locale · Slice RL-1 (Hello world E2E)

**Stato:** CHIUSO  
**Piano:** [`PLAN_RIESAME_APP_LOCALE_SLICES.md`](PLAN_RIESAME_APP_LOCALE_SLICES.md)  
**Slice:** RL-1 — Hello world end-to-end minimo  
**Tipo:** AFK (deputy autonomo)  
**Repo target:** `C:\ProgettoAssistentiAI\RiesmeDeiRequisiti` (nuovo, separato da ProgettoISO)  
**Prodotto:** mono-azienda **ERAM-Technologies** (MVP single-tenant, non multi-cliente SGQ)

---

## Obiettivo slice

Avere un'app **dimostrabile in locale**: avvio con un comando, SQLite con tabella casi, API che crea/legge casi, UI React che mostra lista e permette di creare un caso in stato `DRAFT`. Nessuna integrazione SGQ.

---

## Definition of Done

- [x] Repo `RiesmeDeiRequisiti` inizializzato con struttura `app/`, `server/`, `data/`
- [x] SQLite: tabella `commercial_cases` (id, title, status DEFAULT 'DRAFT', notes, created_at, updated_at)
- [x] API Express:
  - `GET /api/health` → `{ ok: true }`
  - `GET /api/cases` → array casi
  - `POST /api/cases` → `{ title }` crea caso DRAFT
- [x] UI React (Vite): pagina unica con elenco casi + form "Nuovo riesame" (titolo obbligatorio)
- [x] Script root: `npm run dev` avvia FE+BE (concurrently o equivalente)
- [x] Harness minimo: `AGENTS.md`, `PROJECT_CONTEXT.md`, `.cursor/rules/rl-encoding-quality.mdc`, `wayfinder-sgq/SKILL.md` adattati (prodotto per **ERAM-Technologies**)
- [x] Test L1: almeno 1 test Vitest (labels o API mock) + `npm run build` in `app/`
- [x] `.gitignore`: `data/*.db`, `data/uploads/`, `node_modules/`
- [x] README: prerequisiti Node, comandi avvio, nota "Ollama non richiesto in RL-1", prodotto dedicato **ERAM-Technologies** (mono-azienda, single-tenant)

---

## File previsti (nuovo repo)

```
RiesmeDeiRequisiti/
├── AGENTS.md                      # prodotto ERAM-Technologies
├── PROJECT_CONTEXT.md             # bussola mono-azienda ERAM
├── README.md
├── package.json                 # workspace root, script dev
├── .gitignore
├── .cursor/
│   ├── skills/wayfinder-sgq/SKILL.md
│   └── rules/
│       ├── rl-encoding-quality.mdc   # da sgq-encoding-quality
│       └── rl-operating-memory.mdc   # stub minimo
├── app/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # lista + form crea caso
│       └── api/client.js        # fetch wrapper /api
├── server/
│   ├── package.json
│   ├── index.js                 # Express entry
│   ├── db/
│   │   ├── init.js              # better-sqlite3 + migrate schema
│   │   └── schema.sql           # commercial_cases minimo
│   └── routes/cases.routes.js
└── data/                        # gitignored, creato a runtime
```

---

## Cosa NON toccare

- **ProgettoISO**: nessuna modifica a SGQ in questa slice (solo eventuale commit dei due file PLAN/DEPUTY in SGQ se il Lead li aggiunge dopo)
- Workflow stati, checklist, gate, allegati, Ollama, PDF — slice RL-2+
- Auth, multi-utente, CORS produzione
- Port completo `ContractReviewPage.jsx` (2791 righe) — solo UI minima nuova
- SQL Server, migrazioni VPS, Netlify

---

## Riferimenti SGQ (solo lettura)

| File | Uso in RL-1 |
|------|-------------|
| `backend/database/migrations/054_commercial_cases.sql` | Schema tabella casi (semplificato, no organization_id) |
| `app/src/utils/contractReviewLabels.js` | Opzionale: import STATUS_LABELS per badge "Bozza" |
| `AGENTS.md` (ProgettoISO) | Template harness |

---

## Test L1

```bash
cd app && npm run build
cd app && NODE_ENV=test npm run test:run
# Manuale: npm run dev → http://localhost:5173 → crea caso → refresh → caso visibile
```

---

## Chiusura

Al termine: **TEST OK** oppure handoff con [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md). Aggiornare PLAN (spunta RL-1). Non aprire RL-2 nella stessa sessione.

---

## Esito (14/08/2026)

**TEST OK** — Repo `C:\ProgettoAssistentiAI\RiesmeDeiRequisiti` creato, commit iniziale `ddae016`. Build Vite + 2 test Vitest verdi. API smoke: health, POST/GET cases OK.

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK_RIESAME_APP.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
