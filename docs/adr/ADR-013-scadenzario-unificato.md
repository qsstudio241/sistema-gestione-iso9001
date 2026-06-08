# ADR-013 — Scadenzario Unificato con Assegnazione Task e Alert Email

> **Stato**: Proposto  
> **Data**: 2026-06-08  
> **Autore**: AI Agent (proposta tecnica per validazione committente)  
> **Prerequisiti**: migrazioni 029-032, 051, 074, 077-080 (document_registry, qualifications, notifications_config, escalation)  
> **Correlati**: ADR-011 (registry norm SoT), Sprint B (Alert Engine), Sprint 2 (Qualifiche)

---

## 1. Contesto e Domanda del Committente

> "Sei in grado di determinare se un file del DB e' uno scadenzario? Se si, e' possibile portare l'oggetto in scadenza nella griglia delle priorita' con un link al file a cui si fa riferimento? Una tabella appositamente dedicata potrebbe permettere di assegnare il task ad un utente specifico che riceve anche gli alert via email."

### Cosa esiste gia'

| Entita' con scadenza | Tabella | Campo | Alert email | UI |
|---------------------|---------|-------|-------------|-----|
| Documenti SGQ | `document_registry` | `expiry_date` | Escalation attiva (cron VPS) | Tab Priorita' + Home |
| Qualifiche personale | `qualifications` | `expiry_date` | Solo conteggio badge (no email scheduler) | Pagina Qualifiche con semaforo |
| Azioni correttive NC | `nc_actions` | `due_date` | Escalation NC attiva | Drawer NC |
| Norme/leggi | `document_registry` (tipo `norma`) | `type_specific_data.validity_status` | Job settimanale (vigore normativo) | Registro Norme |
| Contratti | `contract_reviews` | `expiry_date` / fasi | No | Pagina Commesse |

**Gap**: non esiste una **vista unificata** ("scadenzario") che aggreghi tutte le scadenze in un unico punto operativo con assegnazione responsabile, deep-link alla fonte e alert personalizzato.

---

## 2. Proposta Architetturale — Scadenzario come Vista Materializzata + Tabella Task

### Principio guida

**Non duplicare i dati di scadenza** — le date restano nelle tabelle sorgente (`document_registry`, `qualifications`, `nc_actions`, `contract_reviews`). Lo scadenzario e' una **vista operativa** che aggrega e arricchisce con assegnazione e tracking.

### Due componenti

```
COMPONENTE A — Vista aggregata (query-time, read-only)
  SELECT unificata su tutte le entita' con scadenza
  Alimenta: Home dashboard, pagina Scadenzario, export Excel

COMPONENTE B — Tabella task assegnabili (write, opzionale)
  deadline_tasks: assegnazione utente, stato, note, notifica dedicata
  Creati manualmente O automaticamente da regole configurabili
```

---

## 3. Schema DB Proposto

### 3.1 Tabella `deadline_tasks` (Componente B)

```sql
CREATE TABLE deadline_tasks (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  organization_id INT NOT NULL,
  company_id      INT NULL,

  -- Sorgente (polimorfismo)
  source_type     NVARCHAR(30) NOT NULL,
    -- 'document' | 'qualification' | 'nc_action' | 'contract' | 'manual'
  source_id       INT NULL,
    -- FK al record sorgente (NULL se source_type = 'manual')

  -- Contenuto
  title           NVARCHAR(500) NOT NULL,
  description     NVARCHAR(MAX) NULL,
  due_date        DATE NOT NULL,
  priority        NVARCHAR(10) NOT NULL DEFAULT 'normal',
    -- 'critical' | 'high' | 'normal' | 'low'

  -- Assegnazione
  assigned_to     INT NULL,          -- FK users.id
  assigned_email  NVARCHAR(255) NULL, -- email esplicita (se utente esterno)

  -- Stato
  status          NVARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue'
  completed_at    DATETIME NULL,
  completed_by    INT NULL,

  -- Alert
  alert_enabled   BIT NOT NULL DEFAULT 1,
  alert_days      NVARCHAR(100) NULL,
    -- JSON array soglie custom es. "[30,14,7,3,1]" — NULL = usa default org

  -- Metadati
  created_by      INT NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT GETDATE(),
  updated_at      DATETIME NOT NULL DEFAULT GETDATE(),

  -- Vincoli
  CONSTRAINT CK_deadline_tasks_source
    CHECK (source_type IN ('document','qualification','nc_action','contract','manual')),
  CONSTRAINT CK_deadline_tasks_priority
    CHECK (priority IN ('critical','high','normal','low')),
  CONSTRAINT CK_deadline_tasks_status
    CHECK (status IN ('pending','in_progress','completed','cancelled','overdue'))
);

CREATE INDEX IX_deadline_tasks_org_due
  ON deadline_tasks (organization_id, due_date)
  WHERE status NOT IN ('completed','cancelled');

CREATE INDEX IX_deadline_tasks_assigned
  ON deadline_tasks (assigned_to, due_date)
  WHERE status NOT IN ('completed','cancelled');

CREATE INDEX IX_deadline_tasks_source
  ON deadline_tasks (source_type, source_id);
```

### 3.2 Tabella `deadline_task_log` (anti-duplicati notifiche)

```sql
CREATE TABLE deadline_task_log (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  task_id         INT NOT NULL,       -- FK deadline_tasks.id
  recipient_email NVARCHAR(255) NOT NULL,
  alert_date      DATE NOT NULL,
  threshold_days  INT NOT NULL,       -- -1 = post-scadenza giornaliero
  sent_at         DATETIME NOT NULL DEFAULT GETDATE(),

  CONSTRAINT UQ_deadline_task_log
    UNIQUE (task_id, recipient_email, alert_date, threshold_days)
);
```

### 3.3 Vista `v_scadenzario_unificato` (Componente A — query aggregata)

```sql
CREATE OR ALTER VIEW v_scadenzario_unificato AS

-- Documenti con scadenza
SELECT
  'document' AS source_type,
  dr.id AS source_id,
  dr.organization_id,
  dr.company_id,
  dr.title,
  dr.doc_type AS category,
  dr.expiry_date AS due_date,
  dr.responsible AS responsible_name,
  dr.status AS source_status,
  '/documents/' + CAST(dr.id AS NVARCHAR) AS deep_link
FROM document_registry dr
WHERE dr.expiry_date IS NOT NULL
  AND dr.status NOT IN ('obsoleto')

UNION ALL

-- Qualifiche personale
SELECT
  'qualification',
  q.id,
  q.organization_id,
  q.company_id,
  q.person_name + ' - ' + ISNULL(q.qualification_type,'') AS title,
  q.qualification_type,
  q.expiry_date,
  q.person_name,
  q.status,
  '/qualifications?highlight=' + CAST(q.id AS NVARCHAR)
FROM qualifications q
WHERE q.expiry_date IS NOT NULL
  AND q.status NOT IN ('revocata')

UNION ALL

-- Azioni correttive con scadenza
SELECT
  'nc_action',
  a.id,
  nc.organization_id,
  nc.company_id,
  'Azione: ' + ISNULL(LEFT(a.description, 100),'') AS title,
  'azione_correttiva',
  a.due_date,
  a.responsible,
  a.status,
  '/non-conformities/' + CAST(nc.id AS NVARCHAR)
FROM nc_actions a
  JOIN non_conformities nc ON a.nc_id = nc.id
WHERE a.due_date IS NOT NULL
  AND a.status NOT IN ('chiusa','verificata')

UNION ALL

-- Contratti (se hanno scadenza)
SELECT
  'contract',
  cr.id,
  cr.organization_id,
  cr.company_id,
  cr.title,
  'contratto',
  cr.expiry_date,
  NULL,
  cr.status,
  '/contract-reviews/' + CAST(cr.id AS NVARCHAR)
FROM contract_reviews cr
WHERE cr.expiry_date IS NOT NULL
  AND cr.status NOT IN ('completato','annullato');
```

---

## 4. Logica di Rilevamento "File Scadenzario"

### Risposta alla domanda: "Si puo' determinare se un file del DB e' uno scadenzario?"

**Si'**, con due criteri complementari:

| Criterio | Come si rileva | Azione |
|----------|---------------|--------|
| **Per tipo documento** | `document_registry.doc_type` in (`procedura`, `istruzione`, `modulo`, `patentino_saldatore`, `cert_taratura`, `qualifica`, `contratto`, `polizza`, `certificazione`) | Scadenza implicita dal tipo — se `expiry_date` valorizzata |
| **Per configurazione** | `doc_type_config.default_expiry_months > 0` per quel tipo nella org | Il tipo ha un ciclo di vita con rinnovo periodico |
| **Per cartella archivio** | Documenti nella cartella "99 SCADENZARIO" dell'albero | Archiviazione legacy — non operativa ma indicativa |

**Regola proposta**: un documento e' "da scadenzario" se:
1. Ha `expiry_date` valorizzata, OPPURE
2. Il suo `doc_type` ha `default_expiry_months > 0` nella org (anche se `expiry_date` e' ancora NULL — significa che la scadenza deve ancora essere calcolata)

Entrambi i casi lo rendono eleggibile per la **vista unificata** e la **creazione automatica di task**.

---

## 5. Flusso Operativo Proposto

```
Documento rilasciato con expiry_date
         |
         v
[Job cron] Controlla nuove scadenze senza task associato
         |
         v
Crea deadline_task automatico (o manuale da UI)
         |
    +----+----+
    |         |
    v         v
UI Griglia   Alert email
Priorita'    (soglie escalation)
    |
    v
Click -> deep-link al documento/qualifica/NC
```

### 5.1 Creazione automatica task da scadenza

Il job cron (estensione di `alertScheduler.js`) controlla periodicamente:
- Nuovi documenti con `expiry_date` senza `deadline_tasks` associato
- Nuove qualifiche con `expiry_date` senza task
- Nuove azioni NC con `due_date` senza task

**Regola**: creazione automatica **solo** se `notifications_config.auto_create_deadline_tasks = 1` (opt-in per org). L'utente puo' sempre creare task manuali.

### 5.2 Assegnazione utente e notifica

| Evento | Notifica |
|--------|----------|
| Task creato e assegnato | Email "Nuova scadenza assegnata" con link diretto |
| Soglia raggiunta (es. 30/14/7/3/1 giorni) | Email reminder con dettaglio e link |
| Task scaduto non completato | Email urgente + promemoria giornaliero |
| Task completato | (opzionale) conferma al creatore |

---

## 6. UI — Pagina Scadenzario (`/deadlines`)

### Layout proposto

```
+------------------------------------------------------------------+
| SCADENZARIO                                    [+ Nuovo Task]     |
+------------------------------------------------------------------+
| Filtri: [Tipo ▼] [Stato ▼] [Assegnato a ▼] [Azienda ▼] [🔍]   |
+------------------------------------------------------------------+
| SCADUTI (3)                                              rosso    |
|  ⚠ Cert. taratura torsiometro | Mason | 15/05/2026 | → link     |
|  ⚠ Patentino Rossi ISO 9606   | -     | 01/06/2026 | → link     |
|  ⚠ Azione NC-041 verifica     | Bianchi | 03/06/2026 | → link   |
+------------------------------------------------------------------+
| IN SCADENZA 7 GIORNI (2)                             arancione    |
|  ● Procedura PG-012 rev.3     | Camellini | 15/06/2026 | → link |
|  ● Polizza RC professionale   | Admin   | 14/06/2026 | → link   |
+------------------------------------------------------------------+
| IN SCADENZA 30 GIORNI (5)                              giallo    |
|  ...                                                              |
+------------------------------------------------------------------+
| COMPLETATI RECENTI (opzionale, collassato)                        |
+------------------------------------------------------------------+
```

### Deep-link alla fonte

Ogni riga ha un pulsante/icona che naviga alla pagina sorgente:
- Documento → `/documents/123` (dettaglio registro)
- Qualifica → `/qualifications?highlight=45`
- Azione NC → `/non-conformities/67` (drawer NC con tab azioni)
- Contratto → `/contract-reviews/89`

### Assegnazione inline

Click su colonna "Assegnato a" → dropdown utenti org (stessi del campo `responsible` esistente + rubrica `notification_contacts`).

---

## 7. Requisiti Normativi e Best Practice

### ISO 9001:2015

| Clausola | Requisito | Come lo soddisfa lo scadenzario |
|----------|-----------|----------------------------------|
| **7.5.3** | Controllo informazioni documentate — conservazione, protezione, durata | Tracking scadenza revisione documenti con alert prima della scadenza |
| **9.1.1** | Monitoraggio, misurazione, analisi — cosa/quando/metodo/frequenza | Dashboard KPI scadenze (% rispettate, media ritardo, trend) |
| **10.2.1e** | NC — verificare efficacia azione correttiva | Task con `due_date` su verifica, alert se non completato |
| **6.1** | Azioni per rischi e opportunita' | Scadenze su azioni mitigazione rischi visibili nello scadenzario |

### D.Lgs. 81/2008 (Sicurezza sul lavoro)

| Obbligo | Come lo soddisfa |
|---------|-------------------|
| Art. 37 — Formazione periodica | Alert scadenza qualifiche/formazione con assegnazione RSPP |
| Art. 71 — Verifiche periodiche attrezzature | Documenti tipo `verifica_periodica` con scadenza e responsabile |
| Art. 26 — Qualificazione imprese appaltatrici | Scadenze documentazione fornitori (DURC, polizze, ecc.) |

### D.Lgs. 152/2006 (Ambiente — se ISO 14001)

| Obbligo | Come lo soddisfa |
|---------|-------------------|
| Autorizzazioni ambientali (AIA, AUA) | Documenti con scadenza + alert multi-livello |
| Analisi periodiche emissioni/scarichi | Task ricorrenti con frequenza normativa |

### ISO 3834-2 (Saldatura — se attivo)

| Obbligo | Come lo soddisfa |
|---------|-------------------|
| Qualifiche saldatori (ISO 9606) | Alert scadenza con 6 mesi anticipo (rinnovo lungo) |
| Validita' WPS/WPQR | Scadenze collegate a `welding_procedures` |
| Taratura strumenti (ISO 17662) | `cert_taratura` con frequenza annuale/biennale |

### Best Practice Consolidate

1. **Unica fonte di verita' (SoT)**: le date scadenza restano nella tabella sorgente; lo scadenzario e' una **vista arricchita**, non una copia
2. **Escalation progressiva**: stesso modello gia' collaudato per documenti (soglie 35/28/21/14/7/3/1)
3. **Assegnazione responsabile**: campo `assigned_to` → l'utente specifico riceve le email (non solo i destinatari generici org)
4. **Audit trail**: `deadline_task_log` garantisce tracciabilita' invii (requisito ISO 7.5)
5. **Segregazione tenant**: ogni query filtra su `organization_id` (multi-tenant sicuro)
6. **Automazione opt-in**: creazione task automatica solo se la org lo abilita — altrimenti creazione manuale
7. **Task manuali**: per scadenze non collegate a record DB (es. "rinnovo polizza", "audit ente", "riesame direzione")

---

## 8. Scalabilita' e Riuso

### Pattern gia' esistenti riutilizzati

| Pattern | Usato in | Riusato per |
|---------|----------|-------------|
| Escalation con soglie + log anti-duplicati | `docAlertEscalation.service.js` | `deadlineTaskAlert.service.js` |
| Semaforo colori (verde/giallo/arancione/rosso) | `qualifications.controller.js` | Colonna "urgenza" nello scadenzario |
| Deep-link navigazione | Tab Priorita' DocumentRegistry | Link alla fonte nello scadenzario |
| `notifications_config` per org | Alert documenti | Configurazione scadenzario |
| Rubrica `notification_contacts` | NC alert | Assegnazione task a contatti esterni |
| Cron job su `alertScheduler.js` | Doc/NC alert | Nuovo job `runDeadlineTaskAlerts` |

### Estendibilita' futura

Per aggiungere una **nuova entita' con scadenza** (es. `audit_periodici`, `formazione_obbligatoria`):
1. Aggiungere un ramo alla vista `v_scadenzario_unificato`
2. Aggiungere il valore in `CK_deadline_tasks_source` (`ALTER TABLE ... DROP/ADD CONSTRAINT`)
3. Il resto (UI, alert, assegnazione) funziona senza modifiche

---

## 9. Piano Implementazione (Slice Verticali)

| Slice | Contenuto | Prerequisiti | Stima |
|-------|-----------|--------------|-------|
| **S1** | Migrazione DB: `deadline_tasks` + `deadline_task_log` + vista | Migrazioni esistenti applicate | Bassa |
| **S2** | API CRUD `/deadline-tasks` + endpoint vista `/deadlines/unified` | S1 | Media |
| **S3** | UI pagina `/deadlines` con griglia, filtri, deep-link | S2 | Media |
| **S4** | Assegnazione utente (dropdown + campo email) + notifica creazione | S2 + rubrica contacts | Bassa |
| **S5** | Job cron alert (`deadlineTaskAlert.service.js`) + log | S2 + alertScheduler | Media |
| **S6** | Creazione automatica task da scadenze senza task | S2 + config opt-in | Bassa |
| **S7** | Widget scadenzario in Home (top 5 urgenti con link) | S2 | Bassa |
| **S8** | Export Excel scadenzario completo | S2 | Bassa |

**Ordine consigliato**: S1 → S2 → S3 → S5 → S4 → S6 → S7 → S8

---

## 10. Decisione Richiesta al Committente

| # | Domanda | Opzioni | Raccomandazione |
|---|---------|---------|-----------------|
| 1 | Creazione task automatica? | A) Sempre per documenti con scadenza B) Opt-in per org C) Solo manuale | **B** — opt-in, attivabile da Impostazioni |
| 2 | Assegnazione a utenti non registrati? | A) Solo utenti sistema B) Anche email esterne | **B** — come `notification_contacts` |
| 3 | Task ricorrenti (es. "verifica annuale")? | A) Subito B) Fase successiva | **B** — dopo stabilizzazione base |
| 4 | Priorita' rispetto a ADR-009 Fase 2? | A) Prima scadenzario B) Prima Fase 2 C) Parallelo | **Decisione committente** |

---

## 11. Riferimenti

- `docs/AGENT_ALERTS_AND_DOC_TYPES.md` — modello alert esistente a 3 livelli
- `docs/reference/DATABASE_SCHEMA.md` — schema DB
- ISO 9001:2015 clausole 6.1, 7.5.3, 9.1.1, 10.2
- D.Lgs. 81/2008 artt. 37, 71, 26 (sicurezza)
- D.Lgs. 152/2006 (ambiente)
- UNI EN ISO 3834-2 (saldatura)
- Pattern esistenti: `docAlertEscalation.service.js`, `alertScheduler.js`, `v_scadenzario_unificato` (proposta)
