# ADR-018 — Profilo azienda esteso per conformità legislativa (14001 / 45001)

> **Stato**: Accettato — 23 luglio 2026  
> **Autori**: Lead architect (AI), Product owner  
> **Brief operativo**: [DEPUTYTASK.md](../agent-tasks/DEPUTYTASK.md)  
> **Catalogo campi / Excel**: [COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md](../specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md)  
> **Correlati**: ADR-012 (personale azienda), ADR-013 (scadenzario Excel), ADR-010 / seam `SAL_LEGAL_CONFORMITY`

---

## Contesto e problema

La tabella `companies` è un'anagrafica **minima** (nome, P.IVA, settore libero, indirizzo libero, logo, livello ISO 3834). Bastano a lista aziende, audit, export e moduli SGQ “classici”.

Per **ISO 14001** e **ISO 45001** (e per l'asse conformità legislativa già attivo in SAL) servono invece dati di **contesto** (ATECO, sedi, dimensione, profilo ambientale/SSL) che:

1. non devono gonfiare `companies` (rischio regressioni su lista/audit/export);
2. non servono a tutti gli studi (chi fa solo ISO 9001 “puro” non li usa);
3. in parte arrivano da **fonti ufficiali / Excel consulente**, in parte solo da **inserimento umano**.

---

## Decisione

### 1. Estensione 1:1 — tabella `company_profile`

Non si modifica il contratto minimo di `companies`. Si aggiunge una tabella **opzionale** 1:1:

| Colonna | Tipo | Note |
|---------|------|------|
| `company_id` | INT PK/FK → `companies.id` | Una riga profilo per azienda |
| `organization_id` | INT NOT NULL | Scope tenant (coerente con `companies.auditor_org_id` / org utente) |
| Campi livello **A** (anagrafica recuperabile) | NVARCHAR / INT | Vedi catalogo |
| Campi livello **B** (operativo SSL/ambiente) | NVARCHAR / INT / BIT / JSON opzionale | Vedi catalogo |
| `source_meta` | NVARCHAR(MAX) NULL | JSON provenance per campo (`manual` \| `excel` \| `registry`) |
| `profile_completeness` | TINYINT NULL | 0–100 calcolato (opzionale S2+) |
| `created_at` / `updated_at` | DATETIME2 | |
| `updated_by_user_id` | INT NULL | Audit trail |

**Migration prevista**: `130_company_profile.sql` (+ script `run-migration-130-vps.js`).

**Regola**: assenza di riga profilo = comportamento attuale (nessun breaking change).

### 2. Due livelli di popolamento

| Livello | Contenuto | Chi popola |
|---------|-----------|------------|
| **A — Recuperabile** | P.IVA, CF, ragione sociale, ATECO, sede legale strutturata, REA, PEC, forma giuridica, unità locali (sintesi) | Import Excel / (fase 2) lookup Registro Imprese / incolla da visura |
| **B — Operativo** | n. dipendenti, sedi operative, rifiuti, autorizzazioni, impianti, cantieri, sostanze, figure SSL… | Consulente, admin o dipendente studio |

I campi già presenti su `companies` (`name`, `vat_number`, `sector`, `address`) restano la **fonte UI lista/audit**. Il profilo può **proporre sync** verso quei campi (es. ragione sociale → `name`) solo con conferma esplicita, mai in silenzio.

### 3. Gate prodotto — solo studi con conformità legislativa

**Sì: l'estensione è utile soprattutto agli studi che gestiscono sistemi con obblighi di conformità legislativa** (tipicamente 14001/45001 + asse legale SAL).

| Superficie | Gate |
|------------|------|
| Tab / sezione «Profilo conformità» in `CompanyDetailPage` | Capability **`SAL_LEGAL_CONFORMITY`** (helper già esistente `hasSalLegalConformityCapability` — oggi mappa su `ai_norms`) |
| API `GET/PUT .../profile` e import Excel profilo | Stesso gate (oltre a `assertCompanyWriteAccess` / read access) |
| Lista `companies`, create/edit minimo, audit, export | **Nessun gate nuovo** — invariati |

**Graceful degradation**:

- capability OFF → UI nascosta / API 403 o 404 “feature non abilitata”; dati già salvati **restano in DB**;
- scorpore futuro in licenza `ai_legal`: ripuntare il seam come già documentato per SAL 5-B (2 mosse).

Non introdurre una terza licenza adesso.

### 4. Import Excel — pattern ADR-013

Riuso stack `xlsx` + flusso **detect → dry-run mapping → confirm → upsert**.

| Elemento | Path previsto |
|----------|---------------|
| Detector | `backend/src/utils/excelCompanyProfileDetector.js` |
| Dialog FE | `CompanyProfileImportDialog.jsx` (clone adattato di `DeadlineImportDialog`) |
| Endpoint | `POST /companies/:id/profile/detect-import` + `POST /companies/:id/profile/import` |
| Template | download `GET /companies/profile/import-template.xlsx` (o static sotto `backend/data/`) |

Upload **nella scheda azienda** (non obbligatorio passare dal Registro Documenti). Desktop-first.

Idempotenza: upsert su `company_id` (un profilo per azienda). Per import multi-azienda studio (fase successiva): chiave naturale `organization_id` + `vat_number`.

### 5. Lookup ufficiale (fase 2, non bloccante)

Adapter `companyRegistryLookup` (P.IVA → bozza campi A) dietro provider configurabile (InfoCamere / API commerciali).  
**Human-in-the-loop**: mai scrivere il profilo senza conferma operatore.  
Segreti solo in Cloud Secrets / file gitignored — mai in repo.

### 6. Consumatori futuri (fuori da S0–S4)

- SAL / AI conformità legislativa: arricchire contesto azienda (ATECO, n. dipendenti, aspetti).
- Futuro registro obblighi applicabili: filtro per profilo.
- Billing “per azienda gestita”: già previsto `company_id` su `ai_interactions` — indipendente da questo ADR.

---

## Cosa NON fare

- Non aggiungere decine di colonne su `companies`.
- Non rendere obbligatorio il profilo per creare aziende o avviare audit.
- Non chiamare API camerali a pagamento senza conferma utente e senza secret configurato.
- Non usare Agenzia delle Entrate come fonte primaria ATECO/sedi (non idonea).
- Non mescolare questo ingest con la pipeline PDF/AI (`importJobs` / ADR-017).

---

## Slice di implementazione

| Slice | Contenuto | Parallelizzabile |
|-------|-----------|------------------|
| **S0** | Questo ADR + catalogo campi/Excel + DEPUTYTASK | — (doc) |
| **S1** | Migration `130` + script VPS | dopo S0 |
| **S2a** | API GET/PUT profile + test Jest + gate capability | parallelo a S2b |
| **S2b** | Tab UI Profilo in `CompanyDetailPage` (form A/B, read-only se no write) | parallelo a S2a |
| **S3a** | Detector + endpoint detect/import | parallelo a S3b |
| **S3b** | Dialog import + download template | parallelo a S3a |
| **S4** | Completeness badge + sync opzionale verso `companies.name/vat/address` | dopo S2 |
| **S5** | Lookup Registro (opzionale) | dopo S2, provider |

---

## Test previsti

| Livello | Casi |
|---------|------|
| Jest | CRUD profilo scope org; 403 senza capability / senza write; upsert idempotente; import dry-run |
| Vitest | Tab nascosta se capability OFF; form salva campi A/B; dialog mapping |
| Smoke L3 | Studio con `ai_norms`: apri azienda → Profilo → import Excel template → campi valorizzati |

---

## Esito atteso

Studi con conformità legislativa abilitata compilano (manuale o Excel) un profilo azienda senza toccare il nucleo `companies`. Gli altri studi non vedono la feature e non pagano complessità UX.
