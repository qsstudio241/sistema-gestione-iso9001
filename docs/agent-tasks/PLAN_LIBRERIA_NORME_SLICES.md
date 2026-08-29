# Piano slice — Libreria (Gestione)

> **Destinazione**: in Gestione, una schermata studio **Libreria** con **due sezioni chiare** — (1) catalogo fonti di riferimento **ingerite** (norme, libri, quaderni, altri riferimenti) con metadato **per tipo** (qualità info per agenti/AI); (2) **richieste mancanti** per aumentare affidabilità risposte. Riuso massimo (Gate Ponytail / ADR-011): niente secondo inventario.
>
> **Nome UI (confermato 29/08/2026)**: **Libreria** — non «Catalogo norme»: non tutti i `.md` / fonti di riferimento sono necessariamente *norme*.
>
> **Catalogo per tipo (HITL 29/08/2026)**: **norma** → validità/vigore (`validity_status`); **libro / quaderno / non-norma** → **non** hanno vigori — mostrare **data di pubblicazione** se già in registry (`issue_date` o equivalente), altrimenti placeholder / slice successiva. **Niente** colonne DB nuove in LN-1.
>
> **Spec / ADR**: [ADR-011](../adr/ADR-011-registry-norm-sot.md) · [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · backlog [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md) · SoT già chiuso [`PLAN_REGISTRY_NORM_SOT_SLICES.md`](PLAN_REGISTRY_NORM_SOT_SLICES.md) · fedeltà [`PLAN_NORM_FIDELITY_SLICES.md`](PLAN_NORM_FIDELITY_SLICES.md) · tipi [`documentTypes.js`](../../app/src/data/documentTypes.js)
> **Mappa creata**: 29/08/2026 · Lead proposta UI punto 3 Quaderno / qualità · aggiornata nome/scope + HITL vigore vs data pubblicazione

---

## Fuori scope

- Duplicare `document_registry` / creare tabella «libreria» parallela
- Inventare nuovi `doc_type` (`libro`, `quaderno`, …) **senza** gate prodotto + allineamento ADR-011 / registry
- Scraping UNI Store / CEI come prerequisito
- Unificare loop sviluppo (`docs/Normative/` MD) e loop prodotto (Registro + RAG) in un solo DB
- Riscrivere Documenti / Knowledge Health «perché esiste Libreria»
- Context 1M di default

## Non ancora specificato

- Se/quando introdurre `doc_type` dedicati per libri/quaderni (oggi tipizzazioni utili già in registry: `norma`, eventualmente `manuale` / `altro` come riferimento) — **dopo** LN-1, con gate
- Se `issue_date` non basta come «data pubblicazione» per libri/quaderni tipizzati in futuro — eventuale campo dedicato **solo** in slice successiva (non LN-1)
- Se le richieste mancanti diventano CRUD in-app (oggi = Markdown HITL) — dopo LN-1
- Collegamento automatico «fonte MD digitalizzata ↔ riga registro» — slice successiva

## Decisioni già prese (Lead + committente 29/08/2026)

- **Sì** voce sotto **Gestione** (studio admin): qualità fonti AI ≠ operativo Documenti per azienda
- **Nome**: **Libreria** (confermato) — scope = fonti di riferimento per affidabilità agenti (**norme + libri/quaderni/altri riferimenti**), non solo norme
- **No** nuovo SoT: sezione Catalogo legge `document_registry` (ADR-011)
- **UI catalogo differenziata (HITL)**:
  - **Norma** → `validity_status` (vigore) via `type_specific_data` + badge già in DocumentRegistry
  - **Libro / quaderno / non-norma** → **niente** vigori; colonna/cella **data pubblicazione** riusando campi già presenti (`issue_date` in registry; eventuali date già in TSD). Se assente → «—» / placeholder UI. **Non** inventare colonna `publication_date` né migrazione in LN-1
- **Filtro LN-1**: tipizzazioni **già** in `DOC_TYPE_OPTIONS` / registry (partenza `norma`; eventuali tipi già esistenti usati come riferimento **senza** estendere l’enum). Estensione tipi = slice/gate successivo
- **No** inventare UI da zero: riuso pattern lista/badge (`StatusBadge` solo su norme, stile Documenti / Knowledge Health), link a `/documents` per upload/scheda
- Sezione **Richieste**: fonte iniziale = `NORME_MANCANTI_BACKLOG.md` (sola lettura in LN-1); scrivere/chiedere PDF resta **HITL** committente
- Distinto da **Knowledge Health** (KPI chunk/retrieval) e da **Documenti** (inventario completo multi-tipo)

## Due sezioni UI (contratto prodotto)

| Sezione | Cosa si vede (1 frase) | Fonte dati |
|---------|------------------------|------------|
| **1. Catalogo ingerito** | Elenco fonti di riferimento già in Registro: codice/titolo; **norme** = badge vigore; **non-norma** = data pubblicazione se presente (altrimenti «—») | DB `document_registry` (filtro tipi già tipizzati; LN-1 partenza `norma`; `validity_status` solo norma; `issue_date` riuso per non-norma) |
| **2. Richieste mancanti** | Elenco lacune da colmare (priorità + stato `da_richiedere` / `parcheggio` / …) per migliorare risposte AI | Markdown `NORME_MANCANTI_BACKLOG.md` (LN-1 read-only); HITL = PDF dal committente |

## Mappa slice

| Slice | Tema | Perimetro | Dipende da | Tipo | Stato |
|-------|------|-----------|------------|------|-------|
| **LN-1** | Shell Gestione → **Libreria** + 2 sezioni read-only | FE: pagina + voce menu; riuso API documenti filtro tipi già tipizzati; catalogo UI: vigore solo norme, data pubbl. (`issue_date` se presente) per non-norma; render backlog (MD/JSON); **niente** migrazioni/colonne nuove | Nome + HITL vigore/data | AFK | **CHIUSO** — TEST OK (29/08/2026, branch `cursor/ln1-libreria-ui-e0cc`) |
| **LN-2** | Deep-link / azioni minime | Link riga catalogo → Documenti scheda; CTA «Apri Documenti» / NormUpload già esistenti | LN-1 | AFK | **CHIUSO** — TEST OK (29/08/2026, `cursor/ln2-libreria-deeplink-0b72`) |
| **LN-3** | Qualità info agenti | Colonne/badge da `text_quality` / presenza chunk / last_validity_check (solo lettura) | LN-1 | AFK | pending |
| **LN-4** | Tipi riferimento più ampi (opz.) | Se serve: gate + eventuale `doc_type` libro/quaderno in registry/ADR; altrimenti regole su tipi esistenti | LN-1 + decisione prodotto | HITL | fog |
| **LN-5** | Richieste scrivibili (opz.) | Form «aggiungi richiesta» → aggiorna backlog o tabella leggera; alert studio | LN-1 + decisione prodotto | HITL | fog |

**Parallelo**: nessun altro `DEPUTYTASK*` APERTO su questi file al momento dell’apertura brief (29/08). PR docs #600 (roadmap/GUIDA) non tocca brief/codice LN.
