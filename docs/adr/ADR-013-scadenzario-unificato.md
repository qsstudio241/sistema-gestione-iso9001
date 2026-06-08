# ADR-013 — Scadenzario da File: Rilevamento Automatico e Import nella Griglia Priorita'

> **Stato**: Proposto  
> **Data**: 2026-06-08  
> **Autore**: AI Agent (proposta tecnica per validazione committente)  
> **Prerequisiti**: Sprint 9/10 (pipeline import), document_registry, Alert Engine  
> **Correlati**: ADR-011 (registry norm SoT), Sprint B (Alert Engine)

---

## 1. Obiettivo

Quando un utente carica un file (tipicamente Excel/CSV) nel sistema, **il backend ne analizza il contenuto** per determinare se si tratta di uno "scadenzario" — cioe' se contiene righe con un campo data interpretabile come scadenza.

Se rilevato:
1. Estrarre i record (righe del foglio) con la loro data di scadenza
2. Mostrarli nella **griglia Priorita'** con deep-link al file sorgente
3. Permettere di **assegnare** ogni scadenza a un utente con alert email
4. Calcolare lo stato (scaduto / in scadenza / ok) rispetto alla data corrente

---

## 2. Come si Rileva uno "Scadenzario"

### 2.1 Euristica colonne (senza AI — veloce, deterministico)

Il parser legge le intestazioni (riga 1) di ogni foglio del file e cerca match per pattern noti:

```javascript
const DEADLINE_COLUMN_PATTERNS = [
  // Italiano
  /scadenza/i, /data\s*scadenza/i, /fine\s*validit/i,
  /validit.*fino/i, /rinnovo/i, /data\s*fine/i,
  /termine/i, /entro\s*il/i, /deadline/i,
  // Inglese
  /expiry/i, /expiration/i, /due\s*date/i, /valid\s*until/i,
  /end\s*date/i, /renewal/i,
  // Date generiche con contesto
  /data.*verifica/i, /prossim.*controllo/i,
  /scad/i  // abbreviazione comune
];

const LABEL_COLUMN_PATTERNS = [
  /descrizione/i, /oggetto/i, /titolo/i, /nome/i,
  /documento/i, /attivit/i, /item/i, /subject/i,
  /cosa/i, /riferimento/i, /rif/i
];
```

**Regola di rilevamento**: il foglio e' uno scadenzario se:
- Almeno **1 colonna** matcha `DEADLINE_COLUMN_PATTERNS`
- La colonna contiene valori interpretabili come **date** (serial Excel o stringa data)
- Almeno **1 colonna** matcha `LABEL_COLUMN_PATTERNS` (descrizione dell'oggetto)

### 2.2 Analisi AI (opzionale — per file ambigui)

Se l'euristica non da' risultato chiaro ma il file ha colonne data non riconosciute, si puo' inviare le prime 5 righe al servizio AI gia' esistente (`importAiExtraction.service.js`) con prompt:

> "Analizza queste intestazioni e righe. Il file e' uno scadenzario (contiene oggetti con data di scadenza/rinnovo)? Se si', indica quale colonna e' la data scadenza e quale e' la descrizione dell'oggetto."

**Opzionale e opt-in** — non bloccante per il flusso base.

### 2.3 Confidence score

| Score | Significato | Azione |
|-------|-------------|--------|
| **Alta** (>0.8) | Colonna "Data Scadenza" esplicita + date valide | Propone import automatico |
| **Media** (0.5-0.8) | Colonna ambigua (es. "Data") ma contiene date future/passate | Chiede conferma utente: "Vuoi importare come scadenzario?" |
| **Bassa** (<0.5) | Nessuna colonna-data riconosciuta | Non propone nulla |

---

## 3. Flusso Operativo

```
Utente carica file Excel/CSV
         |
         v
[Backend] Parsing con xlsx (SheetJS)
         |
         v
[Detector] Analizza intestazioni + prime righe
         |
    +----+----+----+
    |         |         |
    v         v         v
  ALTA      MEDIA     BASSA
  conf.     conf.     conf.
    |         |         |
    v         v         v
  Propone   Chiede    Nessuna
  import    conferma  azione
  auto      utente
    |         |
    +----+----+
         |
         v
[Import] Estrae righe → tabella `deadline_items`
         |
    +----+----+
    |         |
    v         v
Griglia    Alert email
Priorita'  (se assegnato)
    |
    v
Click → apre file sorgente (SpreadsheetViewer)
```

---

## 4. Schema DB

### 4.1 Tabella `deadline_items` — record estratti dai file

```sql
CREATE TABLE deadline_items (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  organization_id   INT NOT NULL,
  company_id        INT NULL,

  -- Origine file
  source_document_id INT NOT NULL,   -- FK document_registry.id (il file Excel caricato)
  source_sheet_name  NVARCHAR(100) NULL,  -- nome foglio Excel
  source_row_number  INT NULL,       -- riga originale nel foglio

  -- Contenuto estratto
  title             NVARCHAR(500) NOT NULL,  -- valore colonna "descrizione/oggetto"
  due_date          DATE NOT NULL,           -- valore colonna scadenza
  category          NVARCHAR(100) NULL,      -- eventuale colonna "tipo/categoria"
  reference_code    NVARCHAR(100) NULL,      -- eventuale colonna "codice/rif."
  extra_data        NVARCHAR(MAX) NULL,      -- JSON con tutte le altre colonne della riga

  -- Assegnazione (opzionale)
  assigned_to       INT NULL,          -- FK users.id
  assigned_email    NVARCHAR(255) NULL, -- email diretta (se utente esterno)

  -- Stato operativo
  status            NVARCHAR(20) NOT NULL DEFAULT 'active',
    -- 'active' | 'completed' | 'dismissed' | 'expired_acknowledged'
  completed_at      DATETIME NULL,
  completed_by      INT NULL,
  notes             NVARCHAR(MAX) NULL,

  -- Alert
  alert_enabled     BIT NOT NULL DEFAULT 1,

  -- Metadati
  created_by        INT NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT GETDATE(),
  updated_at        DATETIME NOT NULL DEFAULT GETDATE(),

  CONSTRAINT CK_deadline_items_status
    CHECK (status IN ('active','completed','dismissed','expired_acknowledged')),

  CONSTRAINT FK_deadline_items_source
    FOREIGN KEY (source_document_id) REFERENCES document_registry(id)
);

CREATE INDEX IX_deadline_items_org_due
  ON deadline_items (organization_id, due_date)
  WHERE status = 'active';

CREATE INDEX IX_deadline_items_source
  ON deadline_items (source_document_id);

CREATE INDEX IX_deadline_items_assigned
  ON deadline_items (assigned_to)
  WHERE status = 'active';
```

### 4.2 Tabella `deadline_import_config` — mapping colonne per file

```sql
CREATE TABLE deadline_import_config (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  document_id       INT NOT NULL UNIQUE,  -- FK document_registry.id
  organization_id   INT NOT NULL,
  sheet_name        NVARCHAR(100) NULL,
  date_column       NVARCHAR(100) NOT NULL,   -- nome colonna data scadenza
  title_column      NVARCHAR(100) NOT NULL,   -- nome colonna descrizione
  category_column   NVARCHAR(100) NULL,
  reference_column  NVARCHAR(100) NULL,
  auto_refresh      BIT NOT NULL DEFAULT 0,   -- se 1: ri-importa a ogni upload nuova versione
  last_import_at    DATETIME NULL,
  last_import_rows  INT NULL,

  CONSTRAINT FK_di_config_doc
    FOREIGN KEY (document_id) REFERENCES document_registry(id)
);
```

Questa tabella **memorizza il mapping** tra colonne Excel e campi scadenzario, cosi' al prossimo upload della stessa tipologia il sistema sa gia' come interpretarlo.

---

## 5. Backend — Componenti

### 5.1 Parser Excel (`backend/src/utils/excelDeadlineDetector.js`)

```javascript
// Pseudo-codice del detector
const XLSX = require('xlsx');

function detectDeadlineSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const results = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (json.length < 2) continue; // serve almeno header + 1 riga

    const headers = json[0].map(h => String(h || '').trim());
    const dateColIdx = findDateColumn(headers, json.slice(1, 6));
    const titleColIdx = findTitleColumn(headers);

    if (dateColIdx >= 0 && titleColIdx >= 0) {
      results.push({
        sheetName,
        dateColumn: headers[dateColIdx],
        titleColumn: headers[titleColIdx],
        confidence: calculateConfidence(headers, json, dateColIdx),
        sampleRows: json.slice(1, 4), // prime 3 righe per preview
        totalRows: json.length - 1
      });
    }
  }
  return results;
}
```

**Dipendenza**: aggiungere `xlsx` al `backend/package.json` (stesso pacchetto gia' usato nel frontend).

### 5.2 Endpoint API

| Metodo | Path | Funzione |
|--------|------|----------|
| POST | `/documents/:id/detect-deadlines` | Analizza file e restituisce detection result |
| POST | `/documents/:id/import-deadlines` | Importa righe come `deadline_items` con mapping specificato |
| GET | `/deadline-items` | Lista items per org (filtri: status, due_date, assigned_to) |
| PATCH | `/deadline-items/:id` | Aggiorna stato, assegnazione, note |
| DELETE | `/deadline-items/:id` | Elimina singolo item |
| POST | `/deadline-items/:id/complete` | Segna completato |
| GET | `/deadline-items/priority` | Vista priorita' (scaduti + in scadenza entro N giorni) |

### 5.3 Flusso detect → import

1. Utente carica Excel nel Registro Documenti (upload normale)
2. Il backend rileva che e' `.xlsx/.xls/.csv` e lancia il detector
3. Se confidence alta/media → risponde con `{ isDeadlineFile: true, sheets: [...], suggestedMapping: {...} }`
4. Frontend mostra dialog: "Questo file sembra uno scadenzario. Vuoi importare le scadenze?"
5. Utente conferma (o modifica) il mapping colonne
6. `POST /documents/:id/import-deadlines` con mapping → estrae righe → INSERT in `deadline_items`

### 5.4 Refresh automatico (opzionale)

Se `deadline_import_config.auto_refresh = 1`, quando l'utente carica una **nuova versione** dello stesso documento (replace nel registro):
1. Il sistema ri-analizza il file con lo stesso mapping salvato
2. Confronta con righe esistenti (per `source_row_number` o matching su `title + reference_code`)
3. Aggiorna date modificate, aggiunge nuove righe, marca rimossi

---

## 6. Frontend — Integrazione nella Griglia Priorita'

### 6.1 Estensione Tab Priorita' in DocumentRegistry

La tab Priorita' gia' mostra documenti scaduti/in scadenza. Si aggiunge una sezione:

```
+------------------------------------------------------------------+
| SCADENZE DA FILE IMPORTATI                           [icona xlsx] |
+------------------------------------------------------------------+
| SCADUTI (2)                                              rosso    |
|  ⚠ Taratura torsiometro XYZ | Scad. 15/05/2026 | 📎 Scadenzario.xlsx |
|  ⚠ Polizza RC n. 12345     | Scad. 01/06/2026 | 📎 Polizze.xlsx    |
+------------------------------------------------------------------+
| IN SCADENZA 30 GG (3)                                 arancione   |
|  ● Qualifica Rossi ISO 9606 | Scad. 08/07/2026 | 📎 Qualifiche.xlsx |
|  ...                                                               |
+------------------------------------------------------------------+
```

Ogni riga ha:
- **Icona file** (click → apre `SpreadsheetViewer` gia' esistente puntando alla riga)
- **Semaforo** (rosso/arancione/giallo/verde) calcolato da `due_date` vs oggi
- **Assegnato a** (avatar o nome, click per modificare)

### 6.2 Widget Home

`HomePage.jsx` gia' ha le `AlertCard`. Si aggiunge una card "Scadenze da file" con count + top 3.

### 6.3 Dialog di Import

Quando il detector rileva uno scadenzario al momento dell'upload:

```
+------------------------------------------+
| 📊 File scadenzario rilevato             |
+------------------------------------------+
| "Scadenzario_2026.xlsx" contiene date    |
| di scadenza. Vuoi importarle?            |
|                                          |
| Colonna scadenza: [Data Scadenza ▼]     |
| Colonna oggetto:  [Descrizione ▼]       |
| Colonna codice:   [Rif. (opz.) ▼]      |
|                                          |
| Anteprima: 45 righe, 3 scadute          |
|                                          |
| [Annulla]              [Importa]         |
+------------------------------------------+
```

---

## 7. Alert Email per Scadenze Importate

Riuso completo del pattern `docAlertEscalation.service.js`:

1. Il job cron `alertScheduler.js` aggiunge un ciclo sui `deadline_items` attivi
2. Per ogni item con `alert_enabled = 1` e `assigned_email` (o email dell'`assigned_to`):
   - Calcola giorni alla scadenza
   - Applica soglie org (`alert_days_1`, `alert_days_2`) o custom
   - Invia email se la soglia e' raggiunta e non gia' inviata (log anti-duplicati)
3. Email contiene: titolo, data scadenza, link diretto al file sorgente, link allo scadenzario

**Destinatario**: l'utente assegnato (`assigned_to` → lookup email) oppure `assigned_email` diretto (per contatti esterni non registrati nel sistema).

---

## 8. Requisiti Normativi

### ISO 9001:2015

| Clausola | Obbligo | Copertura |
|----------|---------|-----------|
| **7.5.3b** | Garantire che le informazioni documentate siano disponibili e adatte all'uso | File Excel gia' nel registro; scadenze visibili nella griglia |
| **7.5.3d** | Conservazione e controllo delle modifiche | Versioning documento + refresh automatico scadenze |
| **9.1.1** | Determinare cosa monitorare, quando, con quale frequenza | Alert configurabile per soglie, assegnazione responsabile |
| **10.2.1e** | Valutare necessita' di azioni correttive se scadenza non rispettata | Stato "scaduto" visibile + alert escalation |

### D.Lgs. 81/2008 (Sicurezza lavoro)

| Articolo | Obbligo tipico in scadenzario | Esempio |
|----------|-------------------------------|---------|
| Art. 37 | Formazione/addestramento periodico | Riga "Corso antincendio Rossi" con scadenza 3 anni |
| Art. 71.11 | Verifiche periodiche attrezzature | Riga "Verifica ponteggio" con scadenza annuale |
| Art. 26 | Idoneita' tecnico-professionale appaltatori | Riga "DURC Impresa XYZ" con validita' 120 gg |
| Art. 18.1a | Aggiornamento DVR | Riga "Revisione DVR" con scadenza triennale |

### D.Lgs. 152/2006 (Ambiente)

| Obbligo | Esempio scadenzario |
|---------|---------------------|
| Autorizzazioni AIA/AUA | "AUA n. 123 - scarico" con scadenza 15 anni |
| Analisi emissioni | "Campionamento E1" con frequenza semestrale |
| Registro rifiuti | "Denuncia MUD" con scadenza annuale |

### ISO 3834-2 (Saldatura)

| Obbligo | Esempio |
|---------|---------|
| Qualifiche saldatori ISO 9606 | "Patentino Bianchi 141-FM1" scadenza 2 anni |
| Taratura strumenti ISO 17662 | "Taratura amperometro S/N 456" scadenza annuale |
| WPQR validita' | "WPQR-001 Rev.0" con validita' del laboratorio |

### Best practice per la conservazione (ISO 9001 §7.5.3)

- **Tracciabilita' fonte**: ogni record nello scadenzario mantiene link al file originale (auditabile)
- **Versioning**: quando il file viene aggiornato, le scadenze si aggiornano di conseguenza
- **Audit trail**: chi ha importato, quando, quale mapping ha usato
- **Non-repudiabilita'**: il file sorgente resta nel registro documenti (non cancellabile se ha scadenze attive)

---

## 9. Scalabilita' e Vantaggi della Soluzione

### Perche' una tabella dedicata (non una vista dinamica sul file)

| Pro tabella `deadline_items` | Contro "parsing on-the-fly" |
|------------------------------|------------------------------|
| Query veloci con indici su `due_date`, `assigned_to` | Ogni apertura UI ricalcola tutto |
| Stato indipendente (`completed`, note, assegnazione) | Non gestisce stato per-riga |
| Alert email con log anti-duplicati | Non puo' tracciare invii |
| Offline: cacheable in IndexedDB | Richiede sempre il file |
| Export Excel della vista priorita' | Performance degradano con molti file |

### Riuso pattern esistenti

| Pattern | Gia' collaudato in | Riusato per |
|---------|---------------------|-------------|
| SheetJS parsing | `SpreadsheetViewer.jsx` (frontend) | Detector backend + preview |
| Alert escalation + log | `docAlertEscalation.service.js` | Alert su `deadline_items` |
| `document_registry` come sorgente | Registro documenti | Link `source_document_id` |
| `SpreadsheetViewer` | Visualizzazione allegati | "Vai al file" con highlight riga |
| `AlertCard` in HomePage | Widget urgenti | Card "Scadenze da file" |
| Tab Priorita' + semaforo | DocumentRegistry | Sezione scadenze importate |

### Estendibilita'

Per supportare un **nuovo tipo di file-scadenzario** (es. CSV export da altro gestionale):
1. Aggiungere parser in `excelDeadlineDetector.js` (CSV e' gia' supportato da SheetJS)
2. Zero modifiche a DB, UI, alert

---

## 10. Piano Implementazione (Slice Verticali)

| # | Slice | Output verificabile | Dipendenze |
|---|-------|---------------------|------------|
| **S1** | `xlsx` nel backend + servizio detector (`excelDeadlineDetector.js`) | Dato un buffer Excel, restituisce `{ isDeadline, columns, confidence }` con test L1 | Nessuna |
| **S2** | Migrazione DB `deadline_items` + `deadline_import_config` | Tabelle create, idempotente | Nessuna |
| **S3** | API `POST /documents/:id/detect-deadlines` | Endpoint che ritorna il risultato di S1 | S1 |
| **S4** | API `POST /documents/:id/import-deadlines` + `GET /deadline-items` | Import righe + lista filtrata | S1, S2 |
| **S5** | Frontend: dialog import al caricamento + pagina `/deadlines` | UI funzionale con griglia | S3, S4 |
| **S6** | Integrazione in Tab Priorita' + Home widget | Scadenze da file visibili dove gia' si guardano le urgenze | S4 |
| **S7** | Assegnazione utente + alert email (job cron) | L'assegnatario riceve email a soglie | S4 + alertScheduler |
| **S8** | Auto-refresh al replace documento | Ri-import automatico quando il file viene aggiornato | S4 |

**Ordine consigliato**: S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8

---

## 11. Decisioni Richieste al Committente

| # | Domanda | Opzioni | Raccomandazione |
|---|---------|---------|-----------------|
| 1 | Il detector propone l'import automaticamente al caricamento? | A) Si', se confidence alta B) Sempre chiede conferma | **B** — l'utente vede l'anteprima e conferma il mapping |
| 2 | Dove si vede lo scadenzario? | A) Nuova pagina dedicata `/deadlines` B) Sezione nella Tab Priorita' C) Entrambi | **C** — pagina dedicata + widget in Priorita'/Home |
| 3 | Alert email all'assegnatario? | A) Si' con soglie configurabili B) Solo notifica in-app | **A** — email come i documenti |
| 4 | Auto-refresh quando il file viene sostituito? | A) Si' automatico B) Chiede conferma C) Mai | **B** — conferma per evitare sorprese |
| 5 | Priorita' rispetto ad altri task in roadmap? | Decidere committente | Dopo ADR-009 Fase 2 (consigliato) |

---

## 12. Esempio Pratico End-to-End

1. L'utente carica `Scadenzario_Strumenti_2026.xlsx` nel registro documenti (tipo: `registro_interno`)
2. Il file contiene:

| N. | Strumento | S/N | Data Taratura | **Data Scadenza** | Responsabile |
|----|-----------|-----|---------------|-------------------|--------------|
| 1 | Torsiometro | T-001 | 10/01/2026 | **10/01/2027** | Rossi |
| 2 | Calibro | C-015 | 05/03/2025 | **05/03/2026** | Bianchi |
| 3 | Amperometro | A-008 | 20/06/2026 | **20/06/2027** | Rossi |

3. Il detector rileva: colonna "Data Scadenza" → match pattern, confidence 0.95
4. Dialog: "File scadenzario rilevato — 3 righe con scadenze. Importare?"
5. L'utente conferma. Il sistema crea 3 `deadline_items`:
   - Calibro C-015 → **SCADUTO** (05/03/2026 < oggi 08/06/2026) → rosso in griglia
   - Torsiometro T-001 → in scadenza tra 7 mesi → verde
   - Amperometro A-008 → in scadenza tra 12 mesi → verde
6. L'utente assegna "Calibro C-015" a Bianchi con alert → Bianchi riceve email
7. Click su icona file → si apre `SpreadsheetViewer` con il foglio originale

---

## 13. Riferimenti

- `app/src/components/SpreadsheetViewer.jsx` — viewer Excel gia' esistente
- `backend/src/services/docAlertEscalation.service.js` — pattern alert riusabile
- `backend/src/services/alertScheduler.js` — cron job per notifiche
- `backend/src/controllers/importJobs.controller.js` — pipeline import (da estendere)
- `backend/src/routes/importJobs.routes.js` — fileFilter (oggi solo PDF)
- ISO 9001:2015 §7.5.3, §9.1.1, §10.2.1
- D.Lgs. 81/2008 artt. 37, 71, 26
- D.Lgs. 152/2006 (autorizzazioni ambientali)
