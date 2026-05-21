# DATABASE MAPPING - Frontend ↔ Backend ↔ SQL Server

**Data**: 21 dicembre 2025  
**Status**: ❌ **SYNC INCOMPLETO - RISPOSTE CHECKLIST MAI SALVATE**

---

## Schema Database (SQL Server)

### Tabelle Principali

#### 1. `audits` - Metadata Audit

```sql
CREATE TABLE audits (
    audit_id INT IDENTITY(1,1) PRIMARY KEY,
    audit_uuid UNIQUEIDENTIFIER NOT NULL UNIQUE,
    audit_number NVARCHAR(50) NOT NULL,
    client_name NVARCHAR(255) NOT NULL,
    project_year INT NOT NULL,
    audit_date DATE NOT NULL,
    auditor_name NVARCHAR(255) NOT NULL,
    audit_type NVARCHAR(50) NOT NULL,
    status NVARCHAR(50) NOT NULL DEFAULT 'draft',
    total_questions INT NOT NULL DEFAULT 0,
    answered_questions INT NOT NULL DEFAULT 0,
    conformities_count INT NOT NULL DEFAULT 0,
    non_conformities_count INT NOT NULL DEFAULT 0,
    completion_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    organization_id INT NOT NULL,
    created_by INT NOT NULL,
    created_at DATETIME2 NOT NULL,
    updated_at DATETIME2 NOT NULL,
    is_deleted BIT NOT NULL DEFAULT 0
);
```

**Sync Status**: ✅ **FUNZIONANTE**

- Frontend: `syncService.enqueue("create_audit" | "update_audit")`
- Backend: `POST /audits/sync` → `upsertAudit()`
- Payload: audit metadata (NO checklist)

#### 2. `audit_responses` - Risposte Checklist

```sql
CREATE TABLE audit_responses (
    response_id INT IDENTITY(1,1) PRIMARY KEY,
    audit_id INT NOT NULL REFERENCES audits(audit_id),
    question_id INT NOT NULL REFERENCES checklist_questions(question_id),
    conformity_status NVARCHAR(50) NULL, -- 'C', 'NC', 'OSS', 'OM', 'NA'
    response_notes NVARTEXT NULL,
    is_answered BIT NOT NULL DEFAULT 0,
    answered_at DATETIME2 NULL,
    answered_by INT NULL,
    CONSTRAINT uq_audit_question UNIQUE (audit_id, question_id)
);
```

**Sync Status**: ❌ **NON FUNZIONANTE - MAI CHIAMATO**

- Frontend: ❌ Manca chiamata a `POST /audits/:id/responses/bulk`
- Backend: ✅ `bulkSaveResponses()` implementato
- **Problema**: `updateCurrentAudit()` salva solo in IndexedDB, non enqueue sync

#### 3. `checklist_questions` - Domande Master (READ-ONLY)

```sql
CREATE TABLE checklist_questions (
    question_id INT IDENTITY(1,1) PRIMARY KEY,
    question_uuid UNIQUEIDENTIFIER NOT NULL UNIQUE,
    section_id INT NOT NULL,
    question_text NVARTEXT NOT NULL,
    question_order INT NOT NULL,
    standard_id INT NOT NULL, -- 1=ISO 9001, 2=ISO 14001, ecc.
    is_active BIT NOT NULL DEFAULT 1
);
```

**Sync Status**: ➖ **N/A** (pre-popolate via seed, frontend le carica da API)

#### 4. `checklist_sections` - Sezioni ISO (READ-ONLY)

```sql
CREATE TABLE checklist_sections (
    section_id INT IDENTITY(1,1) PRIMARY KEY,
    section_code NVARCHAR(10) NOT NULL UNIQUE,
    section_title NVARCHAR(500) NOT NULL,
    parent_section_code NVARCHAR(10) NULL,
    section_order INT NOT NULL,
    standard_id INT NOT NULL
);
```

**Sync Status**: ➖ **N/A** (pre-popolate via seed)

#### 5. `non_conformities` - NC Rilevate

```sql
CREATE TABLE non_conformities (
    nc_id INT IDENTITY(1,1) PRIMARY KEY,
    nc_uuid UNIQUEIDENTIFIER NOT NULL UNIQUE,
    audit_id INT NOT NULL,
    response_id INT NULL REFERENCES audit_responses(response_id),
    nc_type NVARCHAR(50) NOT NULL, -- 'major', 'minor', 'observation'
    nc_title NVARCHAR(500) NOT NULL,
    nc_description NVARTEXT NOT NULL,
    iso_clause NVARCHAR(50) NOT NULL,
    root_cause NVARTEXT NULL,
    corrective_action NVARTEXT NULL,
    due_date DATE NULL,
    closure_status NVARCHAR(50) NOT NULL DEFAULT 'open',
    created_at DATETIME2 NOT NULL,
    created_by INT NOT NULL
);
```

**Sync Status**: ❌ **NON VERIFICATO**

- Frontend: Componente `NonConformitiesManager.jsx` esiste
- Backend: `nc.controller.js` implementato
- **Necessita verifica**: Se NC salvate in IndexedDB vengono sincronizzate

#### 6. `attachments` - Evidenze (foto/audio/video/documenti)

```sql
CREATE TABLE attachments (
    attachment_id INT IDENTITY(1,1) PRIMARY KEY,
    attachment_uuid UNIQUEIDENTIFIER NOT NULL UNIQUE,
    audit_id INT NULL,
    response_id INT NULL,
    nc_id INT NULL,
    file_name NVARCHAR(500) NOT NULL,
    file_type NVARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_path NVARCHAR(1000) NOT NULL,
    category NVARCHAR(50) NOT NULL, -- 'photo', 'audio', 'video', 'document'
    uploaded_by INT NOT NULL,
    uploaded_at DATETIME2 NOT NULL
);
```

**Sync Status**: ❌ **NON VERIFICATO**

- Frontend: `AttachmentSection.jsx` + `useAttachmentManager.js`
- Backend: `attachment.controller.js` implementato
- **Necessita verifica**: Upload file sync con server

---

## Mapping Frontend ↔ Database

### 1. Audit Metadata (✅ FUNZIONANTE)

**Frontend** (`app/src/data/mockAudits.js`):

```javascript
{
  id: 'audit-001-rp-2025',
  metadata: {
    clientName: 'Raccorderia Piacentina',
    auditNumber: '2025-01',
    status: 'completed',
    projectYear: 2025,
    auditDate: '2025-01-15',
    auditorName: 'Mario Rossi',
    auditType: 'certification',
    totalQuestions: 78,
    answeredQuestions: 78,
    conformitiesCount: 70,
    nonConformitiesCount: 8,
    completionPercentage: 100
  }
}
```

**Backend Payload** (`POST /audits/sync`):

```javascript
{
  audit_uuid: 'audit-001-rp-2025',
  audit_number: '2025-01',
  client_name: 'Raccorderia Piacentina',
  project_year: 2025,
  audit_date: '2025-01-15',
  auditor_name: 'Mario Rossi',
  audit_type: 'certification',
  status: 'completed',
  total_questions: 78,
  answered_questions: 78,
  conformities_count: 70,
  non_conformities_count: 8,
  completion_percentage: 100,
  standard_id: 1, // ISO 9001
  updated_at: '2025-12-21T20:00:00.000Z'
}
```

**SQL Server** (`audits` table):

```sql
INSERT INTO audits (
  audit_uuid, audit_number, client_name, project_year,
  audit_date, auditor_name, audit_type, status,
  total_questions, answered_questions,
  conformities_count, non_conformities_count,
  completion_percentage, standard_id,
  organization_id, created_by, created_at, updated_at
)
VALUES (
  'audit-001-rp-2025', '2025-01', 'Raccorderia Piacentina', 2025,
  '2025-01-15', 'Mario Rossi', 'certification', 'completed',
  78, 78, 70, 8, 100.00, 1,
  @organization_id, @user_id, GETDATE(), GETDATE()
);
```

---

### 2. Checklist Responses (❌ MAI SALVATE)

**Frontend** (`app/src/data/mockAudits.js`):

```javascript
{
  checklist: {
    ISO_9001: {
      clause4_Context: {
        title: "4. Contesto dell'organizzazione",
        questions: [
          {
            id: "q4.1",
            clauseRef: "4.1",
            text: "Contesto organizzativo e parti interessate",
            status: "C",  // ← QUESTO NON VIENE MAI SALVATO IN audit_responses
            notes: "Documentazione completa presente",
            evidenceRef: "DOC-001"
          },
          {
            id: "q4.2",
            clauseRef: "4.2",
            status: "NC",  // ← QUESTO NON VIENE MAI SALVATO
            notes: "Manca analisi rischi aggiornata"
          }
        ]
      }
    }
  }
}
```

**Backend Payload** (❌ **MAI CHIAMATO**):

```javascript
// DOVREBBE ESSERE:
POST / audits / { audit_id } / responses / bulk;
{
  responses: [
    {
      question_id: 1, // ← Mappato da q4.1 → question_id via API lookup
      conformity_status: "C",
      notes: "Documentazione completa presente",
      evidence: "DOC-001",
      client_updated_at: "2025-12-21T20:00:00.000Z",
    },
    {
      question_id: 2,
      conformity_status: "NC",
      notes: "Manca analisi rischi aggiornata",
      evidence: null,
      client_updated_at: "2025-12-21T20:00:00.000Z",
    },
  ];
}
```

**SQL Server** (❌ **TABELLA VUOTA**):

```sql
-- DOVREBBE CONTENERE:
INSERT INTO audit_responses (
  audit_id, question_id, conformity_status,
  response_notes, is_answered, answered_at,
  created_by, created_at, updated_at
)
VALUES
  (1, 1, 'C', 'Documentazione completa presente', 1, GETDATE(), @user_id, GETDATE(), GETDATE()),
  (1, 2, 'NC', 'Manca analisi rischi aggiornata', 1, GETDATE(), @user_id, GETDATE(), GETDATE());
```

---

## Problema Attuale: SYNC MANCANTE

### Flow Attuale (SBAGLIATO)

```
User modifica risposta
    ↓
ChecklistModule.handleQuestionUpdate()
    ↓
updateCurrentAudit(audit => {...})  ← Modifica audit.checklist[norm][clause].questions[]
    ↓
IndexedDBProvider.saveAudit()  ← Salva TUTTO l'audit in IndexedDB
    ↓
syncService.enqueue("update_audit", metadata)  ← SOLO metadata, NO checklist
    ↓
POST /audits/sync  ← Aggiorna SOLO tabella audits
    ↓
❌ audit_responses RESTA VUOTA
```

### Flow Corretto (DA IMPLEMENTARE)

```
User modifica risposta
    ↓
ChecklistModule.handleQuestionUpdate()
    ↓
updateCurrentAudit(audit => {...})
    ↓
IndexedDBProvider.saveAudit()
    ↓
extractModifiedResponses(audit)  ← Estrae SOLO domande modificate
    ↓
syncService.enqueue("save_responses", {auditId, responses})
    ↓
POST /audits/{id}/responses/bulk
    ↓
INSERT/UPDATE audit_responses (78 righe per audit completo)
    ↓
updateAuditStatistics() ← Aggiorna audits.completion_percentage automaticamente
```

---

## Azioni Necessarie

### 1. Implementare Sync Responses ❌ CRITICO

**File da modificare**:

- `app/src/contexts/StorageContext.jsx` → `updateCurrentAudit()`

  - Dopo `saveAudit()`, estrarre risposte modificate
  - Chiamare `syncService.enqueue("save_responses")`

- `app/src/services/syncService.js` → `syncItem()`

  - Aggiungere case `"save_responses"`
  - Chiamare `syncSaveResponses()`

- `app/src/services/syncService.js` → `syncSaveResponses()`
  - Già esiste (line 289): `return await apiService.bulkSaveResponses(auditId, responses);`
  - ✅ Verificare funzionamento

**Payload Mapping**:

```javascript
// Frontend question → Backend response
{
  question_id: await lookupQuestionId(question.clauseRef),  // q4.1 → 1
  conformity_status: question.status,  // 'C', 'NC', 'OSS', 'OM', 'NA'
  notes: question.notes || null,
  evidence: question.evidenceRef || null,
  client_updated_at: new Date().toISOString()
}
```

### 2. Verificare Sync NC ⚠️ IMPORTANTE

**Verificare se** `NonConformitiesManager.jsx` chiama API backend quando:

- Crea nuova NC
- Modifica NC esistente
- Chiude NC

### 3. Verificare Sync Attachments ⚠️ IMPORTANTE

**Verificare se** `useAttachmentManager.js` invia file al server quando:

- Utente carica foto/audio/video
- Utente elimina allegato

---

## Query Verifica Stato Sync

### Verifica Audit Salvati

```sql
SELECT audit_id, audit_number, client_name, status,
       total_questions, answered_questions, completion_percentage,
       created_at, updated_at
FROM audits
WHERE is_deleted = 0
ORDER BY audit_number DESC;
```

**Expected**: 4 righe (1 esistente + 3 da sync recovery)

### Verifica Risposte Checklist

```sql
SELECT ar.response_id, a.audit_number, cq.question_text,
       ar.conformity_status, ar.response_notes, ar.is_answered
FROM audit_responses ar
INNER JOIN audits a ON ar.audit_id = a.audit_id
INNER JOIN checklist_questions cq ON ar.question_id = cq.question_id
WHERE a.is_deleted = 0
ORDER BY a.audit_number, cq.question_order;
```

**Expected**: ~234 righe (3 audit × 78 domande)  
**Actual**: ❌ 0 righe (TABELLA VUOTA)

### Verifica NC

```sql
SELECT nc.nc_id, a.audit_number, nc.nc_type, nc.nc_title, nc.closure_status
FROM non_conformities nc
INNER JOIN audits a ON nc.audit_id = a.audit_id
WHERE a.is_deleted = 0
ORDER BY a.audit_number, nc.created_at;
```

### Verifica Attachments

```sql
SELECT att.attachment_id, a.audit_number, att.category,
       att.file_name, att.file_size_bytes, att.uploaded_at
FROM attachments att
LEFT JOIN audits a ON att.audit_id = a.audit_id
WHERE att.is_deleted = 0
ORDER BY att.uploaded_at DESC;
```

---

## Conclusioni

### Status Attuale

| Tabella               | Sync Status | Note                                 |
| --------------------- | ----------- | ------------------------------------ |
| `audits`              | ✅ OK       | Metadata sincronizzati dopo recovery |
| `audit_responses`     | ❌ VUOTA    | **CRITICO**: risposte mai salvate    |
| `non_conformities`    | ⚠️ ?        | Da verificare con test               |
| `attachments`         | ⚠️ ?        | Da verificare con test               |
| `checklist_questions` | ➖ N/A      | Pre-popolate, read-only              |
| `checklist_sections`  | ➖ N/A      | Pre-popolate, read-only              |

### Impatto Utente

**Sintomo visibile**:

- ✅ Dropdown audit mostra 3 audit (metadata OK)
- ✅ Apertura audit mostra checklist compilata (da IndexedDB)
- ❌ Ricarica browser su altro dispositivo → checklist VUOTA (dati solo locale)
- ❌ Report PDF da backend → 0 risposte (audit_responses vuota)
- ❌ Statistiche completion_percentage → sempre 0% (no risposte nel DB)

### Priorità Fix

1. **P0 - CRITICO**: Implementare sync audit_responses
2. **P1 - ALTO**: Verificare sync non_conformities
3. **P1 - ALTO**: Verificare sync attachments
4. **P2 - MEDIO**: Test E2E completo con tutti i tipi di dati

---

**Ultima modifica**: 21 dicembre 2025, 20:45  
**Autore**: GitHub Copilot (Claude Sonnet 4.5)  
**Status**: DOCUMENTAZIONE ROOT CAUSE COMPLETATA
