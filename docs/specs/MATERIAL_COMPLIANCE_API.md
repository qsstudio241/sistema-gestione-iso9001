# Material Compliance — API (MC-0)

> **Tipo**: spec tecnica API (nessun controller in questa slice)  
> **Versione**: 1.0 — 16/08/2026  
> **Stato**: Proposto — fondazione  
> **Slice**: implementazione in **MC-4** (routes/controller) + **MC-6** (seam licenza)  
> **Data model**: [MATERIAL_COMPLIANCE_DATA_MODEL.md](MATERIAL_COMPLIANCE_DATA_MODEL.md) · **UI**: [MATERIAL_COMPLIANCE_UI.md](MATERIAL_COMPLIANCE_UI.md)  
> **Prodotto**: [MODULO_MATERIAL_COMPLIANCE_AI.md](MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **ADR**: 020–024

---

## Sintesi (per il committente)

Le API caricano il PDF, fanno estrarre i campi, lanciano il confronto automatico e registrano chi ha detto sì o no. Valgono **sia** per i certificati delle lamiere **sia** per quelli del filo/elettrodo. Senza licenza Saldatura + Import AI il server risponde 403.

---

## Prefisso e riuso

| Voce | Valore |
|------|--------|
| Prefisso | `/api/material-certificates` |
| Auth | JWT cookie httpOnly, come il resto. Client: **solo Axios** `withCredentials` |
| Tenant | `organization_id` **sempre** da `req.user`, mai dal body |
| Ambito azienda | `companyAccess.service.js` (`ensureCompanyAccessLoaded`, `companyAccessSqlFilter`, `assertMutatingAllowed`) — pattern Qualifiche / Commesse, non `user.company_id` |
| File BE nuovi | aggiungere in `backend/scripts/deploy-manifest.json` (MC-4) |
| HTTP | `importAiExtraction.service.js` + `aiProviderAdapter` per extract; Rule Engine puro (MC-3) per evaluate; `logAiInteraction` su extract (MC-6) |

Niente `fetch` dal frontend. Niente secondo client HTTP.

---

## Seam licenza `MATERIAL_COMPLIANCE`

Come `hasSalLegalConformityCapability`: una funzione `hasMaterialComplianceCapability(organizationId, role)`.

MVP: **ON** se l’org ha **sia** `saldatura` **sia** `ai_import` (admin/superadmin bypass invariato, stesso `requireLicensedModule`).

- Capability OFF → `403` `{ error: 'MODULE_NOT_LICENSED', module: 'MATERIAL_COMPLIANCE' }`
- Scorporo futuro: una chiave in `KNOWN_MODULE_KEYS` + un rigo di repoint, senza riscrivere le route.

Middleware route: o `requireLicensedModuleAny` non basta (è OR). Serve un `requireMaterialComplianceCapability` che fa AND, oppure due check in serie. **Non** mappare MC solo su `saldatura` (si caricherebbero PDF senza licenza ingest).

---

## Endpoint MVP

Base path sotto il router autenticato esistente (`server.js`).

| Metodo | Path | Scopo |
|--------|------|--------|
| `GET` | `/api/material-certificates` | Lista filtrata (griglia) |
| `GET` | `/api/material-certificates/stats` | Conteggio card KPI (stesse funzioni filtro elenco) |
| `GET` | `/api/material-certificates/:id` | Dettaglio + JSON extract + checks |
| `POST` | `/api/material-certificates` | Crea da upload PDF (multipart) |
| `PATCH` | `/api/material-certificates/:id` | Corregge anagrafica/DDT/campi extract (non lo stato finale) |
| `POST` | `/api/material-certificates/:id/extract` | Testo + AI JSON (riuso ingest) |
| `POST` | `/api/material-certificates/:id/evaluate` | Rule Engine, zero LLM |
| `POST` | `/api/material-certificates/:id/approve` | HITL → `compliant` |
| `POST` | `/api/material-certificates/:id/reject` | HITL → `non_compliant` |
| `POST` | `/api/material-certificates/:id/archive` | → `archived` (MC-7 potrà agganciarsi al registry) |

Niente `DELETE` fisico in MVP (ISO §7.5). Soft: resta `archived`.

---

## Query lista `GET /`

| Query | Note |
|-------|------|
| `company_id` | Opzionale; se assente, filtro Ambito già nel SQL (`companyAccessSqlFilter`). Non accettare un `company_id` fuori scope → 403 |
| `workflow_status` | Uno o più, allineati alle card Esito |
| `material_role` | `base` \| `filler` |
| `q` | Ricerca su DDT, n. certificato, designation, colata/lotto |
| `limit` / `offset` | Paginazione; default ragionevole (es. 50) |

Risposta: array di **colonne griglia** + `id`, non il JSON laboratorio.

`GET /stats` restituisce i conteggi per le card (esito × ruolo) **con gli stessi filtri Ambito**, senza una seconda query di business diversa.

---

## Upload `POST /`

`multipart/form-data`:

| Campo | Obbligatorio | Note |
|-------|--------------|------|
| `file` | Sì | PDF (scan ammesso) |
| `company_id` | Sì | Deve essere nello scope mutazione |
| `material_role` | No | Default `base`; l’AI può correggere in extract |
| `ddt_no` / `ddt_date` | No | Compilabili dopo |

Effetto: job ingest (riuso `import_jobs` / file) + riga `received`. Non lanciare da solo `approve`.

Errori file: stesso tono di `describeIngestFileError` (qualifiche), non stack trace.

---

## Extract `POST /:id/extract`

1. `documentTextExtractor` sul file.
2. Se testo sotto soglia → `ocrExtractor` (quando MC-B è collegato; prima: `text_extract_reason=ocr_unavailable` o `ocr_skipped` senza crash).
3. `importAiExtraction` + schema dizionario (`material_certificate`).
4. Persistenza `extracted_text`, `extracted_json`, `text_extract_reason`, `ai_model`.
5. `logAiInteraction` (MC-6).
6. Stato → `extracted` (o `text_ready` se JSON assente).

Body risposta minimo:

```json
{
  "id": 1,
  "workflow_status": "extracted",
  "text_extract_reason": "ocr_ok",
  "extracted_json": { "material_role": "filler", "filler_designation": "G 42 4 M21 3Si1" }
}
```

`reason` sempre presente, anche se `text_layer`. Valori: vedi data model (`ocr_*`, `text_layer`).

Prompt AI: deve classificare `material_role` (`base` \| `filler`). Sinonimi apporto: filo, wire, electrode, elettrodo, flux, flusso, consumabile, ISO 14341, ISO 2560, AWS ER70S. Se incerto → `base` + campo in revisione, non un terzo valore.

---

## Evaluate `POST /:id/evaluate`

- Input DB: JSON corretto ?? estratto + loader KB (hash).
- Motore: `evaluateMaterialCertificate` in `materialComplianceRuleEngine.service.js` (**MC-3**, zero LLM).
- **Zero** chiamate LLM.
- Scrive `evaluate_result_json`, sostituisce le righe `material_certificate_checks`, stato → `pending_review` se era `extracted` / `pending_review`.
- Non passa a `compliant`.

Skip obbligatori (stesso motore, `result: skip`):

- Norma prodotto assente in Markdown (apporto oltre classificazione 14341); hollow senza citazione 10210 vs 10219; EN 10210-2 / 10219-2 da sole.
- Livello ADR-021 non nello scope (niente PO, niente `customers/`, niente `companies/<slug>/`).

Fail: tipo documento richiesto dal capitolato/PO ≠ tipo sul PDF, quando quel requisito è nello snapshot.

---

## HITL approve / reject / archive

| Azione | Precondizione | Effetto |
|--------|---------------|---------|
| `approve` | `pending_review` (o già `non_compliant` in riesame, da decidere in MC-4: sì al riesame con nota) | `compliant`, `reviewed_by`, `reviewed_at` |
| `reject` | come sopra | `non_compliant` + `review_notes` consigliate |
| `archive` | `compliant` o `non_compliant` | `archived` |

401 se non autenticato. 403 se viewer in sola lettura (`assertMutatingAllowed`). 409 se stato non consente la transizione.

PATCH campi: **non** accetta `workflow_status=compliant` nel body — solo le route HITL.

Dopo correzione campo: il client chiama di nuovo `evaluate` (o PATCH che, se tocca `corrected_json`, può innescare evaluate lato server: **una** delle due, da fissare in MC-4; preferire esplicito `evaluate` come WPQR).

---

## Payload dettaglio `GET /:id`

Oltre alle colonne anagrafica:

- `extracted_text`, `text_extract_reason`
- `extracted_json`, `corrected_json`
- `evaluate_result_json`
- `checks[]` (righe tabella)
- `kb_snapshot_hash` (non necessariamente tutto lo snapshot in lista)
- link file (`storage_path` o URL già usati dagli allegati ingest — stesso pattern, niente URL firmati nuovi in MVP)

404 se id fuori `organization_id` / fuori Ambito (non svelare l’esistenza cross-tenant).

---

## Errori (contratto)

| HTTP | Quando |
|------|--------|
| 400 | File mancante, JSON extract illeggibile, `material_role` fuori enum |
| 401 | Non autenticato |
| 403 | Licenza OFF, company fuori scope, viewer in scrittura |
| 404 | Id inesistente **in questo** tenant/scope |
| 409 | Transizione stato illegale |
| 413 | File oltre limite ingest esistente (riusare multer attuale, non un tetto nuovo) |
| 500 | Solo bug; extract OCR fallito → 200 con `text_extract_reason=ocr_failed`, non 500 |

Messaggi utente in italiano, senza segreti interni.

---

## Allineamento ingest (chiavi manuali)

Quando si aggiunge una chiave a `aiExpectedSchema` del tipo `material_certificate`, la stessa chiave entra:

1. dizionario `fields.md`
2. elenco campi PATCH / form React
3. CI `manualEditCompletenessCheck.js` (stesso gate WPQR/qualifiche)

MC-4 registra il tipo in `documentTypeSchemas.js` (FE **e** BE).

---

## Cosa NON fare

- Nuova tabella HTTP «consumabili».
- Auto-approve in extract o evaluate.
- Leggere `organization_id` dal client.
- Prompt «dimmi se è conforme» (ADR-022).
- Inventare soglie nel service se il Markdown manca: `skip`.
- Secondo motore OCR.
- Esporre editor KB multi-tenant.
