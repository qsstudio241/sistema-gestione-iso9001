# Report test automatici — ambiente cloud / agente

**Data esecuzione**: 13 aprile 2026 (UTC ambiente workspace)  
**Eseguito da**: Agente AI (terminale workspace Cursor cloud)  
**Obiettivo**: eseguire la suite automatica disponibile **senza** toccare DB produzione, **senza** credenziali VPS, **senza** lasciare artefatti di build nel repo.

---

## Riepilogo esecutivo

| Area | Comando | Esito |
|------|---------|-------|
| **App — Vitest** | `cd app && NODE_ENV=test npm run test:run` | **PASS** — 4 file, 17 test |
| **App — build** | `cd app && npm run build` | **PASS** |
| **Backend — Jest** | `cd backend && npm test` | **PASS** — 2 suite, 7 test |

**Esito complessivo**: tutti i comandi terminati con exit code **0**.

**Nota importante**: il file `app/test/integration/response-options-api.test.js` **non** è incluso nel pattern Vitest attuale (`vitest.config.js` → `include: ['src/**/*.{test,spec}.{js,jsx}']`), quindi **non è stato eseguito** in questa run. Per includerlo servirebbe allargare `include` o spostare i file sotto `src/`.

---

## Dettaglio — Frontend (`app/`)

### Precondizioni

- `npm ci` in `app/` (dipendenze da lockfile).

### Vitest (`NODE_ENV=test npm run test:run`)

| File test | Test | Esito |
|-----------|------|-------|
| `src/tests/wordExport.riepilogo.test.js` | 3 | PASS |
| `src/tests/wordExport.android.test.jsx` | 6 | PASS |
| `src/tests/wordExport.placeholders.test.js` | 2 | PASS |
| `src/tests/setup.test.jsx` | 6 | PASS |

**Avvisi non bloccanti** (console):

- Deprecation CJS API di Vite.
- Vitest 4: `test.poolOptions` in config segnato come rimosso — valutare migrazione guida ufficiale.

### Build (`npm run build`)

- Build completata con successo.
- Warning Rollup: chunk principale > 500 kB (noto, non errore).

### Integrità repository dopo build

- Lo script `prebuild` aggiorna `app/public/service-worker.js` (data build). **Ripristinato** con `git restore` per non introdurre commit rumorosi. L’agente desktop, se esegue build locale, verifichi `git status` prima di committare.

---

## Dettaglio — Backend (`backend/`)

### Precondizioni

- `npm ci` in `backend/`.

### Jest (`npm test` — include `--coverage`)

| Suite | Test | Esito |
|-------|------|-------|
| `src/utils/importPdfText.test.js` | — | PASS |
| `src/services/importAiExtraction.service.test.js` | — | PASS |

**Coverage** (solo file toccati dagli strumenti Jest): indicata nel log (~67% statements globali sui file elencati); **non** copre controller, auth, tenant, lock, sync.

---

## Cosa questo report **non** copre (per l’agente desktop)

I test discussi come prioritari per **stabilità tenant/RBAC/auth/licenze/lock** **non** esistono ancora come suite automatica nel repo: questa esecuzione **non** li sostituisce.

Raccomandazione per sessioni successive:

1. Aggiungere test backend (Jest + mock DB o container SQL test) per isolamento `organization_id` / `auditor_org_id`.
2. Allineare CI backend (opzionale) a `npm test` se si ampliano le suite.
3. Decidere se eseguire anche `app/test/integration/**` (allargare `include` in Vitest o spostare i file).

---

## Comandi ripetibili (copia-incolla)

```bash
cd app && npm ci && NODE_ENV=test npm run test:run && npm run build
cd ../backend && npm ci && npm test
```

Dopo `npm run build` in `app/`, se non si vuole committare lo SW:

```bash
git restore app/public/service-worker.js
```

---

*Fine report.*
