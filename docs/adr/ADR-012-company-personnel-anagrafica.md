# ADR-012 � Anagrafica personale per azienda (dual-level rubrica NC)

> **Stato**: Accettato � 02 giugno 2026  
> **Autori**: Lead architect (AI), Product owner  
> **Epic**: [TASK_PERSONALE_AZIENDA_SLICES.md](../agent-tasks/TASK_PERSONALE_AZIENDA_SLICES.md) (slice S1�S10)  
> **Collegamento roadmap**: open point �NC � rubrica dual-level Studio/Azienda�

---

## Contesto e problema

La rubrica `notification_contacts` � **org-wide** (studio): un unico elenco referenti per organizzazione, senza legame strutturato all�azienda auditata.

Conseguenze sul modulo NC:

| Problema | Impatto |
|---------|---------|
| Select responsabile/verifica non filtrati per `audit.company_id` | Rischio assegnazione referente sbagliato |
| Duplicati manuali (stesso nome in rubrica studio e note NC) | Dati incoerenti, GDPR |
| Nessuna anagrafica �dipendente/referente azienda� riusabile | Audit picker, qualifiche, personale azienda bloccati |

Serve un modello **dual-level**: referenti **studio** (rubrica org-wide, `company_id` NULL) + personale **per singola azienda** collegato al contesto audit.

---

## Decisione

### 1. Nuova tabella `company_personnel`

Anagrafica minima per dipendente/referente aziendale:

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | INT PK | Identity |
| `organization_id` | INT NOT NULL | FK `organizations` � scope tenant |
| `company_id` | INT NOT NULL | FK `companies` � azienda auditata |
| `name` | NVARCHAR(200) NOT NULL | Nome visualizzato |
| `job_title` | NVARCHAR(200) NULL | Mansione |
| `email` | NVARCHAR(320) NULL | **Opzionale** (alert NC solo se valorizzata + bridge) |
| `active` | BIT NOT NULL DEFAULT 1 | Disattivazione soft |
| `can_actuation` | BIT NOT NULL DEFAULT 0 | Idoneo responsabile **azione** NC |
| `can_verify` | BIT NOT NULL DEFAULT 0 | Idoneo responsabile **verifica** NC |
| `notification_contact_id` | INT NULL | Bridge verso rubrica (slice S7) |
| `created_at`, `updated_at` | DATETIME2 | Audit trail |

Indici: `(organization_id, company_id)`, `(company_id, active)`.

**Migration**: `078_company_personnel.sql` (prossima libera dopo 077).

### 2. Bridge su `notification_contacts`

Estensione idempotente:

- `company_id INT NULL` � NULL = referente studio; valorizzato = derivato da personale azienda
- `personnel_id INT NULL` � FK logica verso `company_personnel.id`

Referenti studio restano con `company_id` NULL. Sync bidirezionale personale ? rubrica in **slice S7** (non in S1�S3).

### 3. Regole prodotto

| Regola | Dettaglio |
|--------|-----------|
| **Attuazione NC** | Solo personale/referenti con scope **azienda** (`can_actuation` o rubrica `company_id` valorizzato) |
| **Verifica NC** | Scope **azienda \| studio** (`can_verify` o referente studio `role_type = verifica`) |
| **Email anagrafica** | Opzionale; obbligatoria solo se si vuole notifica automatica (bridge S7) |
| **Eliminazione** | **No delete fisico** se esiste FK da NC/azioni su `notification_contacts` collegato; solo `active = 0` |
| **Duplicati studio/azienda** | Consentiti nomi uguali; distinzione per `company_id` |
| **GDPR minimo** | Email opzionale; disattivazione invece di cancellazione quando storico NC |

Fino a **slice S8** live: mantenere opzione �referente esterno� su verifica/azioni NC.

---

## Backend previsto (S2�S3)

| Componente | Pattern di riferimento |
|------------|------------------------|
| Controller | `companyPersonnel.controller.js` � CRUD sotto `/api/v1/companies/:companyId/personnel` |
| RBAC | `resolveAuditorOrgId` + verifica `companies.auditor_org_id` come `company.controller.js` |
| Cross-studio | 403 se `company_id` non appartiene all�`auditor_org_id` dell�utente |
| Route | Registrate in `company.routes.js` |

Operazioni API:

- `GET` � lista personale attivo/inattivo per azienda
- `POST` � creazione con validazione `company_id` ? org utente
- `PUT` � aggiornamento campi anagrafica e flag `can_*`
- `DELETE` � **disattivazione** (`active = 0`); 409 se vincoli NC impediscono rimozione bridge

---

## Test previsti

| Livello | Scope | Casi |
|---------|-------|------|
| **Jest (S3)** | `companyPersonnel.controller.test.js` | list/create/update/disactivate; 403 cross-studio; validazione company ? org |
| **Vitest (S4�S5)** | UI scheda azienda + griglia | Navigazione tab Personale; add/edit/disattiva 3 righe |
| **Integrazione (S7�S8)** | Bridge + select NC | Sync rubrica; dropdown filtrati per `audit.company_id` |

---

## Alternative valutate

| Alternativa | Pro | Contro | Esito |
|-------------|-----|--------|-------|
| Solo `notification_contacts.company_id` | Meno tabelle | Nessuna mansione/flag granulari; rubrica = contatti notifica | Scartata |
| Tabella unificata �contacts� | Un solo CRUD | Mix responsabilit� studio/azienda/NC; migrazione legacy pesante | Scartata |
| **`company_personnel` + bridge** | Separazione anagrafica vs alert; estendibile audit/qualifiche | Due entit� da sincronizzare (S7) | **Scelta** |

---

## Conseguenze

### Positivi

- Select NC allineate al contesto audit (post S8)
- Tracciabilit� ISO 10.2 su responsabili per azienda
- Base per overview studio multi-azienda (S6)

### Negativi / costi

- Migration + API + UI (S2�S5) prima del valore utente completo
- Sync bridge S7 obbligatorio per email alert da anagrafica

---

## Implementazione � checklist slice

| Slice | Deliverable | Stato |
|-------|-------------|-------|
| S1 | Questo ADR + regole prodotto | ? |
| S2 | Migration 078 | S2 |
| S3 | API CRUD + Jest | S3 |
| S4�S5 | UI scheda azienda + griglia | Backlog |
| S7 | Bridge `notification_contacts` | Backlog |
| S8 | Select NC filtrati | Backlog |
| S9 | Migrazione legacy dry-run | Backlog |

---

## Changelog

| Data | Modifica | Autore |
|------|----------|--------|
| 02/06/2026 | Creazione ADR (slice S1) | AI Agent |
