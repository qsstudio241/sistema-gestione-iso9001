# Roadmap — Sistema Gestione ISO 9001 / SaaS Multi-Tenant

> **Data Inizio**: 13 gennaio 2026
> **Ultimo Aggiornamento**: 05 aprile 2026
> **Prossimo Step** (sessione successiva): (0) Dopo deploy: smoke lista audit mobile/desktop (stesso utente, >50 audit se possibile). (1) Smoke export Word — **verificatore** e **titoli senza mojibake**. (2) Smoke **NV** / **N.A.** + **`[LOGO]`**. (3) Smoke **pending issues** + riga **AP**. (4) Avvio “Flusso 2” (SAL/Sopralluoghi): definizione schema requisiti+stati + evidenze documentali + import CSV/Excel (senza AI). (5) Introduzione RAG come layer di retrieval (job asincrono) dopo che il document registry è stabile; backlog ADR-006, lock DB, template ISO 45001.
> **Backlog**: Lettura blob da IndexedDB per embedding foto nel report Word (allegati solo locali)
> **Riferimenti**: [docs/GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (esperienza operativa) | [docs/adr/ADR-006-auto-reconcile-cache-sync.md](adr/ADR-006-auto-reconcile-cache-sync.md) | [docs/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (schema DB)

---

## Visione Strategica Aggiornata (07/03/2026) — 4 Scenari, 2 Clienti

### I 4 Scenari d'uso emersi

| # | Scenario | Chi lo usa | Standard | Output |
|---|---|---|---|---|
| 1 | **Audit di sistema** | Camellini | ISO 9001 / 14001 / 45001 | Report audit + checklist C/NC/NA |
| 2 | **Audit di terza parte** | Camellini / Mason | Norme del committente | Report audit con ref. normative committente |
| 3 | **Consulenza / SAL** | Camellini | ISO 9001 / 14001 / 45001 | Tabella avanzamento requisiti (Discusso/In corso/Completato) |
| 4 | **Rapporto di Prova** | Mason | ISO 3834 | Report con misure, prove, foto obbligatorie |

### Regola di prioritizzazione (urgenze clienti)

Quando emerge un’urgenza (es. modulo **VT** o **MT**):
- si implementa come **vertical slice** con dati + UI minima + test + feature flag/dark launch
- si evita di introdurre debito strutturale: si appoggia sempre al “Document Registry” + “Requirements/Status” (se già avviati) o si crea lo scheletro minimo riusabile
- l’obiettivo è rilasciare valore senza cambiare direzione: la roadmap resta valida, cambia solo l’ordine delle slice

### I 2 clienti attuali

**Marco Camellini** — Auditor sistemi di gestione
- Scenario 1: audit ISO 9001 ✅ (in produzione), ISO 14001 e 45001 (da completare)
- Scenario 3: SAL documentale per aziende in fase di implementazione SGQ

**Mason** — Coordinatore di saldatura
- Scenario 4: Rapporti di Prova ISO 3834-2 con evidenze fotografiche
- Template di riferimento: `Check List Audit/RDP_MSN-260127-01_REV_0.docx`

### Risorse normative disponibili (leggibili dal tool)
| File | Norma | Uso previsto |
|---|---|---|
| `Normative/UNI EN ISO 9001_2015 Rev. 0.txt` | ISO 9001:2015 | Checklist ✅ |
| `Normative/...UNI EN ISO 14001_2015 Rev. 0.pdf` | ISO 14001:2015 | Checklist da costruire |
| `Normative/...UNI ISO 45001_2018 Rev. 0.pdf` | ISO 45001:2018 | Checklist da costruire |
| `Normative/...UNI EN ISO 3834-1_2021 Rev. 0.pdf` | ISO 3834-1 | Criteri scelta livello |
| `Normative/...UNI EN ISO 3834-3_2021 Rev. 0.pdf` | ISO 3834-3 | Requisiti livello intermedio |
| `Normative/...UNI EN ISO 3834-5_2021 Rev. 0.pdf` | ISO 3834-5 | Documenti e record |

### Cosa differenzia i 4 scenari tecnicamente

| Elemento | Scenario 1 | Scenario 2 | Scenario 3 | Scenario 4 |
|---|---|---|---|---|
| Tipo risposta | C/NC/NA/OSS/OM | C/NC/NA | Discusso/In corso/Completato | Conforme/NC + misure |
| Riferimento norma | Standard ISO | **Norme committente** | Standard ISO | ISO 3834 + spec. committente |
| Foto/allegati | Opzionale | Opzionale | No | **Obbligatorio** |
| Struttura UI | Accordion sezioni | Accordion sezioni | Tabella tracker | Form + gallery foto |
| Template Word | Report audit | Report audit terza parte | SAL avanzamento | Rapporto di prova |

### Scenario 2 — soluzione per ref. normative committente
Il campo `clauseRef` (già presente nella checklist) serve come ancoraggio normativo.
Per audit di terza parte, l'auditor aggiunge nelle note o in un campo "Riferimento committente"
la procedura specifica richiesta dal cliente — non serve una checklist per ogni committente.

### Campo `norm_excerpt` — feature trasversale (tutti gli scenari)
Nel report ISO 14001 del cliente, sotto ogni punto auditato appare lo stralcio della norma.
**Piano**: aggiungere colonna `norm_excerpt NVARCHAR(MAX)` in `checklist_questions`.
Il testo può essere pre-caricato dalle normative PDF (già disponibili e leggibili).
Impatto: report Word molto più professionali, nessuna modifica alla UI.

---

## Visione Strategica (decisione 03/03/2026)

Il progetto evolve da **MVP mono-tenant** a **piattaforma SaaS multi-tenant** per studi di consulenza ISO.

### Modello utenti
```
QS Studio (superadmin — noi)
  └── Studio/Auditor (nostro cliente — abbonamento per standard)
        └── Azienda auditata (cliente dell'auditor — accesso read-only ai propri audit)
```

### Modello commerciale
- Canone per standard abilitato: ISO 9001 / ISO 14001 / ISO 45001 / Checklist Libera
- Tab standard visibili solo se abbonamento attivo per quell'auditor
- Futura: modulo workflow implementazione SGQ come add-on

### Principio di sviluppo: Dark Launch
Ogni nuovo modulo nasce come **tab nascosta** visibile solo agli admin QS Studio.
Gli auditor lo ricevono solo quando stabile e collaudato — zero interruzioni operative.

---

## Stato Avanzamento al 15/03/2026

| Area | Descrizione | Status |
|---|---|---|
| DB migrations 001-018 | Schema base, checklist, allegati, pending_issues | ✅ Completato |
| Auth / JWT | Cookie httpOnly, CORS, authenticateDownload | ✅ Completato |
| Checklist ISO 9001 | 35 domande, clauseRef esatti da documento originale | ✅ Completato (06/03) |
| Checklist ISO 14001 | 46 domande da DB, sezioni 14001_s4/14001_s5 | ✅ Completato |
| Audit CRUD | Crea, modifica, elimina, lista, statistiche | ✅ Completato |
| Sync offline-first | IndexedDB + server-wins + retry/backoff | ✅ Completato |
| Allegati | Upload, preview blob, replace desktop, delete | ✅ Completato |
| Rilievi pendenti | PendingIssuesCascade + pending_issues table | ✅ Completato |
| Re-audit | checkReaudit endpoint + AuditSelector | ✅ Completato |
| Export Word ISO 9001 | Template + Heading2 per TOC + clauseRef corretti | ✅ Completato (06/03) |
| Export Word ISO 14001 | Intestazioni per standard + numerazione corretta | ✅ Completato |
| Multi-standard UI | Tab ISO 9001 + ISO 14001, fix 4 bug 9894ed5 | ✅ Completato |
| Fix sync multi-standard | standard_ids array, auditConverter, checkbox | ✅ Completato |
| **Fase 1: DB multi-tenant** | companies, auditor_orgs, user_org_roles, subscriptions | ✅ Completato |
| **Server come fonte di verità** | Cache IndexedDB sostituita ad ogni download server | ✅ Completato |
| **Dev locale robusto** | Proxy Vite, SW disabilitato su localhost | ✅ Completato |
| **Logo azienda** | Upload/preview/delete logo in CompaniesPage; logo_url nel DB | ✅ Completato (06/03) |
| **ISO 3834-2** | Standard, sezioni DB, template Word generato | ✅ Completato (06/03) |
| **UX audit** | Pulsante "← Lista Audit" + indicatore salvataggio | ✅ Completato (06/03) |
| **Fix campo Note** | Barra spaziatrice funzionante (rimosso trim live) | ✅ Completato (06/03) |
| **Fix sommario Word** | Stili Titolo1/2, colonne DXA, margini stretti | ✅ Completato (07/03) |
| **Fix VERIFICATORE** | Campo meta.auditorName corretto | ✅ Completato (07/03) |
| **Fix backend paths** | require() corretti in certificationFindings | ✅ Completato (07/03) |
| **Fix colonne Word fisse** | tblLayout fixed + ordine OOXML corretto | ✅ Completato (08/03) |
| **Fix allegati in Word** | auditId numerico, hyperlink fldSimple cliccabili | ✅ Completato (08/03) |
| **Checklist personalizzate** | Sezioni/items dinamici, evidenze, template report assegnabile, migrazioni 025-026 | ✅ Completato (15/03) |
| **Report template per custom** | Risoluzione template, VerbaleVisita-generic, assegnazione in CustomChecklistsPage | ✅ Completato (15/03) |
| **Azienda committente da anagrafica** | Menu a tendina da companies (AuditSelector) | ✅ Completato (15/03) |
| **Sync/API con UUID** | create/delete audit e custom-checklist-responses accettano UUID; merge preserva customChecklistId | ✅ Completato (15/03) |
| **Deploy backend VPS** | pscp/plink per controller, script deploy-controllers-to-vps.ps1 | ✅ Completato (15/03) |
| Export Word ISO 3834 | Da testare su produzione | 🔲 Da testare |
| **Foto embedded in Word** | pic:cNvPr id duplicati → doc corrotto; da reimplementare | 🔲 Backlog tecnico |
| **Admin utenti (CRUD + standard)** | `UsersAdminPage`, API admin users; abbonamenti / piani | ✅ Core mar/2026; abbonamenti 🔲 |
| ISO 14001 checklist completa | Da norma PDF disponibile | 🔲 Prossima priorità |
| ISO 45001 checklist | Da norma PDF disponibile | 🔲 Backlog |
| Modulo SAL (Scenario 3) | Nuovo tipo documento per Camellini | 🔲 Backlog |
| Modulo RDP (Scenario 4) | Nuovo tipo documento per Mason — richiede foto embedded | 🔲 Backlog |
| Campo norm_excerpt | Stralcio norma nel report Word | 🔲 Backlog |

**Progress Overall**: ~85% funzionalità core Scenario 1

---

## Roadmap per Fasi

### Fase 0 — Chiusura bug minori e completamento Scenario 1 — PROSSIMA

| # | Task | File | Note |
|---|---|---|---|
| 0.1 | Test export Word ISO 9001 sommario | produzione | Verificare cap. 1→11, colonne, margini |
| 0.2 | ISO 14001 checklist da norma PDF | DB migration + `checklistTemplates.js` | Norma già disponibile e leggibile |
| 0.3 | ISO 45001 checklist da norma PDF | DB migration + `checklistTemplates.js` | Norma già disponibile e leggibile |
| 0.4 | Campo norm_excerpt in checklist_questions | DB + wordExportHelpers.js | Alto impatto, bassa complessità |
| 0.5 | Rilievi pendenti reali in Word | `ExportPanel.jsx`, `wordExport.js`, `wordExportHelpers.js` | **Export**: prima `GET /audits/:id/pending-issues`, poi fallback `checkReaudit`+`nc-responses`; tabella AP in `RILIEVI_MARKER` marca **NC** se pending aperti (mar 2026) |
| 0.6 | Fix Auth Mobile (ADR-004) | `auth.controller.js`, `apiService.js` | localStorage JWT — prerequisito per mobile |

---

### Fase 0.B — Requisiti Trasversali (da integrare nelle fasi successive)

Questi due aspetti impattano su più fasi e vanno considerati in ogni decisione architetturale.

#### Sicurezza link allegati nel Word — download token monouso (Fase 0 / bassa priorità)
**Problema**: i link agli allegati embedded nel report Word contengono il JWT di sessione completo dell'auditor.
Chiunque riceva il file Word può aprire i link e scaricare gli allegati senza fare login.
Il token ha permessi ampi (intera API) e potenzialmente lunga scadenza.

**Soluzione**: sostituire il JWT con **token monouso a scadenza breve** (48h), dedicati al singolo allegato.

```
Tabella DB:
  download_tokens (
    token_hash    VARCHAR(64) PK,   -- SHA-256 del token, mai il token grezzo
    attachment_id INT FK,
    created_by    INT FK users,
    expires_at    DATETIME,         -- ora generazione + 48h
    used_at       DATETIME NULL     -- NULL = non ancora usato
  )

Backend:
  POST /attachments/download-token  → genera token per lista attachment_id
  GET  /attachments/download?dt=TOKEN → valida (esiste? non scaduto?) e serve il file

Frontend (wordExport.js):
  Prima di costruire il Word, chiama l'API per ottenere i token temporanei
  Sostituisce getViewUrl → URL con ?dt=TOKEN invece di ?token=JWT
```

**Stima**: ~4-5 ore (DB 2h + Backend 1h + Frontend 2h)
**Priorità**: bassa — da fare dopo stabilizzazione core (Fase 0 completata)
**Riferimento**: discussione 08/03/2026

#### Audit Locking — accesso concorrente (Fase 1)
**Problema**: se due auditor aprono lo stesso audit contemporaneamente si sovrascrivono le risposte.
**Soluzione**: pessimistic lock con TTL (time-to-live).

**Stato (21/03/2026)**: implementato in codice — migrazione `database/migrations/027_audit_locks.sql`, `backend/src/services/auditLock.service.js`, route `/audits/:auditRef/lock` (+ status), header `X-Audit-Lock-Token` sulle scritture, `AuditLockBanner.jsx`, heartbeat ~60s, TTL `AUDIT_LOCK_TTL_MINUTES` (default 15). **Produzione**: eseguire migrazione sul DB prima del deploy backend.

```
Flusso proposto:
  - Utente A apre audit → backend registra lock (audit_id, user_id, expires_at = now+15min)
  - Utente B apre stesso audit → backend risponde "locked by Utente A"
  - Frontend mostra banner: "Audit in uso da [nome] — accesso sola lettura"
  - Lock si rinnova automaticamente ogni 10 min se utente è attivo
  - Lock scade se utente chiude tab / va offline / inattivo >15 min

Tabella DB:
  audit_locks (audit_id FK, user_id FK, locked_at, expires_at, session_token)
  INDEX su expires_at per cleanup automatico

Backend:
  POST /audits/:id/lock    → acquisisce lock (o restituisce chi lo ha)
  DELETE /audits/:id/lock  → rilascia lock
  PUT /audits/:id/lock     → rinnova lock (heartbeat ogni 10 min)

Frontend:
  AuditLockBanner.jsx      → banner avviso accesso concorrente
  Heartbeat in useEffect   → rinnova lock finche audit e aperto
```

#### Offline Resilience Android — gestione disconnessione (Fase 0 + Fase 2)
**Problema**: su Android PWA la connessione può cadere durante la compilazione.
Il Service Worker e limitato, la quota IndexedDB e ~50MB, la File API non e supportata.

**Stato attuale**: sync offline-first gia implementato per risposte. Mancano:
- Feedback visivo chiaro quando si e in modalita offline
- Gestione upload allegati offline (store blob in IndexedDB → upload al reconnect)
- Warning quando IndexedDB si avvicina al limite quota
- Fallback export Word su Android (gia parzialmente gestito con file-saver)

**Piano**:
```
Fase 0.3 (Auth Mobile ADR-004) — prerequisito
Fase 2 — SyncService v3: store attachments_offline in IndexedDB v3
          StorageQuotaService: monitor spazio ogni 5 min, warning a 60%, cleanup a 80%
          ConnectionStatusBanner: indicatore permanente online/offline
```

---

### Fase 0.B — Nuovi Moduli Documento (Scenario 3 e 4)

Questi moduli hanno struttura dati e UI completamente diversi dall'audit checklist.
Vanno costruiti come **tipi documento separati** identificati da `document_type` in `audits`.

#### Modulo SAL — Stato Avanzamento Lavori (Scenario 3 — Camellini)
**Riferimento**: `Check List Audit/CLIENTE - SAL documentale iso 14001 - 9001 - 45001.docx`
**Struttura**: tabella requisiti × stati (Discusso / In corso / Da validare / Completato)
**Colori**: ogni standard ha un colore (nero=tutti, rosso=45001, verde=14001, blu=9001)

```
DB: aggiungere document_type IN ('audit', 'sal', 'rdp') in tabella audits
UI: nuovo componente SALModule.jsx con tabella tracker
Word: template SAL separato con legenda colori
```

#### Modulo RDP — Rapporto di Prova (Scenario 4 — Mason)
**Riferimento**: `Check List Audit/RDP_MSN-260127-01_REV_0.docx`
**Struttura**: sezioni con prove tecniche, misure, fotografie obbligatorie, valutazione risultato
**Differenza chiave**: foto NON opzionali, struttura per prova (non per clausola ISO)

```
DB: tabella rdp_sections, rdp_tests (test_name, expected_value, measured_value, result)
UI: nuovo componente RDPModule.jsx con form prove + EvidenceManager obbligatorio
Word: template RDP con tabelle prove e galleria foto embedded
```

> ⚠️ **Prerequisito bloccante**: Il modulo RDP richiede foto embedded nel Word.
> Il codice di embedding (xmlImageOoxml) è stato disabilitato il 08/03/2026 per bug OOXML
> (pic:cNvPr id duplicati → documento corrotto in Word).
> **Da risolvere prima di sviluppare RDP**:
> - Fix `xmlImageOoxml`: id univoci per ogni immagine (imgId su pic:cNvPr, non 0)
> - Test end-to-end con allegati immagine reali su produzione
> - Poi riabilitare `usePreview` in `wordExportHelpers.js` e `preloadImagesIntoAudit` in `wordExport.js`
> - Stima fix: 2-3 ore (codice già scritto, solo bug da correggere + test)

#### Struttura `document_type` in `audits`
```sql
ALTER TABLE audits ADD document_type NVARCHAR(20) NOT NULL DEFAULT 'audit'
  CONSTRAINT CK_audits_doc_type CHECK (document_type IN ('audit', 'sal', 'rdp'));
-- Migration graduale: tutti gli audit esistenti rimangono 'audit'
```

---

### Fase 1 — Fondamenta Multi-Tenant e RBAC (6-8 settimane)

**Obiettivo**: struttura dati e autorizzazioni per supportare auditor multipli con i loro clienti.

#### Nuove tabelle DB
```sql
-- Organizzazioni gerarchiche
auditor_orgs (id, name, email, subscription_plan, is_active, created_at)
  FK: organizations.organization_id (parent = QS Studio)

-- Aziende auditate (clienti degli auditor)
companies (id, auditor_org_id FK, name, vat_number, sector, address, is_active)
  Sostituisce: audits.client_name (stringa libera → FK companies.id)

-- Ruoli per utente per organizzazione
user_org_roles (user_id FK, org_id FK, role: superadmin|admin|auditor|viewer)

-- Abbonamenti per standard
subscriptions (auditor_org_id FK, standard_id FK, plan, valid_from, valid_to, is_active)
```

#### Modifiche tabelle esistenti
```sql
ALTER TABLE audits ADD company_id INT FK companies(id);
  -- client_name rimane per retrocompatibilita, company_id nullable inizialmente
ALTER TABLE users ADD auditor_org_id INT FK auditor_orgs(id);
```

#### Backend
- Middleware RBAC: ogni route verifica ruolo + appartenenza org
- Tenant isolation: ogni query filtra su `auditor_org_id` (non solo `organization_id`)
- Endpoint nuovi: CRUD `companies`, CRUD `auditor_orgs`, gestione `subscriptions`

#### Frontend
- Pagina Anagrafica Aziende (crea / cerca / seleziona)
- Pagina Admin QS Studio: gestione auditor e abbonamenti
- Collegamento audit → azienda al posto del campo testo libero

---

### Fase 2 — UI a Tab per Standard + Feature Flags (6-8 settimane)

**Obiettivo**: layout a tab scalabile, ogni standard come modulo indipendente.

#### Struttura UI proposta
```
[Anagrafica Azienda] [ISO 9001] [ISO 14001] [ISO 45001] [Checklist Libera*]
                         |           |            |
                    re-audit    re-audit      (disabilitata
                    + stampa    + stampa      se no abbonamento)

* visibile solo se abbonamento "Checklist Libera" attivo
```

#### Feature flag
```javascript
// Ogni tab controlla:
const canAccessISO14001 = subscription.includes('ISO_14001') || user.role === 'superadmin';
const canAccessFreeChecklist = subscription.includes('FREE_CHECKLIST') || user.role === 'superadmin';
```

#### Principio Dark Launch
- Durante sviluppo: tab visibile solo a `role === 'superadmin'`
- Dopo collaudo: abilitata per gli auditor con abbonamento
- Mai breaking change per gli auditor attivi

---

### Fase 3 — Sistema Licenze e Abbonamenti (3-4 settimane)

**Obiettivo**: pannello admin QS Studio per gestire chi ha accesso a cosa.

- Dashboard admin: lista auditor, stato abbonamenti, scadenze
- Attivazione/disattivazione standard per auditor
- Notifica automatica scadenza abbonamento
- Log accessi per fatturazione

---

### Fase 4 — Checklist Libera e Gap Analysis (6-8 settimane)

**Obiettivo**: domande personalizzate + motore di conformita query-based.

#### Checklist Libera
```sql
custom_checklists (id, auditor_org_id FK, name, description, is_active)
custom_questions  (id, checklist_id FK, question_text, expected_answer, weight, order)
```
- Builder UI: aggiungi domande una per volta, riordina, assegna peso
- Stesse logiche di risposta (C/NC/OSS/OM/NA/NV)
- Export Word parametrizzato anche per checklist libere

#### Gap Analysis
- Query SQL: confronto risposte vs requisiti attesi per clausola
- Report: clausole non conformi con percentuale gap, trend temporale
- Piano d'azione generato automaticamente da NC e OSS aperti
- Nota: SQL Server con colonne JSON e full-text search e sufficiente — no cambio DB

---

### Fase 5 — Workflow Implementazione SGQ (8-12 settimane)

**Obiettivo**: supportare un'azienda che vuole implementare (non solo auditare) un SGQ.

- Piano d'azione post-audit: task assegnabili con scadenza e responsabile
- Tracciamento avanzamento per clausola
- Dashboard progresso implementazione
- Notifiche milestone e scadenze

---

## 🏛️ Architettura Unificata della Piattaforma (decisione 05/04/2026)

### Scoperta fondamentale: le norme condividono la struttura HLS

ISO 9001, ISO 14001 e ISO 45001 sono costruite sulla stessa **High Level Structure (Annex SL)** — sezioni 4–10 identiche, contenuto diverso. Questo significa che lo stesso motore di checklist funziona per tutti e tre gli standard. ISO 3834 ha struttura diversa (specifica di processo) ma condivide le stesse entità fondamentali.

### 6 entità universali — Domain Model

Ogni sistema di gestione (qualunque norma) ruota attorno a queste 6 entità:

```
ORGANIZZAZIONE
    ├── ha REQUISITI (dalla norma) → verificati da AUDIT → producono RILIEVI
    ├── gestisce DOCUMENTI (§7.5) con versione, approvazione, scadenza
    ├── impiega PERSONE con QUALIFICHE (scadenza, norma di riferimento)
    ├── identifica RISCHI → definisce OBIETTIVI misurabili
    └── RILIEVI + RISCHI → generano AZIONI chiuse da EVIDENZE
```

### 3 Layer architetturali

```
LAYER 3 — UI (React): moduli specifici per scenario che usano componenti universali
           [AuditModule] [SALModule] [WeldingModule] [RDPModule]
           [DocumentBrowser] [AlertDashboard] [DataGrid] [ExportButton]

LAYER 2 — Dominio (Node.js): logica specifica per standard + motori trasversali
           AuditEngine | SALEngine | WeldingEngine | RDPEngine
           AlertEngine | ExportEngine | RAGEngine | ImportEngine

LAYER 1 — Core Platform (DB SQL Server): entità universali condivise
           organizations, standards, document_registry, personnel_qualifications,
           risks_register, objectives, actions, welding_procedures, wpqr_records, projects
```

### Nuove tabelle DB universali (da creare in Sprint A)

```sql
document_registry (
  id, company_id, standard_id, doc_type, doc_code, title,
  revision, status,            -- 'vigente'|'in_revisione'|'obsoleto'|'in_approvazione'
  issue_date, expiry_date,     -- semaforo alert: >60gg verde, 30-60 giallo, <30 rosso
  responsible, retention_years,
  attachment_id FK attachments,
  extraction_confidence DECIMAL(3,2),  -- 0.0-1.0 da AI import
  import_status                -- 'ai_draft'|'verified'|'active'
)

personnel_qualifications (
  id, company_id, person_name, person_id FK users NULL,
  qualification_type,          -- 'iso9606_1'|'iso9712_vt'|'iso14731_iwt'|'iso14732'
  certificate_number,
  standard_ref,                -- es. 'ISO 9606-1'
  welding_process,             -- es. '141' (TIG), '111' (elettrodo)
  material_group,              -- es. '1.1' (ISO/TR 15608)
  position_range,              -- es. 'PA PF'
  issue_date, expiry_date,
  issuing_body,
  attachment_id FK attachments,
  extraction_confidence DECIMAL(3,2),
  import_status
)

risks_register (
  id, company_id, standard_id, clause_ref,
  risk_type,                   -- 'risk'|'opportunity'
  description, context,
  probability INT,             -- 1-5
  impact INT,                  -- 1-5
  score AS (probability * impact),
  mitigation_action, owner, due_date, status
)

objectives (
  id, company_id, standard_id, clause_ref,
  description, target_value, unit, current_value,
  measurement_frequency, due_date, status, responsible
)

actions (
  id, company_id, standard_id,
  source_type,                 -- 'audit_nc'|'risk'|'sal_gap'|'incident'|'management_review'
  source_id,                   -- FK al record sorgente
  description, responsible, due_date,
  status,                      -- 'aperta'|'in_corso'|'verificata'|'chiusa'
  evidence_text, attachment_id FK attachments,
  created_at, closed_at
)

-- Specifiche ISO 3834
welding_procedures (           -- WPS
  id, company_id, wps_code, revision,
  welding_process,             -- codice ISO 4063 (es. 141, 111, 135)
  material_group,              -- ISO/TR 15608
  filler_material, shielding_gas,
  joint_type, position,
  thickness_range_min, thickness_range_max,
  preheat_temp, interpass_temp, pwht,
  qualification_standard,      -- es. 'ISO 15614-1'
  status, attachment_id
)

wpqr_records (                 -- WPQR collegato a WPS
  id, wps_id FK welding_procedures,
  wpqr_code, test_date, issuing_body,
  vt_result, rt_result, ut_result, mt_result, pt_result,
  tensile_result, bend_result, impact_result, hardness_result,
  validity_range_description,
  expiry_date NULL,
  attachment_id
)

projects (                     -- Commesse ISO 3834
  id, company_id, project_code, client_name, client_company_id FK companies NULL,
  description, start_date, end_date,
  applicable_wps_ids,          -- JSON array di wps ids
  status,                      -- 'offerta'|'in_corso'|'completato'|'archiviato'
  requirements_review_date, technical_review_date
)
```

### Pipeline di importazione documentale assistita da AI

Ogni documento normativo ha struttura definita dalla norma → estrazione deterministica:

```
PDF upload (batch) → rilevamento tipo documento → estrazione testo (pdf-parse / OCR)
  → LLM extraction con schema Zod → preview con confidence score per campo
  → validazione utente (campi incerti in giallo) → commit in DB + alert engine aggiornato
```

**Tipi documento supportati (con schema di estrazione noto):**

| Tipo | Norma | Campi chiave estratti |
|---|---|---|
| Patentino saldatore | ISO 9606-1 | nome, processo, gruppo mat., posizione, scadenza |
| Qualifica operatore | ISO 14732 | nome, processo, scadenza |
| Cert. NDT | ISO 9712 | nome, metodo (VT/MT/PT/UT/RT), livello (1/2/3), scadenza |
| WPS | ISO 15609-1 | codice, processo, materiale, posizione, parametri |
| WPQR | ISO 15614-1 | riferimento WPS, prove eseguite, range validità |
| Dichiarazione CE macchine | Dir. 2006/42/CE | modello, S/N, direttive, scadenza verifica |
| Cert. taratura strumento | ISO 17662 | strumento, valore, incertezza, scadenza |

**Regola AI-import**: ogni record importato ha `import_status = 'ai_draft'` fino a conferma umana. Solo record `'verified'` o `'active'` appaiono negli elenchi ufficiali e nelle esportazioni per enti certificatori.

---

### Piano Sprint — da avviare dalla prossima sessione

| Sprint | Contenuto | Output concreto | Stima |
|---|---|---|---|
| **A — Core Foundation** | Migration tabelle universali + API CRUD + `<DataGrid />` con export Excel | Struttura DB e griglia dati funzionante per tutti i moduli | 1 settimana |
| **B — Alert Engine + Document Browser** | Cron job backend + Nodemailer + `<DocumentBrowser />` navigazione cartelle | Notifiche email scadenze + esplorazione documenti per tipo | 1 settimana |
| **C — Modulo SAL** | SAL tracker requisiti × stati + Word export SAL + colori standard | Camellini può fare SAL digitale per ISO 9001/14001/45001 | 1-2 settimane |
| **D — Modulo Welding (ISO 3834)** | WPS/WPQR registry + qualifiche saldatori con alert + gestione commesse | Mason ha il registro completo ISO 3834 con scadenze | 2 settimane |
| **E — AI Import Pipeline** | Upload batch PDF + LLM extraction + preview validazione | Import massivo patentini, WPS, WPQR, dichiarazioni CE | 1-2 settimane |
| **F — RAG** | Indicizzazione vettoriale documenti + norm_excerpt + ricerca semantica | Ricerca "trova tutte le NC legate a clausola 8.4" | dopo Sprint E |

**Regola di sequenza**: ogni sprint è indipendente e consegna valore, ma A è prerequisito di tutti. B è prerequisito di C e D. E è prerequisito di F.

---

## Note Architetturali Permanenti

| Decisione | Motivazione |
|---|---|
| `fetchAttachmentBlob()` non img src | Browser non invia Authorization header cross-origin su :8443 |
| conformity_status trigger: NC/OSS/NV | OM escluso: e osservazione minore, non rilievo persistente |
| section_code non clause_number | Colonna reale in checklist_questions |
| Backend su systemd | Restart: `systemctl restart sgq-backend` — NON fuser da solo |
| Dark launch per nuove feature | Auditor ricevono feature solo quando collaudate — zero interruzioni |
| client_name → company_id FK (Fase 1) | Retrocompatibilita: campo nullable, migrazione graduale |
| SQL Server sufficiente per gap analysis | JSON columns + full-text search — no cambio tecnologia DB |
| **Stili Word in italiano** | Template usa Titolo1/Titolo2 — NON Heading1/Heading2 (Word italiano) |
| **Margini Word via JS** | Regex su sectPr in injectOoxmlMarkers — evita manipolazione binaria .docx |
| **document_type in audits** | Campo per distinguere audit/SAL/RDP — retrocompatibile (default='audit') |
| **Audit Scenario 2 (terza parte)** | Gestito con clauseRef + campo note — no checklist per ogni committente |
| **norm_excerpt in checklist_questions** | Stralcio norma per ogni clausola — appare nel report Word sotto la valutazione |

---

## 🏛️ VISION VINCOLANTE — Decisione strategica 08/04/2026

> Questa sezione è **congelata**. Le decisioni qui riportate non si riaprono.
> Ogni modifica richiede approvazione esplicita del product owner.

### Modello di business definitivo

```
QS Studio (superadmin — proprietari della piattaforma)
│
├── Auditor/Consulente  (es. Camellini, Mason — WRITE su tutto)
│   │  Pagano per ogni azienda che gestiscono
│   │  Possono essere: auditor puri, consulenti implementazione, coordinatori saldatura
│   │
│   ├── Azienda A  (cliente — può acquistare moduli in autonomia, ha WRITE sui propri dati)
│   ├── Azienda B
│   └── Azienda C
│
└── Azienda autonoma  (acquista direttamente — gestisce da sola con write completo)
```

**Fatturazione**: per azienda attiva nell'archivio (= ha dati + occupa spazio server).  
Un auditor che gestisce 10 aziende → 10 licenze. Prezzo varia per modulo attivato.

**Modulo Reclami**: i reclami e le NC li inserisce **l'azienda** che acquista il modulo (non solo il consulente).

### Strategia Mobile / Desktop

| Dispositivo | Attività | Moduli accessibili |
|---|---|---|
| **Mobile Android (PWA)** | Campo: audit, ispezioni VT/MT/PT, foto, checklist offline | Audit, Alert (sola lettura), Documenti (sola consultazione) |
| **Tablet** | Audit con più spazio, consultazione documenti in cantiere | Audit + consultazione |
| **Desktop** | Gestione documentale, form, report, configurazione | Tutti i moduli |

**Regola progettuale**: le schermate di gestione dati (form, tabelle complesse, configurazione) sono **desktop-first**. Il mobile rimane ottimizzato per il **campo**.

### Architettura UI — Navigation Foundation

- **React Router v6**: URL semantici, deep linking, back button browser
- **Layout fisso**: sidebar sinistra su desktop (240px), bottom navigation su mobile (5 voci)
- **Home Dashboard**: "Cosa fare oggi" — alert scadenze, NC aperte, prossimi audit
- **Feature flags**: ogni modulo ha un flag di licenza. Se non attivo → schermata `<ModuleLocked />`

### Moduli licenziabili

| Modulo | Target | Contenuto |
|---|---|---|
| **AUDIT** | Auditor / Consulenti | Audit ISO 9001/14001/45001, checklist, NC, report Word |
| **SGQ** | Aziende / Consulenti | Documenti, Qualifiche, Rischi, Obiettivi, Azioni, SAL |
| **RECLAMI** | Aziende | Reclami clienti (inserimento da azienda), NC interne, follow-up |
| **SALDATURA** | Coordinatori / Aziende | WPS/WPQR, qualifiche saldatori, NDT, commesse ISO 3834 |
| **ALERT** | Incluso in tutti | Email automatiche scadenze, dashboard semaforo |
| **AI** | Add-on futuro | Import batch PDF, estrazione dati, ricerca semantica |

### Roadmap Sprint definitiva

| Sprint | Nome | Contenuto | Prerequisito |
|---|---|---|---|
| **0** | Navigation Foundation | React Router v6, sidebar, home dashboard, ModuleLocked | — |
| **1** | Document Registry UX | Redesign UX (vista Priorità, wizard form, export Excel) | Sprint 0 |
| **2** | Qualifiche + Alert Engine | Personnel qualifications, cron email scadenze | Sprint 0 |
| **3** | NC & Azioni Correttive | Loop audit→azione→verifica, workflow status | Sprint 0 |
| **4** | SAL (Riesame Direzione) | Griglia requisiti×stati, report Word verbale | Sprint 3 |
| **5** | Saldatura ISO 3834 | WPS/WPQR, qualifiche saldatori, commesse | Sprint 2 |
| **6** | Rischi + Obiettivi | Risk register §6.1, obiettivi §6.2 | Sprint 3 |
| **7** | Reclami + Fornitori | Reclami clienti, valutazione fornitori | Sprint 3 |
| **8** | Licensing Engine | Feature flags, pannello abbonamenti, UI locked | Sprint 0 |
| **9** | AI Import Pipeline | OCR+LLM batch PDF, confidence score, revisione umana | Sprint 1 |

### Copertura normativa per modulo SGQ

| Norma | Requisiti coperti dal modulo SGQ |
|---|---|
| ISO 9001:2015 | §7.5 Documenti, §7.2 Competenze, §8.7+§10.2 NC/Azioni, §8.2.1 Reclami, §8.4 Fornitori, §9.1 Monitoraggio, §9.3 Riesame, §6.1 Rischi, §6.2 Obiettivi |
| ISO 14001:2015 | + Aspetti ambientali, Obblighi conformità, Piani emergenza, Monitoraggio ambientale |
| ISO 45001:2018 | + Identificazione pericoli, Incidenti/infortuni, Valutazione rischi H&S |
| ISO 3834 | Modulo Saldatura separato: WPS/WPQR, Qualifiche 9606/9712, Commesse, Trattamenti termici |

---

**Ultimo Aggiornamento**: 11 aprile 2026
**Prossimo Step**: Sprint 10 — Estensioni import (OCR opzionale, classificazione record) oppure Fase 0.4 `norm_excerpt` (vedi tabella fasi).

> Sprint 0-9: Sprint 9 (Import batch PDF: job `import_jobs` / `import_job_files`, estrazione testo locale `pdf-parse`, confidence euristica, revisione umana, licenza `ai_import`, UI `/settings/import-jobs`) senza API esterne LLM. Migrazione `038` su VPS + `npm install` backend per `pdf-parse`.
