# Material Compliance — Data model (MC-0 → schema MC-1)

> **Tipo**: spec tecnica + schema SQL in MC-1  
> **Versione**: 1.1 — 16/08/2026  
> **Stato**: Schema MC-1 = migrazione **149** (`database/migrations/149_material_certificates.sql`)  
> **Slice**: MC-0 spec → **MC-1** tabelle `material_certificates` + `material_certificate_checks`  
> **Spec prodotto**: [MODULO_MATERIAL_COMPLIANCE_AI.md](MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **UI**: [MATERIAL_COMPLIANCE_UI.md](MATERIAL_COMPLIANCE_UI.md) · **API**: [MATERIAL_COMPLIANCE_API.md](MATERIAL_COMPLIANCE_API.md)  
> **ADR**: [020](../adr/ADR-020-material-compliance-ai-module.md) · [021](../adr/ADR-021-material-requirements-hierarchy.md) · [022](../adr/ADR-022-ai-extraction-rule-engine.md) · [023](../adr/ADR-023-material-knowledge-base.md) · [024](../adr/ADR-024-material-certificate-workflow.md)  
> **Dizionario campi**: [`knowledge/material-compliance/dictionary/fields.md`](../../knowledge/material-compliance/dictionary/fields.md)  
> **Inventario norme**: [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md)

---

## Sintesi (per il committente)

Una riga = **un certificato** (PDF 2.1 / 2.2 / 3.1 / 3.2), con il numero di **DDT** di arrivo. Vale sia per le **lamiere/profili** (materiale di base) sia per **filo, elettrodo, flusso** (materiale d’apporto). Non si fanno due moduli: stesso elenco, colonna **Ruolo**.

ISO 3834 §11 (consumabili) e §12 (materiali base) arrivano qui, non in un CRUD nel modulo Saldatura.

---

## Fonti Markdown (dichiarare, poi partire)

```text
Fonti Markdown:
- Coperte: EN 10204, EN 10168, ISO 10474/404/6929, EN 10025-2, ISO/TR 15608, ISO 14341 (classificazione filo, non soglie 3.1 lotto)
- Mancanti (non bloccano): EN 10210-1, EN 10219-1 (tubi); ISO 2560 / 17632 / 14174 e altre norme prodotto apporto
- Si parte su: certificati base Sxxx (lamiere/profili) + certificati apporto sullo stesso flusso EN 10204 (tipo documento sì; chimica/ReH apporto = skip finché manca Markdown norma prodotto)
```

Vietato inventare soglie. Un livello assente nello scope → `skip`, non `fail` (ADR-021).

---

## Principi

| Vincolo | Implicazione |
|---------|----------------|
| Una tabella certificati | `material_role` = `base` \| `filler`. Niente tabella parallela «consumabili». |
| EN 10204 | Vale per **tutti** i prodotti metallici, anche i consumabili. Tipo 2.1–3.2 sullo stesso campo. |
| EN 10168 | Layout A/B/C/Z **utile** anche sull’apporto (lotti al posto della colata). Non è obbligatorio che il PDF apporto usi i codici A03/B07. |
| Certificato = prova | I limiti stanno in norma prodotto + ordine + cliente + azienda, mai nel 3.1 stesso. |
| Multi-tenant | Ogni riga: `organization_id` + `company_id` (Ambito). Scope via `companyAccess.service.js`, non `users.company_id`. |
| Niente CASCADE avventato | FK verso `import_jobs` / registry: `ON DELETE SET NULL`. Statement SQL separati in MC-1. |
| Nessun hardcode cliente | Soglie solo da KB Markdown (`standards/`, `customers/`, `companies/<slug>/`). |

---

## Entità

```text
organizations 1──* companies
companies     1──* material_certificates
import_jobs   1──* import_job_files
import_job_files  0..1──* material_certificates     (file PDF sorgente)
document_registry 0..1──* material_certificates     (dopo archived)
material_certificates 1──* material_certificate_checks
```

**DDT**: niente anagrafica DDT separata in MVP. `ddt_no` + `ddt_date` sono colonne sul certificato (un DDT → più righe). Commessa (`project_id`) = ponte successivo, colonna **nullable**, non in griglia.

**Snapshot requisiti**: niente terza tabella in MVP. Hash + JSON sulla riga certificato (`kb_snapshot_hash`, `kb_snapshot_json`). Tabella dedicata solo se in MC-3 il JSON supera i limiti pratici di `NVARCHAR(MAX)` in revisione.

---

## Tabella `material_certificates` (proposta MC-1)

Nomi indicativi. MC-1 sceglie tipi SQL Server precisi; qui il contratto.

### Isolamento e ponte documenti

| Colonna | Tipo indicativo | Note |
|---------|-----------------|------|
| `id` | INT IDENTITY PK | |
| `organization_id` | INT NOT NULL | FK `organizations` |
| `company_id` | INT NOT NULL | FK `companies`. Obbligatorio: il certificato appartiene all’azienda in Ambito |
| `import_job_id` | INT NULL | FK `import_jobs`, SET NULL |
| `import_job_file_id` | INT NULL | Puntatore al PDF in `import_job_files`. **Niente FK SQL** (MC-1): SET NULL insieme a `import_job_id` crea due cascade path (job→files CASCADE, mig. 038); NO ACTION blocca `DELETE` dei job. Integrità in API (MC-4) |
| `document_registry_id` | INT NULL | FK `document_registry`, SET NULL — valorizzato in MC-7 a `archived` |
| `project_id` | INT NULL | FK `projects` — **non** in griglia MVP |
| `storage_path` | NVARCHAR(2000) NULL | Copia/riferimento file se non si riusa solo il path del job file |

### Griglia elenco (denormalizzate — HITL 16/08 + ruolo)

| Colonna | Tipo indicativo | Griglia | Note |
|---------|-----------------|---------|------|
| `ddt_no` | NVARCHAR(80) NULL | N. DDT | Ponte arrivo merce. Non obbligatorio in compilazione (come allegati ISO): si può caricare il PDF prima del DDT |
| `ddt_date` | DATE NULL | Data DDT | |
| `certificate_no` | NVARCHAR(120) NULL | N. certificato | EN 10168 A03 |
| `material_role` | NVARCHAR(16) NOT NULL | Ruolo | CHECK (`base`, `filler`). Default estrazione: `base` se incerto → operatore corregge |
| `designation` | NVARCHAR(200) NULL | Materiale | Display: S355J2 **oppure** `G 42 4 M21 3Si1`. Fonte: `steel_designation` o `filler_designation` nel JSON |
| `heat_or_lot_no` | NVARCHAR(80) NULL | Colata / lotto | Base = colata (B07); apporto = lotto/batch. Stessa colonna |
| `product_form` | NVARCHAR(40) NULL | Forma | Vedi enum sotto |
| `dimensions` | NVARCHAR(120) NULL | Dimensioni | Spessore e/o Ø e/o lunghezza, una cella |
| `material_standard` | NVARCHAR(80) NULL | Norma | EN 10025-2, ISO 14341, … |
| `manufacturer_works` | NVARCHAR(200) NULL | Fornitore / acciaieria | A01; sull’apporto spesso il produttore del filo |
| `inspection_document_type` | NVARCHAR(8) NULL | (dettaglio) | CHECK `2.1` \| `2.2` \| `3.1` \| `3.2` |
| `workflow_status` | NVARCHAR(32) NOT NULL | Esito | Stati ADR-024 |

### Workflow, extract, OCR, audit

| Colonna | Tipo indicativo | Note |
|---------|-----------------|------|
| `extracted_text` | NVARCHAR(MAX) NULL | Testo/Markdown dopo extract (+ OCR) |
| `text_extract_reason` | NVARCHAR(40) NULL | `ocr_*` / `text_layer` — come ingest WPQR/SAL |
| `extracted_json` | NVARCHAR(MAX) NULL | Bozza AI (schema dizionario) |
| `corrected_json` | NVARCHAR(MAX) NULL | Dopo HITL; se NULL si usa `extracted_json` |
| `evaluate_result_json` | NVARCHAR(MAX) NULL | Output Rule Engine (`status` + `checks[]`) |
| `kb_snapshot_hash` | NVARCHAR(64) NULL | Riproducibilità ADR-023 |
| `kb_snapshot_json` | NVARCHAR(MAX) NULL | Path file + limiti usati al momento del check |
| `ai_model` | NVARCHAR(80) NULL | Come `import_job_files` |
| `created_by` | INT NULL | FK utente |
| `reviewed_by` | INT NULL | Chi ha approvato/respinto |
| `reviewed_at` | DATETIME2 NULL | |
| `review_notes` | NVARCHAR(MAX) NULL | |
| `created_at` / `updated_at` | DATETIME2 NOT NULL | |

CHECK `workflow_status` (ADR-024):

`received` \| `text_ready` \| `extracted` \| `pending_review` \| `compliant` \| `non_compliant` \| `archived`

Stato tecnico OCR (MC-B): `ocr_running` **ammesso** nello stesso CHECK quando si implementa l’adapter; non inventare altri stati.

Transizione a `compliant` / `non_compliant` **solo** da azione operatore autenticato (mai dall’AI né dal Rule Engine da solo).

---

## Tabella `material_certificate_checks` (proposta MC-1)

Una riga per grandezza confrontata (ADR-021). Si (ri)genera a ogni `evaluate`.

| Colonna | Tipo indicativo | Note |
|---------|-----------------|------|
| `id` | INT IDENTITY PK | |
| `organization_id` | INT NOT NULL | Copia per query tenant-safe |
| `certificate_id` | INT NOT NULL | FK `material_certificates` — **ON DELETE CASCADE** solo figlio→padre di questa coppia (checks senza certificato non hanno senso) |
| `requirement_key` | NVARCHAR(80) NOT NULL | `inspection_document_type`, `ReH`, `CEV`, `filler_designation`, … |
| `source_level` | NVARCHAR(32) NOT NULL | `en10204` \| `material_std` \| `po` \| `customer` \| `company` |
| `source_ref` | NVARCHAR(300) NULL | Path KB o n. ordine |
| `required_value` | NVARCHAR(200) NULL | Limite già «più restrittivo» |
| `actual_value` | NVARCHAR(200) NULL | Dal JSON corretto |
| `result` | NVARCHAR(16) NOT NULL | `pass` \| `fail` \| `skip` |
| `explanation` | NVARCHAR(500) NULL | Testo audit |
| `created_at` | DATETIME2 NOT NULL | |

Indice: `(certificate_id)`, `(organization_id, result)`.

---

## Enum `product_form` (estendibile)

Non è ISO 6929 grezzo: il ruolo decide il vocabolario.

| `material_role` | Valori MVP | Esempio UI |
|-----------------|------------|------------|
| `base` | `plate` \| `sheet` \| `section` \| `tube` \| `hollow_section` \| `bar` \| `other_base` | Piastra, lamiera, profilo, tubo, sezione cava, barra |
| `filler` | `wire` \| `covered_electrode` \| `cored_wire` \| `flux` \| `insert` \| `other_filler` | Filo, elettrodo rivestito, filo animato, flusso, inserto |

`wire` ISO 6929 (semilavorato acciaio) ≠ filo d’apporto: si disambigua con `material_role=filler`.

---

## JSON di estrazione (stesso dizionario, chiavi estendibili)

Schema logico persistito in `extracted_json` / `corrected_json`. Campi lab **non** diventano colonne SQL in MVP.

Chiavi comuni (EN 10168 dove applicabile):

```text
inspection_document_type    A02
certificate_no              A03
manufacturer_works          A01
purchaser                   A06
purchaser_order_no          A07
material_role               (non 10168 — SGQ)
product_form                B01
material_standard
delivery_condition          B04
heat_or_lot_no              B07
dimensions                  B09–B11
actual_mass                 B13
ReH, Rm, A                  C11–C13
KV                          C40–C43
hardness                    C30–C32
chemistry{}                 C71–C92
CEV
ndt[]
validated_by                Z02
compliance_statement        Z01
```

Solo **base**:

```text
steel_designation           B02     es. S355J2
```

Solo **filler**:

```text
filler_designation                  es. G 42 4 M21 3Si1
filler_standard                     es. ISO 14341 (classificazione)
filler_diameter_mm
hydrogen_class                      se stampato (H5/H10) — niente soglia inventata
```

`designation` in tabella = `steel_designation` se `base`, `filler_designation` se `filler`.

Ingest tipo documento (ADR-020): **`material_certificate`** (non solo `material_certificate_3_1`). Il tipo 2.1–3.2 sta in `inspection_document_type`.

---

## OCR — `text_extract_reason`

Riuso `documentTextExtractor` / `ocrExtractor` (stesso SAL S1a). Valori stabili, niente throw verso l’UI:

| `reason` | Significato |
|----------|-------------|
| `text_layer` | PDF con testo, OCR non necessario |
| `ocr_ok` | OCR riuscito |
| `ocr_poor` | Testo troppo corto / inaffidabile |
| `ocr_unavailable` | Motore OCR non configurato sul VPS |
| `ocr_failed` | OCR tentato, errore |
| `ocr_skipped` | Formato non PDF/immagine, o operatore salta |

MC-B collega l’OCR; MC-1 crea già la colonna.

---

## Indici (MC-1)

| Indice | Colonne |
|--------|---------|
| `IX_mc_cert_org_company` | `(organization_id, company_id)` |
| `IX_mc_cert_org_status` | `(organization_id, workflow_status)` |
| `IX_mc_cert_org_role` | `(organization_id, material_role)` |
| `IX_mc_cert_org_ddt` | `(organization_id, ddt_no)` |

---

## Relazione ingest e registry

1. Upload MVP: crea (o aggancia) `import_jobs` + `import_job_files` **e** una riga `material_certificates` in `received`.
2. Extract scrive testo + JSON; stato `extracted` poi Rule Engine → `pending_review`.
3. Approvazione umana → `compliant` / `non_compliant`.
4. MC-7: commit registry (doc_type dedicato, es. `mtc` / `material_certificate`) e `archived`.

Non duplicare lo storage del PDF se `import_job_files.storage_path` basta.

---

## Rule Engine (contratto dati — implementazione MC-3)

Input: `corrected_json` ?? `extracted_json` + `kb_snapshot_*`.  
Output: `evaluate_result_json` + righe `material_certificate_checks`.

Regole MVP già chiuse:

| Caso | Esito check |
|------|-------------|
| Capitolato chiede 3.1, PDF è 2.2 | `fail` su `inspection_document_type` |
| Lamiera S355, Markdown EN 10025-2 presente | confronta ReH/chimica/KV se in specifica |
| Tubo, EN 10210-1 / 10219-1 assenti | `skip` soglie meccaniche/chimica prodotto |
| Apporto, ISO 2560/17632/14174 assenti | `skip` soglie; **non** skip del tipo EN 10204 se richiesto |
| ISO 14341 presente | al più verifica **forma** della designazione (classificazione), non tabelle chimica 3A/3B (GAP estrazione noto) |

---

## Cosa NON fare

- Tabella o modulo CRUD «consumabili» nel welding book / dashboard 3834.
- `ON DELETE CASCADE` da certificato verso `import_jobs` o `document_registry`.
- Colonne SQL per ogni elemento chimico (restano nel JSON).
- Seed soglie apporto o tubi senza Markdown in inventario.
- `if (cliente === 'FASSI')`.
- Far scrivere `compliant` all’AI.
- Numerare la migration in questa spec: MC-1 prende il prossimo libero.
