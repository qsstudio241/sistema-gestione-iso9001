# 📊 DATABASE SCHEMA - SGQ_ISO9001

**⚠️ LEGGERE SEMPRE ALL'INIZIO DI OGNI SESSIONE DI SVILUPPO**

---

## 🎯 QUICK REFERENCE: VALORI ENUM/CHECK

### `conformity_status` (audit_responses)

```sql
CHECK (conformity_status IN ('C', 'NC', 'OSS', 'OM', 'NA', 'NV', NULL))
```

- **C** = Conforme
- **NC** = Non Conforme
- **OSS** = Osservazione
- **OM** = Opportunità Miglioramento
- **NA** = Non Applicabile
- **NV** = Non Verificato

### `question_type` (checklist_questions)

```sql
CHECK (question_type IN ('text', 'yes_no', 'conformity', 'numeric'))
```

⚠️ **MINUSCOLO OBBLIGATORIO!**

- `'text'` = Risposta testuale libera
- `'yes_no'` = Sì/No
- `'conformity'` = Conformità (C/NC/OSS/OM/NA/NV)
- `'numeric'` = Valore numerico

### `audit_status` (audits)

```sql
CHECK (status IN ('draft', 'in_progress', 'completed', 'approved'))
```

⚠️ **MINUSCOLO!**

### `user_role` (users)

```sql
CHECK (role IN ('admin', 'auditor', 'viewer'))
```

⚠️ **MINUSCOLO!**

---

## 📋 TABELLE PRINCIPALI

### 🏢 **organizations**

Gestisce multi-tenancy

| Colonna           | Tipo          | Nullable | Note              |
| ----------------- | ------------- | -------- | ----------------- |
| organization_id   | INT IDENTITY  | NO       | PK                |
| organization_name | NVARCHAR(255) | NO       | Unique            |
| created_at        | DATETIME2     | NO       | Default GETDATE() |
| is_active         | BIT           | NO       | Default 1         |

---

### 👤 **users**

Utenti sistema (con multi-tenancy)

| Colonna         | Tipo          | Nullable | Constraint                           |
| --------------- | ------------- | -------- | ------------------------------------ |
| user_id         | INT IDENTITY  | NO       | PK                                   |
| organization_id | INT           | NO       | FK → organizations                   |
| email           | NVARCHAR(255) | NO       | Unique                               |
| password_hash   | NVARCHAR(255) | NO       |                                      |
| full_name       | NVARCHAR(255) | NO       |                                      |
| role            | NVARCHAR(20)  | NO       | CHECK ('ADMIN', 'AUDITOR', 'VIEWER') |
| is_active       | BIT           | NO       | Default 1                            |
| created_at      | DATETIME2     | NO       |                                      |

---

### 📜 **standards**

Normative (ISO 9001, 14001, 45001...)

| Colonna       | Tipo          | Nullable | Note                    |
| ------------- | ------------- | -------- | ----------------------- |
| standard_id   | INT IDENTITY  | NO       | PK                      |
| standard_code | NVARCHAR(50)  | NO       | Unique (es: 'ISO_9001') |
| standard_name | NVARCHAR(255) | NO       |                         |
| version       | NVARCHAR(20)  | NO       | Es: '2015'              |
| is_active     | BIT           | NO       | Default 1               |

**Dati esistenti:**

- ID 1: ISO 9001:2015
- ID 2: ISO 14001:2015
- ID 3: ISO 45001:2018

---

### 📋 **checklist_sections**

Sezioni checklist (clausole ISO)

| Colonna       | Tipo          | Nullable | Note               |
| ------------- | ------------- | -------- | ------------------ |
| section_code  | NVARCHAR(50)  | NO       | PK (es: 'clause4') |
| section_title | NVARCHAR(255) | NO       |                    |
| standard_id   | INT           | NO       | FK → standards     |
| display_order | INT           | NO       |                    |

**Convenzione naming:**

- `clause4` = Clausola 4 (Contesto)
- `clause5` = Clausola 5 (Leadership)
- `clause6` = Clausola 6 (Pianificazione)
- `clause7` = Clausola 7 (Supporto)
- `clause8` = Clausola 8 (Attività Operative)
- `clause9` = Clausola 9 (Valutazione Prestazioni)
- `clause10` = Clausola 10 (Miglioramento)

---

### ❓ **checklist_questions**

Domande checklist

| Colonna       | Tipo          | Nullable | Constraint                                                   |
| ------------- | ------------- | -------- | ------------------------------------------------------------ |
| question_id   | INT IDENTITY  | NO       | PK                                                           |
| standard_id   | INT           | NO       | FK → standards                                               |
| section_code  | NVARCHAR(50)  | NO       | FK → checklist_sections                                      |
| question_text | NVARCHAR(MAX) | NO       |                                                              |
| question_type | NVARCHAR(20)  | NO       | **CHECK ('TEXT', 'YES_NO', 'MULTIPLE_CHOICE')** ⚠️ MAIUSCOLO |
| is_mandatory  | BIT           | NO       | Default 1                                                    |
| display_order | INT           | NO       |                                                              |
| is_active     | BIT           | NO       | Default 1                                                    |
| created_at    | DATETIME2     | NO       |                                                              |
| updated_at    | DATETIME2     | NO       |                                                              |

⚠️ **ATTENZIONE:**

- `question_type` DEVE essere MAIUSCOLO: `'TEXT'`, NON `'text'`
- Valori: `'TEXT'`, `'YES_NO'`, `'MULTIPLE_CHOICE'`

**Count domande ISO 9001:2015:**

- ✅ **35 domande** (da checklist cliente - ChekList9001.txt)

---

### 🎯 **response_options**

Master opzioni risposta (C, NC, OSS, OM, NA, NV)

| Colonna           | Tipo          | Nullable | Note                            |
| ----------------- | ------------- | -------- | ------------------------------- |
| option_id         | INT IDENTITY  | NO       | PK                              |
| option_code       | NVARCHAR(10)  | NO       | Unique                          |
| option_name_it    | NVARCHAR(100) | NO       |                                 |
| option_name_en    | NVARCHAR(100) | NO       |                                 |
| severity_level    | INT           | NO       | 0=NA/NV, 1=C, 2=OSS/OM, 3=NC    |
| weight_percentage | DECIMAL(5,2)  | YES      | C=100, OSS=50, NC=0, NA/NV=NULL |
| exclude_from_calc | BIT           | NO       | 1 per NA/NV                     |
| display_order     | INT           | NO       |                                 |
| color_hex         | NVARCHAR(7)   | YES      | Es: '#28a745'                   |

**Seed dati (6 opzioni):**
| Code | Nome IT | Peso % | Escludi Calc |
|------|---------|--------|--------------|
| C | Conforme | 100.00 | 0 |
| OSS | Osservazione | 50.00 | 0 |
| NC | Non Conforme | 0.00 | 0 |
| OM | Opportunità Miglioramento | 75.00 | 0 |
| NA | Non Applicabile | NULL | 1 |
| NV | Non Verificato | NULL | 1 |

---

### 🔍 **audits**

Audit (multi-standard)

| Colonna         | Tipo         | Nullable | Constraint                                              |
| --------------- | ------------ | -------- | ------------------------------------------------------- |
| audit_id        | INT IDENTITY | NO       | PK                                                      |
| organization_id | INT          | NO       | FK → organizations                                      |
| audit_number    | NVARCHAR(50) | NO       | Unique                                                  |
| audit_date      | DATE         | NO       |                                                         |
| lead_auditor_id | INT          | YES      | FK → users                                              |
| status          | NVARCHAR(20) | NO       | CHECK ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') |
| created_at      | DATETIME2    | NO       |                                                         |
| updated_at      | DATETIME2    | NO       |                                                         |

---

### 📝 **audit_responses**

Risposte checklist

| Colonna           | Tipo          | Nullable | Constraint                                           |
| ----------------- | ------------- | -------- | ---------------------------------------------------- |
| response_id       | INT IDENTITY  | NO       | PK                                                   |
| audit_id          | INT           | NO       | FK → audits                                          |
| question_id       | INT           | NO       | FK → checklist_questions                             |
| answer_value      | NVARCHAR(MAX) | YES      |                                                      |
| conformity_status | NVARCHAR(10)  | YES      | **CHECK ('C', 'NC', 'OSS', 'OM', 'NA', 'NV', NULL)** |
| notes             | NVARCHAR(MAX) | YES      | ⚠️ Backend usa "notes", non "response_notes"         |
| is_answered       | BIT           | NO       | Default 0                                            |
| answered_at       | DATETIME2     | YES      | Timestamp risposta                                   |
| created_by        | INT           | YES      | FK → users                                           |
| created_at        | DATETIME2     | NO       |                                                      |
| updated_at        | DATETIME2     | NO       |                                                      |

⚠️ **ATTENZIONE:**

- Colonna si chiama `notes`, NON `response_notes`
- `conformity_status` valori MAIUSCOLI: 'C', 'NC', etc.

---

### 🔗 **audit_standards**

Join table per multi-standard audit

| Colonna     | Tipo                    | Nullable | Note           |
| ----------- | ----------------------- | -------- | -------------- |
| audit_id    | INT                     | NO       | FK → audits    |
| standard_id | INT                     | NO       | FK → standards |
| PRIMARY KEY | (audit_id, standard_id) |          | Composite      |

---

### � **attachments**

Evidenze (foto/audio/video/documenti) collegate ad audit o NC

| Colonna         | Tipo          | Nullable | Constraint                                   |
| --------------- | ------------- | -------- | -------------------------------------------- |
| attachment_id   | INT IDENTITY  | NO       | PK                                           |
| audit_id        | INT           | YES      | FK → audits (NULL se attachment legato a NC) |
| nc_id           | INT           | YES      | FK → non_conformities                        |
| file_name       | NVARCHAR(500) | NO       |                                              |
| file_type       | NVARCHAR(100) | NO       | MIME type (es: 'image/jpeg')                 |
| file_size_bytes | BIGINT        | NO       |                                              |
| storage_path    | NVARCHAR(MAX) | NO       | Path relativo uploads/                       |
| uploaded_by     | INT           | NO       | FK → users                                   |
| uploaded_at     | DATETIME2     | NO       | Default GETDATE()                            |
| created_at      | DATETIME2     | NO       |                                              |

⚠️ **VINCOLO LOGICO**: audit_id OR nc_id deve essere NOT NULL (almeno una FK popolata)

**Categorie file supportate:**

- Photo: `.jpg`, `.jpeg`, `.png`, `.heic`
- Audio: `.mp3`, `.m4a`, `.wav`
- Video: `.mp4`, `.mov`
- Document: `.pdf`, `.docx`, `.xlsx`

---

### 📜 **audit_history**

Storico modifiche audit (ISO 9001:2015 punto 7.5.3 - Tracciabilità)

| Colonna       | Tipo          | Nullable | Constraint         |
| ------------- | ------------- | -------- | ------------------ |
| history_id    | INT IDENTITY  | NO       | PK                 |
| audit_id      | INT           | NO       | FK → audits        |
| changed_by    | INT           | NO       | FK → users         |
| change_type   | NVARCHAR(50)  | NO       | 'created', 'updated', 'status_changed', 'deleted' |
| field_changed | NVARCHAR(100) | YES      | Nome campo modificato (es: 'status') |
| old_value     | NVARCHAR(MAX) | YES      | Valore precedente (JSON se complesso) |
| new_value     | NVARCHAR(MAX) | YES      | Nuovo valore |
| changed_at    | DATETIME2     | NO       | Default GETDATE()  |

**Utilizzo:**

- Log automatico ad ogni UPDATE su `audits`
- Traccia transizioni stato: draft → in_progress → completed
- Permette audit trail per conformità ISO 9001

---

### 🏛️ **Fase 1 — Tabelle Multi-Tenant (Migration 020)**

#### auditor_orgs

Studi di consulenza (nostri clienti), sotto l'organizzazione QS Studio.

| Colonna          | Tipo          | Nullable | Note                    |
| ---------------- | ------------- | -------- | ----------------------- |
| id               | INT IDENTITY  | NO       | PK                      |
| organization_id  | INT           | NO       | FK → organizations      |
| name             | NVARCHAR(255) | NO       |                         |
| email            | NVARCHAR(255) | YES      |                         |
| subscription_plan| NVARCHAR(50) | YES      |                         |
| is_active        | BIT           | NO       | Default 1               |
| created_at       | DATETIME2     | NO       |                         |
| updated_at       | DATETIME2     | NO       |                         |

#### companies

Aziende auditate (clienti degli auditor).

| Colonna        | Tipo          | Nullable | Note               |
| -------------- | ------------- | -------- | ------------------ |
| id             | INT IDENTITY  | NO       | PK                 |
| auditor_org_id | INT           | NO       | FK → auditor_orgs  |
| name           | NVARCHAR(255) | NO       |                    |
| vat_number     | NVARCHAR(50)  | YES      |                    |
| sector         | NVARCHAR(255) | YES      |                    |
| address        | NVARCHAR(MAX) | YES      |                    |
| is_active      | BIT           | NO       | Default 1          |
| created_at     | DATETIME2     | NO       |                    |
| updated_at     | DATETIME2     | NO       |                    |

#### user_org_roles

Ruoli per utente per organizzazione (RBAC).

| Colonna    | Tipo         | Nullable | Constraint                              |
| ---------- | ------------ | -------- | --------------------------------------- |
| user_id    | INT           | NO       | FK → users, PK (composite)              |
| org_id     | INT           | NO       | FK → organizations, PK (composite)      |
| role       | NVARCHAR(30)  | NO       | CHECK ('superadmin','admin','auditor','viewer') |
| created_at | DATETIME2     | NO       |                                         |

#### subscriptions

Abbonamenti per standard per auditor_org.

| Colonna        | Tipo         | Nullable | Note              |
| -------------- | ------------ | -------- | ----------------- |
| id             | INT IDENTITY | NO       | PK                |
| auditor_org_id | INT          | NO       | FK → auditor_orgs |
| standard_id    | INT          | NO       | FK → standards    |
| plan           | NVARCHAR(50) | YES      | (keyword SQL: usare [plan]) |
| valid_from     | DATE         | NO       |                   |
| valid_to       | DATE         | NO       |                   |
| is_active      | BIT          | NO       | Default 1         |
| created_at     | DATETIME2    | NO       |                   |
| updated_at     | DATETIME2    | NO       |                   |

**Modifiche tabelle esistenti (Migration 020):**

- `users.auditor_org_id` INT NULL, FK → auditor_orgs
- `audits.company_id` INT NULL, FK → companies (client_name resta per retrocompatibilità)

---

### 🚫 **non_conformities**

Non conformità rilevate durante audit

| Colonna      | Tipo          | Nullable | Constraint                                    |
| ------------ | ------------- | -------- | --------------------------------------------- |
| nc_id        | INT IDENTITY  | NO       | PK                                            |
| audit_id     | INT           | NO       | FK → audits                                   |
| standard_id  | INT           | NO       | FK → standards                                |
| section_code | NVARCHAR(50)  | NO       | FK composite → checklist_sections             |
| nc_number    | NVARCHAR(50)  | NO       | Progressivo (es: 'NC-001')                    |
| nc_type      | NVARCHAR(20)  | NO       | CHECK ('major', 'minor', 'observation')       |
| description  | NVARCHAR(MAX) | NO       |                                               |
| severity     | INT           | NO       | 1=Low, 2=Medium, 3=High                       |
| status       | NVARCHAR(20)  | NO       | CHECK ('open', 'in_progress', 'closed')       |
| created_at   | DATETIME2     | NO       |                                               |
| updated_at   | DATETIME2     | NO       |                                               |

⚠️ **FK COMPOSITE**: (section_code + standard_id) → checklist_sections

---

### �🔄 **sync_metadata**

Metadati sincronizzazione offline

| Colonna             | Tipo         | Nullable | Note              |
| ------------------- | ------------ | -------- | ----------------- |
| sync_id             | INT IDENTITY | NO       | PK                |
| audit_id            | INT          | NO       | FK → audits       |
| user_id             | INT          | YES      | Chi ha fatto sync |
| last_sync_timestamp | DATETIME2    | NO       |                   |
| server_version      | INT          | NO       |                   |
| client_version      | INT          | YES      |                   |
| conflict_count      | INT          | NO       | Default 0         |
| created_at          | DATETIME2    | NO       |                   |

## 🔧 MIGRATION HISTORY

| ID   | File                       | Descrizione                                    | Data       |
| ---- | -------------------------- | ---------------------------------------------- | ---------- |
| 003  | align_schema_backend       | Fix campi backend (notes, answered_at)         | 2026-01-04 |
| 006  | create_response_options    | Tabella opzioni risposta (deprecated)          | -          |
| 007  | fix_conformity_status      | Fix constraint status                          | -          |
| 008  | create_response_options    | Nuova versione con UI columns                  | 2026-01-11 |
| 008b | alter_response_options     | Aggiunti campi UI (icon, color)                | -          |
| 009  | create_audit_standards     | Multi-standard support per audit               | 2026-01-17 |
| 010  | update_iso9001_35questions | Riduce da 78 a 35 domande | 2026-01-17 |
| 020  | fase1_multi_tenant_foundations | **Fase 1** auditor_orgs, companies, user_org_roles, subscriptions | 2026-03-04 |

---

## 🗺️ ENTITY RELATIONSHIP DIAGRAM

```mermaid
erDiagram
    organizations ||--o{ users : "ha"
    organizations ||--o{ audits : "appartiene"
    
    users ||--o{ audits : "crea"
    users ||--o{ attachments : "carica"
    users ||--o{ audit_history : "modifica"
    users ||--o{ sync_metadata : "esegue_sync"
    
    standards ||--o{ checklist_sections : "contiene"
    standards ||--o{ checklist_questions : "definisce"
    standards ||--o{ audit_standards : "applicato_a"
    standards ||--o{ non_conformities : "riferimento"
    
    checklist_sections ||--o{ checklist_questions : "contiene"
    checklist_sections ||--o{ non_conformities : "riferimento"
    
    checklist_questions ||--o{ audit_responses : "risposta"
    
    audits ||--o{ audit_responses : "contiene"
    audits ||--o{ non_conformities : "rileva"
    audits ||--o{ attachments : "evidenza"
    audits ||--o{ audit_history : "storico"
    audits ||--o{ audit_standards : "usa"
    
    non_conformities ||--o{ attachments : "evidenza_nc"
    
    organizations {
        int organization_id PK
        nvarchar organization_name UK
        bit is_active
    }
    
    users {
        int user_id PK
        int organization_id FK
        nvarchar email UK
        nvarchar full_name
        nvarchar role
        bit is_active
    }
    
    standards {
        int standard_id PK
        nvarchar standard_code UK
        nvarchar standard_name
        nvarchar version
        bit is_active
    }
    
    checklist_sections {
        nvarchar section_code PK
        int standard_id FK
        nvarchar section_title
        int display_order
    }
    
    checklist_questions {
        int question_id PK
        int standard_id FK
        nvarchar section_code FK
        nvarchar question_text
        nvarchar question_type
        bit is_active
    }
    
    audits {
        int audit_id PK
        int organization_id FK
        int created_by FK
        nvarchar audit_number UK
        date audit_date
        nvarchar status
    }
    
    audit_responses {
        int response_id PK
        int audit_id FK
        int question_id FK
        nvarchar conformity_status
        nvarchar notes
        bit is_answered
    }
    
    non_conformities {
        int nc_id PK
        int audit_id FK
        int standard_id FK
        nvarchar section_code FK
        nvarchar nc_number
        nvarchar nc_type
        nvarchar status
    }
    
    attachments {
        int attachment_id PK
        int audit_id FK_nullable
        int nc_id FK_nullable
        int uploaded_by FK
        nvarchar file_name
        nvarchar file_type
        bigint file_size_bytes
    }
    
    audit_history {
        int history_id PK
        int audit_id FK
        int changed_by FK
        nvarchar change_type
        nvarchar field_changed
        datetime2 changed_at
    }
    
    audit_standards {
        int audit_id PK_FK
        int standard_id PK_FK
    }
    
    sync_metadata {
        int sync_id PK
        nvarchar entity_type
        int entity_id
        uniqueidentifier entity_uuid
        int user_id FK_nullable
        datetime2 last_sync_at
        int sync_version
        nvarchar sync_status
    }
```

**NOTA IMPORTANTE - sync_metadata:**  
La tabella `sync_metadata` **non ha FK diretta** ad `audits`, `audit_responses`, `non_conformities`.  
Usa design generico: `entity_type` ('audit', 'response', 'nc') + `entity_id`.  
Per eliminare sync records di un audit: `WHERE entity_type='audit' AND entity_id IN (SELECT audit_id...)`

---

## ⚡ QUICK FIXES COMMON ERRORS

### Errore: `CHECK constraint failed on question_type`

```sql
-- ❌ SBAGLIATO:
INSERT INTO checklist_questions (..., question_type, ...)
VALUES (..., 'yes_no_na', ...);

-- ✅ CORRETTO:
INSERT INTO checklist_questions (..., question_type, ...)
VALUES (..., 'YES_NO', ...);
```

### Errore: `CHECK constraint failed on conformity_status`

```sql
-- ❌ SBAGLIATO:
UPDATE audit_responses SET conformity_status = 'conforme';

-- ✅ CORRETTO:
UPDATE audit_responses SET conformity_status = 'C';
```

### Errore: `Invalid column name 'response_notes'`

```sql
-- ❌ SBAGLIATO (backend vecchio):
SELECT response_notes FROM audit_responses;

-- ✅ CORRETTO:
SELECT notes FROM audit_responses;
```

---

## 📞 CONTATTI & RIFERIMENTI

- **Database**: SQL Server Express 2022, localhost
- **User SQL**: definito in configurazione sicura (vault / `database.json` locale, non in repository)
- **Database Name**: SGQ_ISO9001
- **Port**: 1433

**ADR Correlati:**

- ADR-001: Multi-Agent Workflow
- ADR-002: Project Structure & Offline-First

---

**Ultimo aggiornamento:** 2026-02-08  
**Versione schema:** v1.11 (Aggiunte audit_history + attachments complete)
