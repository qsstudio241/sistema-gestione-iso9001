# DEPUTYTASK — Profilo azienda conformità legislativa (ADR-018) — S1→S3

**Stato:** APERTO (S1–S3 implementati; chiusura dopo TEST OK + PR)  
**Priorità:** P1 — fondazione dati per conformità legislativa 14001/45001 (non breaking)  
**Branch base:** `main`  
**Creato da:** Lead 23/07/2026  
**Spec:** [ADR-018](../adr/ADR-018-company-profile-conformita-legislativa.md) · [Catalogo campi/Excel](../specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md)

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main` (o partire da `origin/main` aggiornato). **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

- `companies` resta **minima** (lista/audit/export invariati).
- Nuova tabella **`company_profile`** 1:1 (`company_id` PK).
- Feature **gated** da `hasSalLegalConformityCapability` (seam già in `moduleLicense.service.js`, oggi → `ai_norms`).
- Import Excel = stesso pattern scadenziario (ADR-013): detect → dry-run → upsert.
- Livello A = recuperabile (visura/Excel); livello B = solo consulente/studio.

## Cosa NON toccare

- Contratto create/update minimo di `companies` (name, vat_number, sector, address) usato da lista/audit.
- Pipeline `importJobs` / ADR-017 (PDF/AI).
- Logic sync audit / ADR-008.
- Non introdurre nuova chiave licenza: riusare il seam `SAL_LEGAL_CONFORMITY`.

---

## Slice S1 — Migration DB

**Stato S1:** FATTO (13/08/2026) — `145_company_profile.sql` + `run-migration-145-vps.js`.

**File previsti:**

- `database/migrations/145_company_profile.sql` (idempotente — **verificare `ls database/migrations/ | sort | tail -5` prima di eseguire**: `130` era già occupato da `130_user_audit_log.sql` al 23/07/2026, sequenza condivisa arrivata a `144` il 13/08/2026; il numero libero cambia ad ogni PR che tocca migrazioni, non fidarsi del valore scritto qui)
- `backend/scripts/run-migration-145-vps.js` (stesso numero della migrazione)

**Cosa fare:**

1. Creare tabella `company_profile` come da ADR-018 + colonne del catalogo (NVARCHAR/INT/BIT; `source_meta` NVARCHAR(MAX); indici `(organization_id)`, PK `company_id`).
2. Script VPS con `require('/var/www/sgq-backend/src/config/database')` (pattern migrazioni cloud).
3. Verificare assenza riga ≠ errore (outer join / GET restituisce oggetto vuoto o 404 soft — decidere in S2a: preferire **200 + `{}` defaults**).

**DoD:** migration applicabile due volte senza errore; nessun ALTER su `companies` salvo FK dalla nuova tabella.

**Parallelismo:** S1 prima di S2a/S3a; S2b può partire sul mock FE in parallelo a S1.

---

## Slice S2a — API profilo (BE)

**Stato S2a:** FATTO (13/08/2026) — GET/PUT `/companies/:id/profile`.

**File previsti:**

- `backend/src/controllers/companyProfile.controller.js` (+ test Jest)
- Route sotto `company.routes.js` (o file dedicato montato allo stesso prefisso)
- Riuso: `companyAccess.service.js`, `hasSalLegalConformityCapability`

**Endpoint:**

| Metodo | Path | Note |
|--------|------|------|
| GET | `/companies/:id/profile` | 403 se no capability; scope company |
| PUT | `/companies/:id/profile` | upsert; write access + capability; aggiorna `source_meta` per campi toccati (`manual`) |

**DoD:** test 403 capability OFF; 403 cross-tenant; upsert idempotente; deploy-manifest aggiornato se nuovi file.

---

## Slice S2b — UI tab Profilo (FE)

**Stato S2b:** FATTO (13/08/2026) — tab «Profilo conformità» in `CompanyDetailPage`.

**File previsti:**

- Estendere `app/src/pages/CompanyDetailPage.jsx` (nuova tab «Profilo conformità» o sezione sotto Anagrafica)
- CSS: riuso classi `studio-*` esistenti
- Nascondere tab se capability OFF (legge flag da API utente/moduli già usato altrove; se manca endpoint dedicato, soft-hide su 403 GET profile)

**Cosa fare:**

1. Form sezioni: Identità A · Sede A · Dimensione B · SSL B · Ambiente B (sezioni collassabili, UI guida flusso).
2. Salvataggio PUT; stati dirty/saved come form anagrafica attuale.
3. Read-only se `!canEditCompany`.

**DoD:** Vitest minimo (tab assente su 403 / presente con dati); build OK.  
**Riuso UI:** `notes-textarea` per campi testo lunghi; niente card decorative.

---

## Slice S3a — Detector + import Excel (BE)

**Stato S3a:** FATTO (13/08/2026) — detect dry-run + import JSON + template xlsx.

**File previsti:**

- `backend/src/utils/excelCompanyProfileDetector.js` (+ `.test.js`)
- Endpoint `POST /companies/:id/profile/detect-import` (multipart o path file temporaneo)
- Endpoint `POST /companies/:id/profile/import` (mapping + confirm)
- Opz.: `GET /companies/profile/import-template` → buffer xlsx

**Pattern:** copiare struttura da `excelDeadlineDetector.js` + controller deadlines (detect/import), ma target = upsert `company_profile` per `company_id` corrente.

**DoD:** Jest su sinonimi header + bool `si/no`; re-import idempotente; capability + write obbligatori.

---

## Slice S3b — Dialog import + template (FE)

**Stato S3b:** FATTO (13/08/2026) — pulsanti «Scarica modello» / «Importa Excel» + dialog preview.

**File previsti:**

- `app/src/components/CompanyProfileImportDialog.jsx` (adattare `DeadlineImportDialog.jsx`)
- Pulsanti in tab Profilo: «Scarica modello», «Importa Excel»

**DoD:** dry-run mostra preview campi; conferma scrive; desktop-first.

**Parallelismo:** S3a ∥ S3b dopo contratto mapping JSON concordato (vedi catalogo §4–5).

---

## Slice S4 (dopo S2) — Completeness + sync soft

- Badge completezza (pesi in catalogo §6).
- Checkbox opzionali: «Aggiorna anche nome/P.IVA/indirizzo in anagrafica base» → update `companies` solo se spuntate.

---

## Fuori scope di questo brief

- Lookup automatico InfoCamere/API (S5 ADR).
- Auto-create aziende da Excel multi-riga.
- Registro obblighi automatico da ATECO.

---

## Verifica chiusura

Alla fine di ogni slice: TEST OK (Jest e/o Vitest mirati + build `app` se tocca FE) oppure FIX NON APPLICABILI con motivo.

Aggiornare riga esperienza in `docs/GUIDA_CONSOLIDATA.md` solo se emerge lezione nuova.

---

## Comando deputy (dopo push di questo brief su `origin/main`)

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

Il deputy allinea Git da solo all'avvio (`git fetch` / `git pull origin main`).
