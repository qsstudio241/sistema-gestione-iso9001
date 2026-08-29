# DEPUTYTASK — LN-1: Gestione → Libreria (catalogo fonti + richieste mancanti)

**Stato:** APERTO  
**Aperto:** 29/08/2026  
**Piano:** [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md)  
**Rischio:** Medio — FE additivo (pagina + voce menu) + eventuale endpoint read-only leggero; **niente** auth/sync/migrazioni distruttive; **niente** secondo inventario DB  
**Origine:** Committente — punto 3 Quaderno / qualità fonti; UI (1) elenco ingerite+validità (2) richieste mancanti; nome **Libreria** (confermato 29/08/2026)  
**Parallelo:** slot 1–5 CHIUSI su `main`; PR #600 solo docs roadmap/GUIDA — file **disgiunti**

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Decisioni (confermate)

| Voce | Decisione | Serve click umano? |
|------|-----------|--------------------|
| Dove | **Gestione → Libreria** (admin/studio), non sotto SGQ Documenti | No |
| Nome | **Libreria** (confermato) — non «Catalogo norme»: le fonti di riferimento possono essere **norme, libri, quaderni, altri riferimenti**, non solo norme | No (chiuso) |
| Scope catalogo | Fonti di riferimento per **qualità/affidabilità agenti** ingerite nel Registro — non solo `doc_type=norma` a regime | No — vedi filtro LN-1 sotto |
| Catalogo LN-1 | Filtro iniziale = tipizzazioni **già** in `document_registry` / `DOC_TYPE_OPTIONS` utili come riferimenti (partenza: `norma`; se presenti e pertinenti, anche tipi già esistenti tipo `manuale` / `altro` usati come riferimento — **senza** inventare `libro`/`quaderno`) | No |
| Estensione tipi | Nuovi `doc_type` (es. libro, quaderno) **solo** con gate prodotto + ADR-011 / registry — **non** in LN-1 | Sì, slice successiva se serve |
| Richieste | Solo lettura da `NORME_MANCANTI_BACKLOG.md` (lacune fonti, non solo «norme» strette) | No in LN-1; PDF = HITL fuori UI |
| Alternativa scartata | Solo deep-link Documenti `?doc_type=norma` | Meno chiaro per «qualità fonti AI»; Knowledge Health è KPI chunk, non vigore |

## Obiettivo verificabile (LN-1)

Pagina accessibile da menu **Gestione → Libreria** con **due sezioni**:

1. **Catalogo ingerito** — tabella/lista fonti di riferimento dal Registro (codice/titolo/anno dove applicabile + badge vigore per le norme) con riuso `StatusBadge` / classi già usate in DocumentRegistry. Filtro iniziale: tipi già tipizzati nel registry (vedi tabella sopra); non nuovo SoT.
2. **Richieste mancanti** — tabella/lista dal backlog Markdown (stato + priorità + impatto), sola lettura, testo che spiega «per aumentare affidabilità risposte / non inventare soglie».

Smoke: login admin → Gestione → Libreria → entrambe le sezioni popolabili (anche con zero righe = empty state chiaro). Link «Apri in Documenti» su almeno una riga catalogo (o CTA globale) se i dati ci sono.

## File previsti

| Path | Perché |
|------|--------|
| `docs/agent-tasks/DEPUTYTASK.md` | Questo brief (stato) |
| `docs/agent-tasks/PLAN_LIBRERIA_NORME_SLICES.md` | Mappa epic |
| `app/src/pages/NormLibraryPage.jsx` (nome file ok anche `LibraryNormsPage.jsx` / `LibraryPage.jsx`) | Pagina 2 sezioni |
| `app/src/pages/NormLibraryPage.css` | Stile minimo, DNA Documenti/Knowledge Health — **non** look nuovo |
| `app/src/layouts/AppLayout.jsx` | Voce menu Gestione → **Libreria** |
| `app/src/App.jsx` | Route lazy (es. `/settings/libreria`) |
| `app/src/services/apiService.js` | Solo se serve wrapper su GET documenti già esistente (filtro tipi riferimento) |
| `app/src/tests/normLibraryPage.test.jsx` (o equivalente) | L1: render 2 sezioni + empty/mock |
| Opz. `backend/src/controllers/...` + route | **Solo se** serve endpoint read-only backlog; preferire FE che legge asset/JSON statico generato dal MD **oppure** riuso `GET /documents` senza BE nuovo |
| Opz. `docs/reference/norme-mancanti-backlog.json` | Snapshot parse del MD per FE (se evita parser MD in browser) — aggiornare insieme al MD |

## Cosa NON toccare

- `document_registry` schema / migrazioni / `documentRegistryNorm.service.js` (SoT già OK) — **niente** nuovi `doc_type` senza gate
- `syncService`, `auth.middleware`, JWT
- `DocumentRegistry.jsx` refactor ampio (solo link verso di esso)
- `KnowledgeHealthPage.jsx` (resta KPI chunk)
- `NORME_MANCANTI_BACKLOG.md` **contenuto** (LN-1 non riscrive priorità; al più genera JSON mirror)
- `docs/GUIDA_CONSOLIDATA.md` / `PROJECT_ROADMAP.md` § Stato attuale **nella PR codice se c’è parallelo** — bozza 2 righe qui sotto; sync dopo merge
- Altri `DEPUTYTASK1…5.md` / stream epic non LN
- `app/src/data/documentTypes.js` per aggiungere tipi nuovi in LN-1

## Riuso obbligatorio (Gate Ponytail)

- SoT metadati: ADR-011 + `document_registry` (tipi già tipizzati; metadati vigore su `doc_type=norma` via `type_specific_data`)
- Badge: `StatusBadge` / pattern `norm-validity-inline` già in DocumentRegistry
- Upload/scheda: **non** ricopiare `NormUploadButton` in Libreria in LN-1 — link a `/documents`
- Layout: copia DNA `app/src/design-system/README.md` + schermata tipo Knowledge Health / Documenti lista
- Backlog: unica fonte testuale `docs/reference/NORME_MANCANTI_BACKLOG.md`
- Tipi: `DOC_TYPE_OPTIONS` / `documentTypes.js` — riuso, non inventare

## Test L1

```bash
cd app && NODE_ENV=test npm run test:run -- src/tests/normLibraryPage.test.jsx
cd app && npm run build
```

Smoke post-merge (percorso Gestione): login admin → `/settings/libreria` (o path scelto) → sezioni visibili.

## Criteri chiusura

- [ ] Voce Gestione → **Libreria** visibile ad admin
- [ ] Sezione Catalogo: dati da API documenti (filtro tipi riferimento già tipizzati) + validity dove applicabile
- [ ] Sezione Richieste: dati da backlog (MD/JSON) read-only
- [ ] Nessuna migrazione; nessun secondo SoT; nessun `doc_type` nuovo
- [ ] Test L1 + build verdi; PR; **un** Bugbot a slice chiusa
- [ ] Stato brief → CHIUSO — TEST OK + link PR

## Bozza post-merge (hub — dopo merge se parallelo)

- Roadmap § Stato attuale: 1 riga «LN-1 Libreria Gestione (catalogo fonti+richieste read-only)»
- GUIDA: lezione «Libreria ≠ Documenti; SoT resta registro; backlog MD = richieste HITL; nome Libreria perché fonti ≠ solo norme»

## Handoff

_(compilare solo se slice interrotta — template `HANDOFF_TEMPLATE.md`)_
