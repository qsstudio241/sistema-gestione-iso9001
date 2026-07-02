# ADR-016 — Welding Book ISO 3834 e modulo Strumenti trasversale

> **Stato**: Accettato (scaffold Fase 0 — 02/07/2026)  
> **Autore**: AI Agent + committente  
> **Correlati**: ADR-013 (scadenzario), `piano_modulo_saldatura_v2.plan.md`, `equipment_assets` (mig. 104), `ndt_reports` (mig. 106)

---

## 1. Contesto e decisione di prodotto

Il **Welding Book** è un **documento operativo di fabbricazione (IOF)** per il coordinatore di saldatura: sequenza dei giunti da saldare e parametri essenziali da utilizzare. **Non** è un verbale di controllo/accettazione (quello resta ai moduli CND).

L’anagrafica **Strumenti e Attrezzature** (`equipment_assets`) è **trasversale** a ISO 9001 (§7.1.3, §7.1.5), ISO 3834 e CND. Non va duplicata per modulo né tenuta “dentro” il solo CND.

---

## 2. Architettura dati (fonte unica)

| Entità | Ruolo |
|--------|--------|
| `equipment_assets` | Anagrafica unica strumenti/macchine/attrezzi |
| `equipment_calibrations` | Storico tarature → alimenta scadenzario (ADR-013) |
| `welding_books` | Testata IOF (prodotto, WPS/WPQR, commessa) |
| `welding_book_equipment` | N righe attrezzature usate (junction → `equipment_assets`) |
| `welding_book_welds` | Sequenza saldature con parametri essenziali (JSON) |

**Foto cordone**: fase successiva — riuso `attachments` con parent `welding_book_weld` (pattern `ndt_report_items`).

**Foto attrezzatura in anagrafica**: backlog su `equipment_assets` (`photo_attachment_id` o allegati polimorfici), upload da mobile.

---

## 3. Licenze commerciali

### 3.1 Chiavi modulo

| Chiave | Contenuto |
|--------|-----------|
| **`strumenti`** *(nuova)* | CRUD anagrafica, tarature, foto attrezzatura (futuro) |
| **`documents`** | Scadenzario unificato + alert (include tarature da `strumenti`) |
| **`cnd`** | Solo verbali VT/MT/PT/UT (consuma anagrafica) |
| **`saldatura`** | WPS/WPQR, commesse, **Welding Book** |

### 3.2 Bundle e dipendenze

| Pacchetto | Moduli richiesti |
|-----------|------------------|
| Welding Book operativo | `saldatura` + `strumenti` |
| Verbali CND | `cnd` + `strumenti` |
| Solo scadenzario file Excel | `documents` |
| Tarature strutturate da anagrafica | `documents` + `strumenti` |

### 3.3 Transizione (retrocompatibilità)

Fino al deploy completo del modulo `strumenti` sul billing:

- Chi ha **`cnd`** mantiene accesso **completo** all’API `/equipment` (comportamento attuale).
- Chi ha **`saldatura`** ottiene accesso **in lettura** a `/equipment` e `/equipment/for-report` per il picker del Welding Book (non CRUD).
- Il CRUD anagrafica richiede **`cnd`** oppure **`strumenti`**.

**Fase 2** (non bloccante per WB): spostare menu da `/cnd/strumenti` a `/attrezzature`, etichetta licenza `cnd` senza “+ Strumenti”.

---

## 4. UI e navigazione

| Voce menu | Route | Licenza |
|-----------|-------|---------|
| Strumenti e Attrezzature | `/attrezzature` (alias `/cnd/strumenti` fino a Fase 2) | `cnd` **o** `strumenti` |
| Welding Book | `/saldatura/welding-book` | `saldatura` |
| Verbali CND | `/cnd/verbali` | `cnd` |

Pattern UI: lista + form a sezioni come `NdtReportsPage` — testata, griglia attrezzature, griglia sequenza saldature, export Word (slice successiva).

---

## 5. Contenuto Welding Book (IOF — niente campi verifica)

### Testata
Prodotto (codice, descrizione), commessa/ordine, disegno+revisione, cliente/azienda, WPS, WPQR (riferimento), materiali, processo, coordinatore saldatura, revisione documento.

### Griglia attrezzature
Select da anagrafica: codice interno, descrizione, matricola (auto), ruolo d’uso, note.

### Griglia sequenza saldature
N° sequenza, n° giunto/posizione, descrizione, WPS (se diversa), saldatore, parametri essenziali (corrente, tensione, velocità, passate, preriscaldo, interpasso, apporto, gas), note operative, foto cordone (slice allegati).

**Escluso**: esiti conforme/NC, ispezione, valutazioni A/R/S, firme ispettore.

---

## 6. Ambiente di rilascio: prova vs produzione

### 6.1 Valutazione impatto

| Aspetto | Impatto su moduli esistenti |
|---------|----------------------------|
| Nuove tabelle `welding_books*` | **Nessuno** (additive, idempotenti) |
| Nuove API `/welding-books` | **Nessuno** (route nuove, licenza `saldatura`) |
| Estensione middleware `equipment` | **Basso** — solo lettura aggiuntiva per org con `saldatura` |
| Chiave licenza `strumenti` | **Nessuno** finché non si toglie `cnd` dall’equipment CRUD |
| Menu frontend | **Nessuno** se voce WB è dietro `licenseKey: saldatura` |

### 6.2 Decisione

| Fase | Dove | Cosa |
|------|------|------|
| **Fase 0 (questa)** | Branch + migrazione **110** su DB prova/VPS | Scaffold CRUD, UI lista/bozza, ADR |
| **Fase 1** | DB prova + Mason test | Form completo, griglie, autosave, Word export |
| **Deploy produzione** | **Sì, dopo migrazione 110** | Sicuro: solo additive. Netlify da `main` dopo merge. Backend VPS dopo migrazione + deploy manifest. |

**Regola**: migrazione su produzione **prima** del deploy backend che espone le nuove route (evita 500 su tabelle mancanti). Non serve ambiente DB separato se le migrazioni sono idempotenti e il modulo è dietro licenza — ma **validazione funzionale** con Mason su dati di prova prima del go-live commerciale.

---

## 7. Piano implementazione (slice)

| Slice | Deliverable | Stato |
|-------|-------------|-------|
| **0** | ADR-016, migrazione 110, API CRUD base, pagina lista/scheletro | In corso |
| **1** | Select WPS/WPQR/commessa, precompilazione, saldatori qualifiche, autosave bozza | ✅ Fase 1 (02/07/2026) |
| **2** | Select WPS/WPQR precompilazione, picker saldatori qualifiche | Backlog |
| **3** | Allegati foto per riga saldatura | Backlog |
| **4** | Export Word IOF (`welding-book-report.docx`) | Backlog |
| **5** | Modulo `strumenti` licenza + menu `/attrezzature` + sync scadenzario tarature | Backlog |
| **6** | Foto attrezzatura in anagrafica (mobile) | Backlog |

---

## 8. Riferimenti codice (Fase 0)

- `backend/database/migrations/110_welding_books.sql`
- `backend/src/controllers/weldingBooks.controller.js`
- `backend/src/routes/weldingBooks.routes.js`
- `app/src/pages/WeldingBooksPage.jsx`
