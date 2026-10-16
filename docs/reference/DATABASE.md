# DATABASE — SGQ ISO 9001

> **Leggere all'inizio di ogni sessione che tocca il DB.**  
> Fonte di verità: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (dettaglio completo) — questo file è il quick-reference operativo.

---

## Connessione

| Parametro | Valore |
|---|---|
| **Host** | Valore in `backend/config/database.json` (gitignored; produzione vs sviluppo) |
| **Database** | `SGQ_ISO9001` |
| **Driver** | `mssql` (Node.js) |
| **Utente SQL** | Definito in `backend/config/database.json` (file **locale**, non in git) o tramite variabili `DB_USER` / `DB_PASSWORD`. |
| **SSH** | `ssh -p 1122 spascarella@sistemi.fr-busato.it` — password/chiave **non** in repository; preferire PuTTY session o chiave. |

**Nota (evitare perdite di tempo):** l’utente **Linux** usato in SSH **non è** necessariamente uguale a **`DB_USER`** per SQL Server. Sono due mondi separati (stesso host, porte e servizi diversi). Cosa può fare l’assistente in Cursor senza password interattive: → [REFERENCE.md](../REFERENCE.md) sezione *Assistente AI (Cursor) e accesso remoto*.

### Setup locale `database.json`

1. Copia il template: `backend/config/database.json.example` → `backend/config/database.json`.
2. Compila host, utente e password reali (il file è in `.gitignore` e non va committato).
3. In alternativa o in aggiunta, sul server o in CI puoi impostare **`DB_SERVER`**, **`DB_PORT`**, **`DB_DATABASE`**, **`DB_USER`**, **`DB_PASSWORD`** (override rispetto al JSON).

**VPS / clone con `git pull`:** sul **PC di sviluppo** il backend è un repo Git normale. Sulla **macchina di produzione**, la cartella applicativa **`/var/www/sgq-backend`** è invece una **copia file** (non un clone): lì **`git pull` non applica** gli aggiornamenti del codice applicativo; usare lo script di deploy o `scp` (vedi [REFERENCE.md](../REFERENCE.md)). Se sul server esisteva già `config/database.json` e fai `git pull` in un **clone** separato, valuta backup prima di sovrascrivere.

Script di utilità (tutte **mai** in repository): **`NEW_ADMIN_PASSWORD`** (`reset-admin-password.js`); **`SGQ_TEST_ADMIN_PASSWORD`** (`verify-fase1.js`, `verify-audit-2026-02.js`, `test-patch-api.js`, `test-api.sh`); **`SGQ_TEST_USER_PASSWORD`** (`backend/tests/setup-test-user.js`); **`SGQ_TEST_REGISTER_PASSWORD`** (`backend/tests/test-server-connection.js`); **`SGQ_TEST_OFFLINE_SYNC_PASSWORD`** (`backend/tests/test-offline-conflict.js`); **`SGQ_TEST_MULTI_TENANT_PASSWORD_A`** / **`SGQ_TEST_MULTI_TENANT_PASSWORD_B`** (`backend/tests/test-multi-tenant.js`). **`backend/run-migration.js`** usa solo `backend/config/database.json` (o override **`DB_*`**), mai credenziali nel file.

### Accesso interattivo da terminale

```powershell
# SSH (autenticazione interattiva o tramite chiave / Pageant)
ssh -p 1122 spascarella@sistemi.fr-busato.it

# Da VPS — sqlcmd (sostituisci utente/password con quelli del tuo ambiente, non in repo)
sqlcmd -S localhost -U YOUR_USER -d SGQ_ISO9001
```

### Script Node `backend/scripts/repro-custom-export.mjs`

Legge l’audit `2026-06` dal DB e genera `app/tmp-audit-2026-06-repro.docx`. La connessione usa `backend/config/database.json` (o override `DB_*`):

| `NODE_ENV` | Effetto tipico |
|---|---|
| **`development`** | Host/porta di lavoro (come in tabella sopra) — **usare questo** per il repro sul PC di sviluppo. |
| **`test`** | `localhost:1433` + DB `SGQ_ISO9001_Test` — serve solo se hai SQL Express locale; altrimenti fallisce con `ESOCKET`. |

Se il terminale (es. Cursor) imposta `NODE_ENV=test`, lo script **forza `development`** prima di aprire il pool, così il repro coincide con la connessione documentata.

---

## Tabelle

### `organizations`  *(multi-tenancy root)*

```sql
organization_id   INT IDENTITY  PK
organization_name NVARCHAR(255) UNIQUE NOT NULL
created_at        DATETIME2     DEFAULT GETDATE()
is_active         BIT           DEFAULT 1
```

### `users`

```sql
user_id          INT IDENTITY  PK
organization_id  INT           FK → organizations
email            NVARCHAR(255) UNIQUE NOT NULL
password_hash    NVARCHAR(255) NOT NULL
full_name        NVARCHAR(255)
role             NVARCHAR(20)  CHECK ('admin','auditor','viewer')  -- ⚠️ minuscolo
is_active        BIT           DEFAULT 1
created_at       DATETIME2
```

### `standards`  *(master data — read-only)*

```sql
standard_id    INT IDENTITY  PK
standard_code  NVARCHAR(50)  UNIQUE  -- es: 'ISO_9001'
standard_name  NVARCHAR(255)
version        NVARCHAR(20)          -- es: '2015'
is_active      BIT           DEFAULT 1
```

Seed presenti: `ISO_9001` (id 1), `ISO_14001` (id 2), `ISO_45001` (id 3)

### `checklist_sections`  *(master data)*

```sql
section_code   NVARCHAR(50)  PK      -- es: 'clause4'
section_title  NVARCHAR(255)
standard_id    INT           FK → standards
display_order  INT
```

Clausole ISO 9001: `clause4` … `clause10`

### `checklist_questions`  *(master data)*

```sql
question_id    INT IDENTITY  PK
standard_id    INT           FK → standards
section_code   NVARCHAR(50)  FK → checklist_sections
question_text  NVARCHAR(MAX)
question_type  NVARCHAR(20)  CHECK ('TEXT','YES_NO','MULTIPLE_CHOICE')  -- ⚠️ MAIUSCOLO
is_mandatory   BIT           DEFAULT 1
display_order  INT
is_active      BIT           DEFAULT 1
created_at/updated_at DATETIME2
```

> ISO 9001:2015 ha **35 domande** attive.

### `response_options`  *(master data)*

| code | Nome IT | Peso % | Escludi da calcolo |
|------|---------|--------|--------------------|
| C | Conforme | 100.00 | 0 |
| OSS | Osservazione | 50.00 | 0 |
| NC | Non Conforme | 0.00 | 0 |
| OM | Opportunità Miglioramento | 75.00 | 0 |
| NA | Non Applicabile | NULL | 1 |
| NV | Non Verificato | NULL | 1 |

### `audits`

```sql
audit_id         INT IDENTITY  PK
organization_id  INT           FK → organizations
audit_number     NVARCHAR(50)  UNIQUE
audit_date       DATE
lead_auditor_id  INT           FK → users (nullable)
status           NVARCHAR(20)  CHECK ('draft','in_progress','completed','approved')  -- ⚠️ minuscolo
created_at/updated_at DATETIME2
```

### `audit_standards`  *(join table multi-standard)*

```sql
PK composta: (audit_id, standard_id)
audit_id     INT  FK → audits
standard_id  INT  FK → standards
```

### `audit_responses`

```sql
response_id        INT IDENTITY  PK
audit_id           INT           FK → audits
question_id        INT           FK → checklist_questions
answer_value       NVARCHAR(MAX) nullable
conformity_status  NVARCHAR(10)  CHECK ('C','NC','OSS','OM','NA','NV', NULL)
notes              NVARCHAR(MAX)  -- ⚠️ NON 'response_notes'
is_answered        BIT           DEFAULT 0
answered_at        DATETIME2     nullable
created_by         INT           FK → users (nullable)
created_at/updated_at DATETIME2
```

### `non_conformities`

```sql
nc_id         INT IDENTITY  PK
audit_id      INT           FK → audits
standard_id   INT           FK → standards
section_code  NVARCHAR(50)  FK composite → checklist_sections
nc_number     NVARCHAR(50)  -- es: 'NC-001'
nc_type       NVARCHAR(20)  CHECK ('major','minor','observation')
description   NVARCHAR(MAX)
severity      INT           -- 1=Low 2=Medium 3=High
status        NVARCHAR(20)  CHECK ('open','in_progress','closed')
created_at/updated_at DATETIME2
```

### `attachments`

```sql
attachment_id    INT IDENTITY  PK
attachment_uuid  UNIQUEIDENTIFIER  -- uuid v4
audit_id         INT           FK → audits (nullable se legato a NC)
nc_id            INT           FK → non_conformities (nullable)
question_id      INT           FK → checklist_questions (nullable)
file_name        NVARCHAR(500)
file_type        NVARCHAR(100) -- MIME type
file_size        BIGINT        -- bytes (migration 017: rinominato da file_size_bytes)
mime_type        NVARCHAR(100)
storage_path     NVARCHAR(MAX) -- relativo a uploads/
category         NVARCHAR(50)  DEFAULT 'evidence'
description      NVARCHAR(MAX) nullable
uploaded_by      INT           FK → users
created_at       DATETIME2     DEFAULT GETDATE()
```

> Formati supportati: `.jpg`, `.jpeg`, `.png`, `.heic`, `.mp3`, `.m4a`, `.wav`, `.mp4`, `.mov`, `.pdf`, `.docx`, `.xlsx`

### `pending_issues`  *(migration 018)*

```sql
issue_id          INT IDENTITY  PK
target_audit_id   INT           FK → audits (CASCADE DELETE)
source_audit_id   INT           FK → audits
question_id       INT           FK → checklist_questions
source_response_id INT          FK → audit_responses (NO ACTION — evita ciclo cascade)
status            NVARCHAR(20)  CHECK ('open','resolved','persists')
original_status   NVARCHAR(10)  CHECK ('NC','OSS','OM')
resolution_notes  NVARCHAR(MAX) nullable
organization_id   INT           FK → organizations
created_at/updated_at DATETIME2
```

### `audit_history`  *(tracciabilità ISO 7.5.3)*

```sql
history_id    INT IDENTITY  PK
audit_id      INT           FK → audits
changed_by    INT           FK → users
change_type   NVARCHAR(50)  -- 'created','updated','status_changed','deleted'
field_changed NVARCHAR(100) nullable
old_value     NVARCHAR(MAX) nullable  -- JSON se campo complesso
new_value     NVARCHAR(MAX) nullable
changed_at    DATETIME2     DEFAULT GETDATE()
```

### `sync_metadata`

```sql
sync_id              INT IDENTITY  PK
audit_id             INT           FK → audits (design generico via entity_type)
user_id              INT           FK → users (nullable)
last_sync_timestamp  DATETIME2
server_version       INT
client_version       INT           nullable
conflict_count       INT           DEFAULT 0
created_at           DATETIME2
```

> Non ha FK diretta ad audit_responses o NC: usa `entity_type` ('audit','response','nc') + `entity_id`.

### `wpqr_test_runs`  *(migration 173 — dati di prova WPQR, una riga per passata)*

```sql
id                  INT IDENTITY  PK
organization_id     INT           NOT NULL  (tenant; coerente con wpqr_records)
company_id          INT           NULL      (come wpqr_records.company_id)
wpqr_id             INT           NOT NULL  FK → wpqr_records(id) (senza ON DELETE: la cancellazione WPQR elimina prima le passate)
run_no              INT           NULL      (primo intero dell'etichetta)
run_label           NVARCHAR(20)  NULL      (testo: «2 +n», «3-4»)
welding_process     NVARCHAR(50)  NULL
filler_diameter_mm  DECIMAL(5,2)  NULL
filler_designation / filler_make  NVARCHAR(100) NULL
current_a / voltage_v             DECIMAL(8,2)  NULL  (valore singolo)
current_polarity    NVARCHAR(40)  NULL
wire_feed_speed + wire_feed_unit      DECIMAL(8,2) + NVARCHAR(10) NULL
travel_speed + travel_speed_unit      DECIMAL(8,2) + NVARCHAR(10) NULL
heat_input_value + heat_input_unit    DECIMAL(10,3) + NVARCHAR(10) NULL
metal_transfer      NVARCHAR(40)  NULL
weld_time_ms, protrusion_mm, lift_mm  (stud, ISO 14555 Annex C)
capacitance_mf, charging_voltage_v, gap_lift_mm, spring_force_n  (stud a scarica capacitiva)
remarks NVARCHAR(200), source NVARCHAR(10) ('ai'|'manual'), created_at, updated_at
```

> Indice `IX_wpqr_test_runs_org_wpqr (organization_id, wpqr_id)`. Fonti: ISO 15614-1 Annex B pag. 2, 15614-2 Annex A, 14555 Annex C. Schema e motivazioni: `docs/agent-tasks/PLAN_VERIFICA_WPQR_SLICES.md` § 2.2. La 173 aggiunge anche a `wpqr_records` (tutte NULL): `welding_position_test`, `diameter_test_mm`, `deposited_thickness_mm`, `thickness_t2_test_mm`, `filler_make`, `filler_size`, `backing_gas`, `heat_input_kind`, `heat_input_range_min/max/unit/basis`, `heat_input_tol_minus_pct/plus_pct`, `heat_input_plus_unlimited`, `preheat_temp_test`, `interpass_temp_test`, `post_heating`, `pwht_details`, `range_standard_reference` e (gruppo B) `shielding_gas_flow_l_min_min/max`, `nozzle_diameter_mm`, `contact_tube_distance_mm_min/max`, `tungsten_electrode`, `torch_angle_deg`, `joint_preparation`, `cleaning_method`, `bead_technique`, `electrode_count`, `other_test_info`.

### `wps_wpqr_links`  *(migration 174 — D9 forma A, legame WPS↔WPQR)*

```sql
id               INT IDENTITY  PK
organization_id  INT           NOT NULL  (deve coincidere con WPS e WPQR collegate: lo impone l'applicazione, lo conta 174_verify.sql)
wps_id           INT           NOT NULL  FK → welding_procedures(id) (senza ON DELETE)
wpqr_id          INT           NOT NULL  FK → wpqr_records(id) (senza ON DELETE)
role             NVARCHAR(20)  NULL      ('primary' | 'supporting', solo applicativo)
created_at       DATETIME2     NOT NULL  DEFAULT GETDATE()
created_by       INT           NULL
```

> UNIQUE `(wps_id, wpqr_id)`; indice `(organization_id, wpqr_id)`. Nessun backfill; `wpqr_records.wps_id` resta invariata. Poiché le FK non hanno `ON DELETE`, ogni cancellazione di WPS/WPQR/azienda deve eliminare prima i link (e le passate): vedi `deleteWPS` / `deleteWPQR` / `hardDeleteCompany`.

---

## Vincoli critici (errori frequenti)

| Errore | Causa | Fix |
|---|---|---|
| `CHECK constraint failed on question_type` | Valore minuscolo | Usare `'TEXT'`, `'YES_NO'`, `'MULTIPLE_CHOICE'` (MAIUSCOLO) |
| `CHECK constraint failed on conformity_status` | Valore esteso | Usare `'C'`, `'NC'`, `'OSS'`, `'OM'`, `'NA'`, `'NV'` |
| `Invalid column name 'response_notes'` | Nome colonna vecchio | Usare `notes` |
| `CHECK constraint failed on status` (audit) | Valore maiuscolo | Usare `'draft'`, `'in_progress'`, `'completed'` (minuscolo) |

---

## Migration history

Cartella canonica: [`database/migrations/`](../../database/migrations/) (non `backend/database/migrations/`, cartella morta).
Policy: [`database/migrations/APPROVAL_POLICY.md`](../../database/migrations/APPROVAL_POLICY.md).
Procedura pre-VPS: [`docs/how-to/database-migrations.md`](../how-to/database-migrations.md).

| Voce | Stato (13/10/2026) |
|---|---|
| Ultimo `NNN` su `origin/main` | **172** (`172_ai_assistant_tables_align_prod.sql`) |
| In PR (file, **non applicate** né su TEST né su PROD) | **173** `173_wpqr_test_data.sql` · **174** `174_wps_wpqr_links.sql` (companion `NNN_verify.sql` / `NNN_rollback.sql`, runner `backend/scripts/run-migration-173-vps.js` / `174`) |
| Prossimo libero da riservare | **175** (dopo il merge di 173/174, ricontrollare `origin/main`) |
| Gate intestazione + companion | Obbligatorio da **≥ 169**. Storico grandfathered. |
| Unicità prefisso | L1 `migrationNumberUniqueness.test.js` da 100 in poi (esclusi `NNN_verify.sql` / `NNN_rollback.sql`) |
| Intestazione | L1 `migrationHeaderContract.test.js` |
| CI apply su DB vuoto | Apply **da 169** (vedi sotto). Gap pre-169 = verde, non rosso. |

Prime voci storiche (il file era fermo qui a marzo 2026):

| ID | File | Descrizione |
|---|---|---|
| 003 | align_schema_backend | Fix campi backend (notes, answered_at) — assume schema già presente |
| 006–009 | response_options / audit_standards | Incremental su DB esistente |
| 018 | pending_issues | Tabella rilievi pendenti |

L'elenco completo è la cartella `database/migrations/*.sql`, non questa tabella.

### Apply-on-empty (CI)

Le migrazioni **non** sono uno schema-from-scratch. Lo storico **003–168** è stato scritto su un DB già esistente (la 003 fa `RAISERROR` / errore di sintassi se manca `audit_responses.notes`). Non esiste dump baseline versionato: una baseline completa sarebbe grande e fragile.

**Scelta A (issue [#699](https://github.com/qsstudio241/sistema-gestione-iso9001/issues/699)):** su SQL Server vuoto lo script [`apply-migrations-ci.js`](../../backend/scripts/apply-migrations-ci.js) **salta** le main migration con numero **< 169**, poi applica + seed anonimo (`database/migrations/ci/seed_anonymous.sql`) + `NNN_verify.sql` **da 169 in poi**.

| Situazione | Esito job `Apply da 169 su SQL Server vuoto` |
|---|---|
| Solo file < 169 (stato attuale di `main`) | **Verde** — skip apply, seed e verify (DB vuoto non ha `organizations`) |
| 169+ applicate, `organizations` assente (gap pre-169) | **Verde** — apply 169+, seed **saltato**, verify se PASS (tabelle assenti ok) |
| 169+ applicate, seed e verify PASS | **Verde** |
| Una 169+, il seed (tabelle presenti) o il verify fallisce | **Rosso** — regressione reale (niente `continue-on-error`) |

Le nuove 169+ devono tollerare un DB vuoto: `IF OBJECT_ID` / `IF NOT EXISTS` sulla **tabella** (non solo sulla colonna). Un `ALTER` nudo su tabella assente è rosso e si corregge nella SQL, non con un check «atteso failed».

Il seed è compile-safe: `FROM`/`INSERT` solo dentro `EXEC` (SQL Server altrimenti fallisce con `Invalid object name` anche se l'`IF OBJECT_ID` è falso). Lo script salta il seed se `dbo.organizations` è assente. Nessun dato di produzione.

---

## ER Diagram (sintesi)

```
organizations ──< users
organizations ──< audits
audits ──< audit_responses ──── checklist_questions ──< checklist_sections ──< standards
audits ──< non_conformities
audits ──< attachments
audits ──< audit_history
audits ──< audit_standards >── standards
audits ──< pending_issues
audit_responses ──< attachments (via question_id)
```

---

*Aggiornato: 2026-10-06 — sequenza main 168 + 169 in PR; seed CI compile-safe / skip se organizations assente (#699)*
