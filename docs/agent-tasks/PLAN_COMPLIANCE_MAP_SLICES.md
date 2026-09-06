# Piano slice — Compliance Map in DB (§8.2)

> **Destinazione**: mappa multi-tenant **requisito cliente → norma/legge → evidenza → gap**, persistita in SQL (traduzione del metodo LLM-Wiki **nel DB**, non vault file).
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) §4–5 · [MINI_SPEC_RIESAME](../specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) · SAL gap [MODULO_SAL](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md)
> **Brief eseguibile**: [`DEPUTYTASK_COMPLIANCE_MAP.md`](DEPUTYTASK_COMPLIANCE_MAP.md) — su `main` (#652)
> **Mappa**: 06/09/2026 · **Stato:** piano/brief ✅ · **CM-1 codice** in attesa merge SB-4 ([#653](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/653))

---

## Problema / valore

Oggi: norme in `norm_requirements` (piattaforma), gap SGQ in `requirement_implementation_status` (SAL), workflow commerciale in `commercial_cases`, estratti runtime da ingest. **Manca** un grafo versionato tenant+azienda che colleghi i requisiti di un capitolato/ordine alle clausole/leggi e alle evidenze, con HITL e audit trail — il pezzo che rende l’agente requisiti **specifico** e citabile (ISO §7.5 / §8.2).

## Fuori scope (tutte le slice)

- Vault Obsidian / skill wiki GitHub / Engram GPU
- Mescolare fatti live Second Brain (`ambitoFacts`, NC aperte) dentro la mappa come “pagine wiki”
- Cross-tenant / lettura `norm_requirements` filtrata per org (resta catalogo piattaforma)
- Sostituire SAL o Contract Review: si **collega**, non si duplica il workflow stati
- Codice Compliance Map **prima** che SB-4 sia mergiato su `main` (vedi dipendenza)

## Dipendenza esplicita

| Lavoro | Relazione |
|--------|-----------|
| **SB-4** (aggregati studio / `ambitoFacts`) | **Codice** Compliance Map parte **solo dopo SB-4 mergiato**. Questa chat = solo docs; file disgiunti da AmbitoFactsBar / aiChat / ambitoFacts / NC / Qualifiche / Deadlines. |
| Contract Review / SAL / Libreria / NormBroker | Riuso in lettura; nessuna rewrite nelle prime slice |

## Esiste già (verificato in repo)

| Pezzo | Dove | Ruolo vs Compliance Map |
|-------|------|-------------------------|
| NormBroker | `backend/src/services/normBroker.service.js` | Legge testo clausola (local_db → publicLaw) |
| `norm_requirements` | mig. ADR-010 / `backend/database/migrations/052_norm_requirements.sql` | Catalogo **piattaforma** (no `organization_id`) |
| SAL gap | `requirement_implementation_status` (mig. **117**) + `gapAnalysis.service.js` | Gap **SGQ** clausola×azienda — pattern da riusare, dominio diverso |
| Contract Review | `contractReview.controller.js` + `commercial_cases` + workflow | Processo §8.2 stati; ingest `caseDocumentAnalysis.service.js` |
| Profilo estratti | `extractedRequirementsProfile.js` | Profilo tecnico WPS-like da testo — **non** grafo requisito↔norma |
| Libreria | `NormLibraryPage.jsx` + `library_source_requests` (160) | Qualità fonti AI / gap MD — non mappa commessa |
| Second Brain | `PLAN_SECOND_BRAIN_SLICES.md` | Fatti operativi live — **non** fondere nella mappa |

## Modello dati minimo (proposta Slice 1)

Tre tabelle nuove (numerazione migrazione: **prossimo libero su `origin/main` al momento del codice**, oggi coda ≥ **164**):

1. **`compliance_maps`** — header mappa  
   - `id`, `uuid`, `organization_id`, `company_id` (obbligatori)  
   - `commercial_case_id` NULL (FK soft a caso commerciale)  
   - `title`, `source_label` (es. capitolato v3)  
   - `map_version` INT, `status` (`draft` \| `in_review` \| `approved` \| `archived`)  
   - `created_by`, `updated_by`, `created_at`, `updated_at`

2. **`compliance_map_items`** — nodi requisito  
   - `map_id`, `organization_id`, `company_id` (denorm per filtri)  
   - `req_key` (stabile in versione), `req_text`, `req_source` (`ingest` \| `manual` \| `ai`)  
   - `norm_requirement_id` NULL, `standard_code`/`clause_ref` denorm NULL  
   - `legislation_ref` NULL (testo o art. da `linked_legislation`)  
   - `evidence_document_ids` NVARCHAR(MAX) NULL (JSON array id registro)  
   - `coverage` (`unknown` \| `covered` \| `partial` \| `missing` \| `na`)  
   - `gap_note` NULL  
   - `hitl_status` (`proposed` \| `accepted` \| `edited` \| `rejected`)  
   - `proposed_by` (`gemini` \| `user` \| `compiler`), `reviewed_by` NULL, `reviewed_at` NULL

3. **`compliance_map_events`** — audit trail append-only  
   - `map_id`, `item_id` NULL, `organization_id`, `actor_user_id`, `event_type`, `payload_json`, `created_at`

Indici: `(organization_id, company_id)`, `(map_id, req_key)`, unique `(map_id, map_version)` sul header se versioni = nuove righe header (preferenza Slice 1: **nuova riga `compliance_maps` per versione**, items copiati o lazy — decidere in CM-1 senza over-engineer: default = nuova mappa versionata, no in-place mutate approved).

## Chi scrive / chi legge

| Ruolo | Attore | Operazioni |
|-------|--------|------------|
| **Compilatore** | service BE (puro + orchestrazione) | Crea mappa/items da ingest o da template; non chiama Gemini da solo se manca runtime |
| **Gemini runtime** | adapter AI esistente (`aiProviderAdapter` / pattern SAL suggest) | Propone link norma/legge + coverage; scrive solo `hitl_status=proposed` |
| **HITL umano** | API PATCH + UI successiva | `accepted` / `edited` / `rejected` + event log |
| **Lettori** | orchestratore chat/requisiti, agente §8.2, UI mappa | GET indice + GET dettaglio scoped org+company |

## Mappa slice

| Slice | Tema | Perimetro | Dipende | Tipo |
|-------|------|-----------|---------|------|
| **CM-1** | Schema + API indice + HITL stub | migrazione + service/controller GET list/detail + PATCH hitl item + events; **no** UI piena; **no** Gemini compile | SB-4 mergiato | AFK |
| **CM-2** | Compilatore da caso commerciale | Seed items da `caseDocumentAnalysis` / allegati caso → items `proposed` | CM-1 | AFK |
| **CM-3** | Gemini link norma/legge | NormBroker + propose coverage; licenza `ai_norms` o riuso esistente | CM-1 | AFK |
| **CM-4** | UI mappa (read + HITL) | pagina/drawer DNA SGQ; gated senza Ambito/company | CM-1 | AFK |
| **CM-5** | Export / citazioni in chat | blocco prompt da mappa approvata (non da NC live) | CM-3+CM-4 | nebbia |

**Ordine**: CM-1 → (CM-2 ∥ CM-3) → CM-4 → CM-5.

**Rischio CM-1**: Medio (migrazione additiva + API nuove) — PR, gate CI+Bugbot+Security. Non Alto se niente auth/JWT rewrite.
