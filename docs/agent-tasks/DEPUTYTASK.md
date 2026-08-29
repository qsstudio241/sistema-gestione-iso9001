# DEPUTYTASK — LN-1: Gestione → Libreria (catalogo fonti + richieste mancanti)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 29/08/2026  
**Chiuso:** 29/08/2026  
**Piano:** [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md)  
**Rischio:** Medio — FE additivo (pagina + voce menu) + snapshot JSON backlog; **niente** auth/sync/migrazioni; **niente** secondo inventario DB  
**Origine:** Committente — punto 3 Quaderno / qualità fonti; UI (1) elenco ingerite+validità (2) richieste mancanti; nome **Libreria** (confermato 29/08/2026)  
**Branch:** `cursor/ln1-libreria-ui-e0cc`  
**Esito:** TEST OK — Vitest `normLibraryPage.test.jsx` + `npm run build` verdi

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Decisioni (confermate)

| Voce | Decisione | Serve click umano? |
|------|-----------|--------------------|
| Dove | **Gestione → Libreria** (admin/studio), non sotto SGQ Documenti | No |
| Nome | **Libreria** (confermato) — non «Catalogo norme»: le fonti di riferimento possono essere **norme, libri, quaderni, altri riferimenti**, non solo norme | No (chiuso) |
| Scope catalogo | Fonti di riferimento per **qualità/affidabilità agenti** ingerite nel Registro — non solo `doc_type=norma` a regime | No — vedi filtro LN-1 sotto |
| Catalogo LN-1 | Filtro iniziale = tipizzazioni **già** in `document_registry` / `DOC_TYPE_OPTIONS` utili come riferimenti (partenza: `norma`; se presenti e pertinenti, anche tipi già esistenti tipo `manuale` / `altro` usati come riferimento — **senza** inventare `libro`/`quaderno`) | No |
| UI catalogo per tipo (HITL 29/08) | **Norma** → stato **validità/vigore** (`validity_status` / badge già in DocumentRegistry). **Libro / quaderno / non-norma** → **niente** colonna vigori; mostra **data di pubblicazione** se già presente nel registry, altrimenti vuoto/placeholder (slice successiva solo se manca campo utile) | No (chiuso) |
| Campi data non-norma (LN-1) | **Riuso**, niente colonne DB nuove: preferire `issue_date` (colonna registry già usata) e, se utile in scheda, eventuali date già in `type_specific_data`. Se assente → «—» / placeholder UI; **non** inventare `publication_date` in LN-1 | No |
| Estensione tipi | Nuovi `doc_type` (es. libro, quaderno) **solo** con gate prodotto + ADR-011 / registry — **non** in LN-1 | Sì, slice successiva se serve |
| Richieste | Solo lettura da `NORME_MANCANTI_BACKLOG.md` (lacune fonti, non solo «norme» strette) | No in LN-1; PDF = HITL fuori UI |
| Alternativa scartata | Solo deep-link Documenti `?doc_type=norma` | Meno chiaro per «qualità fonti AI»; Knowledge Health è KPI chunk, non vigore |

## Obiettivo verificabile (LN-1)

Pagina accessibile da menu **Gestione → Libreria** con **due sezioni**:

1. **Catalogo ingerito** — tabella/lista fonti di riferimento dal Registro (codice/titolo + metadato **per tipo**):
   - `doc_type=norma` → badge **vigore** (`validity_status`, riuso `StatusBadge` / `norm-validity-inline`);
   - non-norma (libro/quaderno/manuale/altro riferimento) → **data pubblicazione** se presente (`issue_date` o equivalente già in registry); se manca → «—»/placeholder, **senza** migrazione né `validity_status` finto.
   Filtro iniziale: tipi già tipizzati (vedi tabella); non nuovo SoT.
2. **Richieste mancanti** — tabella/lista dal backlog Markdown (stato + priorità + impatto), sola lettura, testo che spiega «per aumentare affidabilità risposte / non inventare soglie».

Smoke: login admin → Gestione → Libreria → entrambe le sezioni popolabili (anche con zero righe = empty state chiaro). Link «Apri in Documenti» su almeno una riga catalogo (o CTA globale) se i dati ci sono.

## File previsti

| Path | Perché |
|------|--------|
| `docs/agent-tasks/DEPUTYTASK.md` | Questo brief (stato) |
| `docs/agent-tasks/PLAN_LIBRERIA_NORME_SLICES.md` | Mappa epic |
| `app/src/pages/NormLibraryPage.jsx` | Pagina 2 sezioni |
| `app/src/pages/NormLibraryPage.css` | Stile minimo, DNA Documenti/Knowledge Health |
| `app/src/layouts/AppLayout.jsx` | Voce menu Gestione → **Libreria** |
| `app/src/App.jsx` | Route lazy `/settings/libreria` |
| `app/src/data/normeMancantiBacklog.json` | Snapshot backlog per FE |
| `docs/reference/norme-mancanti-backlog.json` | Mirror docs del snapshot |
| `app/src/tests/normLibraryPage.test.jsx` | L1: render 2 sezioni + empty/mock |
| `PROJECT_CONTEXT.md` | Bussola modulo Libreria |

## Cosa NON toccare (rispettato)

- Schema `document_registry` / migrazioni / `documentRegistryNorm.service.js`
- `syncService`, `auth.middleware`, JWT
- Refactor ampio `DocumentRegistry.jsx` / `KnowledgeHealthPage.jsx`
- Contenuto priorità di `NORME_MANCANTI_BACKLOG.md` (solo mirror JSON)
- Nuovi `doc_type` in `documentTypes.js`

## Criteri chiusura

- [x] Voce Gestione → **Libreria** visibile ad admin
- [x] Sezione Catalogo: API documenti tipi `norma`/`manuale`/`altro`; vigore solo norme; `issue_date` per non-norma
- [x] Sezione Richieste: snapshot JSON backlog read-only
- [x] Nessuna migrazione / colonna nuova; nessun secondo SoT; nessun `doc_type` nuovo
- [x] Test L1 + build verdi; PR
- [x] Stato brief → CHIUSO — TEST OK

## Bozza post-merge (hub)

- Roadmap § Stato attuale: riga «LN-1 Libreria Gestione (catalogo fonti+richieste read-only)» — aggiornata in questa PR (unica chat APERTO)
- GUIDA: lezione «Libreria ≠ Documenti; SoT resta registro; backlog MD = richieste HITL»
