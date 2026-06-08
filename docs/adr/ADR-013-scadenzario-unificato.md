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
2. Mostrarli nella **griglia Priorita'** con deep-link al file sorgente — **solo** le righe con scadenza entro 30 giorni (o gia' scadute)
3. Permettere di **assegnare** ogni scadenza a un utente con alert email
4. Calcolare lo stato (scaduto / in scadenza / ok) rispetto alla data corrente

---

## 1.1 Regole Operative Confermate dal Committente

| Regola | Dettaglio |
|--------|-----------|
| **Multi-scadenzario per azienda** | Una stessa azienda cliente puo' avere piu' file-scadenzario (es. "Tarature", "Qualifiche", "Polizze") |
| **Destinatario alert default** | L'**admin dello studio** (auditor/consulente che gestisce l'azienda) — non il soggetto nella riga |
| **Finestra visibilita'** | Solo righe con scadenza **entro 30 giorni** (o gia' scadute) appaiono nella griglia. Le righe oltre 30 gg restano in DB ma non si mostrano |
| **Finestra configurabile (futuro)** | Da valutare: soglia 30 gg potrebbe variare per tipologia di scadenzario (es. patentini 60 gg, polizze 30 gg) |
| **Frequenza alert** | Identica a quella dei documenti: stesse soglie escalation (`alert_days_1`, `alert_days_2`, curva `doc_escalation_profile`) |
| **Scaduti** | Restano visibili finche' non vengono marcati "completato" o "preso in carico" dall'admin |

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
  company_id        INT NULL,          -- FK companies.id — l'azienda cliente

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

  -- Assegnazione
  -- DEFAULT: admin dello studio (chi gestisce l'azienda cliente)
  -- L'utente puo' riassegnare a un contatto specifico se necessario
  assigned_to       INT NULL,          -- FK users.id (default = admin studio)
  assigned_email    NVARCHAR(255) NULL, -- email diretta override (se utente esterno)

  -- Stato operativo
  status            NVARCHAR(20) NOT NULL DEFAULT 'active',
    -- 'active' | 'completed' | 'dismissed' | 'expired_acknowledged'
  completed_at      DATETIME NULL,
  completed_by      INT NULL,
  notes             NVARCHAR(MAX) NULL,

  -- Alert (stessa logica documenti — riusa escalation org)
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

-- Indice per query griglia: solo righe attive entro finestra 30 gg
CREATE INDEX IX_deadline_items_org_due
  ON deadline_items (organization_id, due_date)
  WHERE status = 'active';

CREATE INDEX IX_deadline_items_company
  ON deadline_items (company_id, due_date)
  WHERE status = 'active';

CREATE INDEX IX_deadline_items_source
  ON deadline_items (source_document_id);

CREATE INDEX IX_deadline_items_assigned
  ON deadline_items (assigned_to)
  WHERE status = 'active';
```

### 4.2 Tabella `deadline_import_config` — mapping colonne per file

Un'azienda puo' avere **piu' scadenziari** (file diversi). Ogni file ha il suo mapping salvato.

```sql
CREATE TABLE deadline_import_config (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  document_id       INT NOT NULL UNIQUE,  -- FK document_registry.id (il file Excel)
  organization_id   INT NOT NULL,
  company_id        INT NULL,             -- FK companies.id
  label             NVARCHAR(200) NULL,   -- etichetta scadenzario (es. "Tarature", "Polizze")
  sheet_name        NVARCHAR(100) NULL,
  date_column       NVARCHAR(100) NOT NULL,   -- nome colonna data scadenza
  title_column      NVARCHAR(100) NOT NULL,   -- nome colonna descrizione
  category_column   NVARCHAR(100) NULL,
  reference_column  NVARCHAR(100) NULL,
  visibility_days   INT NOT NULL DEFAULT 30,  -- finestra visibilita' (default 30 gg, futuro: per tipo)
  auto_refresh      BIT NOT NULL DEFAULT 0,   -- se 1: ri-importa a ogni upload nuova versione
  last_import_at    DATETIME NULL,
  last_import_rows  INT NULL,

  CONSTRAINT FK_di_config_doc
    FOREIGN KEY (document_id) REFERENCES document_registry(id)
);
```

**Note sulla tabella config:**
- `visibility_days` = 30 (default). In futuro potra' essere diverso per tipologia (es. patentini 60 gg)
- `label` = nome descrittivo dello scadenzario (per distinguerli nella UI quando l'azienda ne ha piu' di uno)
- Un'azienda puo' avere N righe qui (N file-scadenzario diversi)

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

### 6.1 Regola di visibilita': solo entro 30 giorni

La query filtra: `WHERE due_date <= DATEADD(day, 30, GETDATE()) AND status = 'active'`

Le righe con scadenza oltre 30 giorni **non appaiono** nella griglia (restano in DB, pronte per quando entreranno in finestra). Le righe gia' scadute restano visibili finche' non vengono marcate dall'admin.

### 6.2 Estensione Tab Priorita' in DocumentRegistry

La tab Priorita' gia' mostra documenti scaduti/in scadenza. Si aggiunge una sezione raggruppata per azienda e scadenzario:

```
+------------------------------------------------------------------+
| SCADENZE DA FILE — Azienda Rossi Srl              [icona xlsx]   |
|  Scadenzario: Tarature strumenti                                  |
+------------------------------------------------------------------+
| SCADUTI (2)                                              rosso    |
|  ⚠ Calibro C-015           | Scad. 05/03/2026 | 📎 Tarature.xlsx |
|  ⚠ Manometro M-002         | Scad. 01/06/2026 | 📎 Tarature.xlsx |
+------------------------------------------------------------------+
| IN SCADENZA 30 GG (1)                                 arancione   |
|  ● Torsiometro T-001       | Scad. 05/07/2026 | 📎 Tarature.xlsx |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
| SCADENZE DA FILE — Azienda Rossi Srl                              |
|  Scadenzario: Polizze e certificazioni                            |
+------------------------------------------------------------------+
| IN SCADENZA 30 GG (1)                                 arancione   |
|  ● Polizza RC n.123        | Scad. 02/07/2026 | 📎 Polizze.xlsx  |
+------------------------------------------------------------------+
```

Ogni riga ha:
- **Icona file** (click → apre `SpreadsheetViewer` gia' esistente puntando alla riga)
- **Semaforo** (rosso = scaduto, arancione = entro 7 gg, giallo = entro 30 gg)
- Raggruppamento per **azienda** → **scadenzario** (label da `deadline_import_config`)

### 6.3 Widget Home

`HomePage.jsx` gia' ha le `AlertCard`. Si aggiunge una card "Scadenze da file" con count totale scaduti + in scadenza 30 gg, top 3 urgenti.

### 6.4 Dialog di Import

Quando il detector rileva uno scadenzario al momento dell'upload:

```
+------------------------------------------+
| 📊 File scadenzario rilevato             |
+------------------------------------------+
| "Tarature_2026.xlsx" contiene date       |
| di scadenza. Vuoi importarle?            |
|                                          |
| Colonna scadenza: [Data Scadenza ▼]     |
| Colonna oggetto:  [Descrizione ▼]       |
| Colonna codice:   [Rif. (opz.) ▼]      |
| Etichetta:        [Tarature strumenti]   |
|                                          |
| Anteprima: 45 righe totali              |
|   di cui 3 scadute, 2 entro 30 gg       |
|                                          |
| [Annulla]              [Importa]         |
+------------------------------------------+
```

---

## 7. Alert Email per Scadenze Importate

**Stessa logica dei documenti** — riuso completo delle soglie e della curva escalation gia' configurata per l'organizzazione.

### Destinatario default

L'alert va all'**admin dello studio** (l'auditor/consulente che gestisce l'azienda cliente), non al soggetto indicato nella riga dello scadenzario. Motivazione: e' lo studio che deve attivarsi per ricordare al cliente la scadenza.

Il destinatario si determina cosi':
1. Se `deadline_items.assigned_to` e' valorizzato → email di quell'utente
2. Se `assigned_email` e' valorizzato → usa quella
3. Altrimenti (default) → `notifications_config.recipients_email` della org (= admin studio)

### Frequenza e soglie

Identiche a `docAlertEscalation.service.js`:
- Usa `alert_days_1` e `alert_days_2` dalla `notifications_config` dell'org
- Usa `doc_escalation_profile` (se configurato) per le soglie specifiche
- Log anti-duplicati: riusa lo stesso pattern di `doc_notification_log`
- Post-scadenza: promemoria giornaliero finche' l'item non viene marcato completato

### Integrazione nel cron

Il job cron `alertScheduler.js` aggiunge un ciclo:
1. Query `deadline_items` dove `status = 'active'` e `due_date` entro finestra `alert_days_1`
2. Per ogni item: calcola giorni alla scadenza, applica soglie org
3. Invia email se soglia raggiunta e non gia' inviata
4. Email contiene: titolo, data scadenza, nome azienda, link diretto al file sorgente

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

## 11. Decisioni Confermate e Punti Aperti

### Confermate (08/06/2026)

| # | Decisione | Valore |
|---|-----------|--------|
| 1 | Multi-scadenzario per azienda | Si' — N file diversi per la stessa azienda |
| 2 | Destinatario alert default | Admin dello studio (consulente/auditor che gestisce il cliente) |
| 3 | Finestra visibilita' griglia | 30 giorni (scadenze oltre 30 gg non visibili in griglia) |
| 4 | Frequenza alert email | Stessa dei documenti (escalation org) |
| 5 | Scaduti | Restano visibili finche' non completati/archiviati |

### Punti aperti (da decidere in seguito)

| # | Punto | Note |
|---|-------|------|
| 1 | Finestra configurabile per tipo scadenzario? | Es. patentini 60 gg, polizze 30 gg — campo `visibility_days` gia' predisposto |
| 2 | Priorita' rispetto ad altri task in roadmap? | Dopo ADR-009 Fase 2? |

### Possibili dimenticanze — checklist da validare

| # | Aspetto | Domanda | Suggerimento |
|---|---------|---------|--------------|
| 1 | **Scaduti da molto tempo** | Se una riga e' scaduta da 6 mesi e nessuno la segna "completata", continua a ricevere email giornaliere? | Propongo: dopo 90 gg di ritardo senza azione → ridurre a 1 email/settimana (evita "alert fatigue") |
| 2 | **Chi puo' importare** | Solo admin studio o anche l'azienda cliente (se ha accesso WRITE)? | Propongo: admin studio + ruoli con permesso `manage_documents` |
| 3 | **Eliminazione file sorgente** | Se il file Excel viene eliminato dal registro, che succede alle scadenze importate? | Propongo: le scadenze restano (con nota "file sorgente rimosso") — non si perdono |
| 4 | **Duplicati tra scadenzari e registro documenti** | Un documento gia' nel registro con `expiry_date` che appare ANCHE nello scadenzario Excel → doppia notifica? | Propongo: warning in fase di import ("Questa riga sembra duplicata con documento X nel registro") |
| 5 | **Notifica all'azienda cliente** | L'admin studio riceve l'alert. Puo' poi inoltrare/delegare all'azienda? | Propongo: pulsante "Notifica cliente" che invia email con testo personalizzabile |
| 6 | **Storicizzazione** | Quando una scadenza viene rinnovata (nuovo file con data aggiornata), si tiene traccia della vecchia data? | Propongo: si' — campo `previous_due_date` o log nel refresh automatico |
| 7 | **Export/stampa** | Serve un export Excel/PDF dello scadenzario filtrato per l'azienda? | Propongo: si' — utile come report per il cliente (riesame direzione, audit) |
| 8 | **Badge sidebar** | Aggiungere conteggio scadenze da file nel badge gia' esistente su "Documenti"? | Propongo: si' — sommato al conteggio documenti, oppure badge separato su voce "Scadenzari" |

---

## 12. Esempio Pratico End-to-End

1. Lo studio "Camellini" gestisce l'azienda "Rossi Srl"
2. Camellini carica `Scadenzario_Strumenti_2026.xlsx` nel registro documenti di Rossi Srl (tipo: `registro_interno`)
3. Il file contiene:

| N. | Strumento | S/N | Data Taratura | **Data Scadenza** | Responsabile |
|----|-----------|-----|---------------|-------------------|--------------|
| 1 | Torsiometro | T-001 | 10/01/2026 | **10/01/2027** | Rossi |
| 2 | Calibro | C-015 | 05/03/2025 | **05/03/2026** | Bianchi |
| 3 | Amperometro | A-008 | 20/05/2026 | **20/06/2026** | Rossi |
| 4 | Micrometro | M-003 | 01/01/2026 | **01/01/2027** | Verdi |

4. Il detector rileva: colonna "Data Scadenza" → match pattern, confidence 0.95
5. Dialog: "File scadenzario rilevato — 4 righe. Vuoi importarle? Etichetta: [Tarature strumenti]"
6. Camellini conferma. Il sistema crea 4 `deadline_items` per Rossi Srl
7. **Nella griglia priorita' appaiono SOLO** (oggi = 08/06/2026, finestra 30 gg = fino a 08/07/2026):
   - Calibro C-015 → **SCADUTO** (05/03/2026 < oggi) → rosso
   - Amperometro A-008 → **in scadenza** (20/06/2026, tra 12 gg) → arancione
   - ~~Torsiometro T-001~~ → 10/01/2027 (oltre 30 gg) → **NON mostrato**
   - ~~Micrometro M-003~~ → 01/01/2027 (oltre 30 gg) → **NON mostrato**
8. **Camellini** (admin studio) riceve alert email per Calibro e Amperometro secondo le soglie configurate
9. Click su icona file → si apre `SpreadsheetViewer` con il foglio originale
10. Quando Camellini rinnova la taratura del calibro, segna "Completato" → sparisce dalla griglia

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
