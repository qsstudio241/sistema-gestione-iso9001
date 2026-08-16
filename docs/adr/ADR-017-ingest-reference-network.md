# ADR-017 — Rete di riferimento ingest, catalogo UNI e apprendimento privacy-safe

> **Stato**: Accettato — 4 luglio 2026  
> **Autori**: Lead architect (AI), Product owner  
> **Estende**: [ADR-010](ADR-010-ai-agentic-architecture.md) (piattaforma agentica, NormBroker, RAG)  
> **Complementa**: [ADR-011](ADR-011-registry-norm-sot.md) (SoT metadati norma), piano [PLAN_INGEST_LEARNING_SLICES.md](../agent-tasks/PLAN_INGEST_LEARNING_SLICES.md) (IG-1…IG-6)  
> **Non sostituisce**: ADR-010 né ADR-011 — li approfondisce su ingest compliance e rete che si irrobustisce.

---

## Contesto

ProgettoISO deve:

1. **Popolare il registro documentale (DG)** in fase iniziale con ingest robusto su documenti **standard di compliance** (norme, qualifiche, certificati, WPQR, WPS) — non sul know-how proprietario dello studio.
2. **Ridurre progressivamente** la review umana man mano che la piattaforma accumula esperienza.
3. Evolvere verso **assistente attivo** (alert scadenze, vigore norme, risposte contestuali) — che richiede dati puliti in un unico SoT.
4. Sfruttare la **piramide rete studi → aziende clienti → documenti** senza esporre PII cross-tenant.

IG-1…IG-6 ha consegnato pipeline unificata, staging, `IngestReviewDialog`, feedback per org (`import_extraction_feedback`). Mancano: catalogo UNI come fonte primaria, pattern di riferimento condivisi (federati), ingest norme nella stessa pipeline.

---

## Decisione

### 1. Tre livelli di conoscenza ingest

| Livello | Nome | Contenuto | Scope | Aggiornamento |
|--------|------|-----------|--------|----------------|
| **A** | Riferimento di settore | Schemi `documentTypeSchemas`, regole regex, `standardCodeNormalizer`, catalogo enti | Globale deploy | Release codice |
| **B** | Rete federata | Pattern anonimi da correzioni (es. `ISO_TR_*` → `ISO/TR …:YYYY`) | Cross-tenant, no PII | Upsert su ogni feedback `accepted`/`corrected` |
| **C** | Preferenze studio | Few-shot da `import_extraction_feedback` per `organization_id` | Solo tenant | Storico org |

**Ordine di applicazione in estrazione AI**: A (prompt/schema) → B (pattern riferimento) → C (few-shot org) → merge regole+AI.

### 2. Privacy — campi ammessi al livello B

**Consentiti** in `ingest_reference_patterns` (solo metadati strutturali compliance):

- `standard_code`, `edition_year`, `issuing_body`, `norm_title` (titolo norma, non persona)
- `material_group`, `welding_process`, `iso_4063_position`, `product_type`, `joint_type`
- Altri campi in `REFERENCE_PATTERN_ALLOWLIST` nel codice

**Vietati** (mai aggregati cross-tenant):

- `person_name`, `welder_name`, `certificate_number`, `tax_code`, `company_name`, `notes`, testi liberi, payload JSON integrali

Implementazione: `ingestReferencePattern.service.js` filtra `field_diffs` prima dell’upsert.

### 3. Catalogo norme — UNI Store primario

Per norme tecniche (non leggi IT/UE):

1. **Lookup diretto** `url_key` su Elasticsearch store.uni.com (`/api/catalog/.../product/_search`)
2. **Ricerca** API pubblica `https://www.uni.com/wp-json/uni/v1/search/`
3. **Disambiguazione** per codice completo + anno + titolo (non solo numero famiglia)
4. **Fallback** ISO.org / BSI solo se assente da UNI

Vigore da `des_tpbloc_it` (`IN VIGORE` → vigente, `RITIRATA*` → superata).

Servizio: `uniStoreConnector.service.js`, invocato da `normCatalogLookup.service.js`.

### 4. Pipeline ingest unica (standardizzazione)

Tutti i tipi compliance devono convergere su:

```
documentIngestPipeline → lookup esterni (se norma) → ingest_staging
  → IngestReviewDialog (PDF | campi | warning catalogo)
  → commit destinazione (qualifications | document_registry | …)
  → recordFeedback → upsert pattern riferimento (Livello B)
```

**Stato attuale**: patentini/WPQR/WPS su staging; norme ancora su percorso legacy `normUpload.controller` — da allineare (slice IG-N).

**Auto-commit** (senza review) solo se:

- confidence campi critici ≥ soglia configurabile
- catalogo norma: match deterministico (`url_key` o score candidati ≥ soglia)
- altrimenti: `da_verificare` + review obbligatoria

### 5. Fase prodotto

| Fase | Obiettivo | Dipendenze |
|------|-----------|------------|
| **Popolamento DG** | Ingest robusto, SoT coerente (ADR-011) | ADR-017 livelli A+B+C, UNI catalogo |
| **Sistema attivo** | Alert, scadenzario, assistente RAG | Dati fase 1 affidabili |

Non si investe in “assistente brillante” senza ingest affidabile — sequenza vincolante.

### 6. Metriche north star

- `% ingest compliance confermati senza modifica campo` (per `doc_type`, per org)
- `% lookup catalogo con match deterministico`
- Tempo medio review per documento

---

## Conseguenze

- Nuova tabella `ingest_reference_patterns` (migrazione 120)
- `ingestLearning.service.js` arricchito con pattern Livello B
- `normCatalogLookup` delega a `uniStoreConnector` per norme tecniche
- Slice future: IG-N (norme in staging), binding catalogo persistente, dashboard metriche, **job mensile vigore Markdown KB** (`docs/Normative/`, giorno 1, superadmin — non confondere col job settimanale sul `document_registry`)

## Riferimenti implementativi

| Componente | Path |
|-----------|------|
| Pattern federati | `backend/src/services/ingestReferencePattern.service.js` |
| Catalogo UNI | `backend/src/services/uniStoreConnector.service.js` |
| Normalizzazione codici | `backend/src/services/standardCodeNormalizer.service.js` |
| Few-shot org | `backend/src/services/ingestLearning.service.js` |
| Pipeline | `backend/src/services/documentIngestPipeline.service.js` |
| Review UI | `app/src/components/IngestReviewDialog.jsx` |

---

*Ogni modifica sostanziale a privacy allowlist o ordine cataloghi va riflessa qui e in GUIDA_CONSOLIDATA (sezione Esperienza).*
