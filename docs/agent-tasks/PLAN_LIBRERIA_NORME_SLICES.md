# Piano slice — Libreria norme (Gestione)

> **Destinazione**: in Gestione, una schermata studio con **due sezioni chiare** — (1) catalogo norme **ingerite** con **stato di validità** (qualità info per agenti/AI); (2) **richieste di norme mancanti** per aumentare affidabilità risposte. Riuso massimo (Gate Ponytail / ADR-011): niente secondo inventario.
>
> **Spec / ADR**: [ADR-011](../adr/ADR-011-registry-norm-sot.md) · [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · backlog [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md) · SoT già chiuso [`PLAN_REGISTRY_NORM_SOT_SLICES.md`](PLAN_REGISTRY_NORM_SOT_SLICES.md) · fedeltà [`PLAN_NORM_FIDELITY_SLICES.md`](PLAN_NORM_FIDELITY_SLICES.md)
> **Mappa creata**: 29/08/2026 · Lead proposta UI punto 3 Quaderno / vigore
> **Nome UI proposto (HITL)**: **Libreria** in menu Gestione — alternativa se confonde con `LIBRERIA_UI_SGQ.md`: **Catalogo norme**

---

## Fuori scope

- Duplicare `document_registry` / creare tabella «libreria» parallela
- Scraping UNI Store / CEI come prerequisito
- Unificare loop sviluppo (`docs/Normative/` MD) e loop prodotto (Registro + RAG) in un solo DB
- Riscrivere Documenti / Knowledge Health «perché esiste Libreria»
- Context 1M di default

## Non ancora specificato

- Nome definitivo voce menu (**Libreria** vs **Catalogo norme**) — HITL nel brief LN-1
- Se le richieste mancanti diventano CRUD in-app (oggi = Markdown HITL) — dopo LN-1
- Collegamento automatico «norma MD digitalizzata ↔ riga registro» — slice successiva

## Decisioni già prese (Lead 29/08/2026)

- **Sì** voce sotto **Gestione** (studio admin): qualità fonti AI ≠ operativo Documenti per azienda
- **No** nuovo SoT: sezione Catalogo legge `document_registry` (`doc_type=norma`) + `validity_status` già in `type_specific_data` (ADR-011)
- **No** inventare UI da zero: riuso pattern lista/badge (`StatusBadge`, stile Documenti / Knowledge Health), link a `/documents` per upload/scheda
- Sezione **Richieste**: fonte iniziale = `NORME_MANCANTI_BACKLOG.md` (sola lettura in LN-1); scrivere/chiedere PDF resta **HITL** committente
- Distinto da **Knowledge Health** (KPI chunk/retrieval) e da **Documenti** (inventario completo multi-tipo)

## Due sezioni UI (contratto prodotto)

| Sezione | Cosa si vede (1 frase) | Fonte dati |
|---------|------------------------|------------|
| **1. Catalogo ingerito** | Elenco norme già in Registro con codice, titolo, edizione e badge vigore (`vigente` / `superata` / `da_verificare` / …) | DB `document_registry` (`doc_type=norma`) |
| **2. Richieste mancanti** | Elenco lacune da colmare (priorità + stato `da_richiedere` / `parcheggio` / …) per migliorare risposte AI | Markdown `NORME_MANCANTI_BACKLOG.md` (LN-1 read-only); HITL = PDF dal committente |

## Mappa slice

| Slice | Tema | Perimetro | Dipende da | Tipo | Stato |
|-------|------|-----------|------------|------|-------|
| **LN-1** | Shell Gestione → Libreria + 2 sezioni read-only | FE: pagina + voce menu; riuso API documenti filtro norma; render backlog (parse MD o JSON statico generato da MD) | Accordo nome (default Libreria) | AFK (+ HITL nome se rifiuta) | brief APERTO |
| **LN-2** | Deep-link / azioni minime | Link riga catalogo → Documenti scheda; CTA «Apri Documenti» / NormUpload già esistenti | LN-1 | AFK | pending |
| **LN-3** | Qualità info agenti | Colonne/badge da `text_quality` / presenza chunk / last_validity_check (solo lettura) | LN-1 | AFK | pending |
| **LN-4** | Richieste scrivibili (opz.) | Form «aggiungi richiesta» → aggiorna backlog o tabella leggera; alert studio | LN-1 + decisione prodotto | HITL | fog |

**Parallelo**: nessun altro `DEPUTYTASK*` APERTO su questi file al momento dell’apertura brief (29/08). PR docs #600 (roadmap/GUIDA) non tocca brief/codice LN.
