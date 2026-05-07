# Roadmap — Sistema Gestione ISO 9001 / SaaS Multi-Tenant

> **Data Inizio**: 13 gennaio 2026
> **Ultimo Aggiornamento**: 7 maggio 2026
> **Prossimo Step**: Sessione 07/05 — S-A1÷S-A6 tutti ✅. Conflitti Git irrisolti rimossi (build bloccata), S-A6 Opzione C implementata (stub NC→modulo), `updateAuditMetrics` ISO+custom, route `createNonConformity` corretta. **Prossime priorità**: (1) Smoke Mason ISO 3834 (passi 6-7 smoke L3); (2) Smoke Word export Camellini audit reale; (3) ISO 14001 checklist completa da norma PDF (P4); (4) SMTP Alert Engine VPS (variabili env).
> **Backlog**: Sezione 11 "Esito Audit" non aggrega risposte custom | Tabella "Rilievi Emersi" Word: aggiungere C e N.A. (da decidere con cliente) | ISO 14001 checklist completa (norma disponibile) | norm_excerpt nel report Word | SYNC-5 allegati offline | ✅ migration 048 applicata (temporal table custom_checklist_responses — prod 03/05/2026)
> **Riferimenti**: [docs/GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (esperienza operativa) | [docs/adr/ADR-006-auto-reconcile-cache-sync.md](adr/ADR-006-auto-reconcile-cache-sync.md) | [docs/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (schema DB)

> **Decisione prossima traccia documenti (aprile 2026)**: dopo chiusura smoke **0–3**, scegliere **una** traccia prioritaria — **Sprint 10** (ingest → staging → registry) se il valore commerciale immediato è il registro documenti; **`norm_excerpt`** (colonna + Word) se serve un miglioramento rapido sui report senza attendere lo staging completo. Le due tracce possono convivere solo se il product owner definisce ordine e capacità; altrimenti evitare doppio carico in parallelo sulla stessa sessione.

---

## Open points e memoria trasversale (non perdere il filo)

**Regola**: gli argomenti “aperti” che attraversano più sessioni vanno elencati **qui** (sintesi) e dettagliati nell’**ADR** o nel doc tecnico indicato. Le session AI devono leggere questa sezione + l’ADR collegato.

| Tema | Sintesi | Tracciamento |
|------|---------|----------------|
| **Logout vs lavoro solo locale** | Oggi: pulizia IndexedDB + sync queue al logout (`sgq:userLoggedOut`) per sicurezza multi-tenant → bozze non ancora sul server **a rischio** se l’utente esce senza sync. Serve gate + export / sync forzato (vedi ADR). | [ADR-007-logout-offline-backup-e-mirror-cartella-pc.md](adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) (**Proposto**) |
| **Mirror / cartella PC (backup bundle audit)** | Non attivo nel flusso principale (IndexedDB only, `storageAdapter.js`). Opzionale desktop in ADR Fase B. | Stesso **ADR-007** |
| **Menu audit vs RBAC** | **Frontend:** merge IndexedDB + `filterLocalAuditsAfterServerFetch`, logout svuota cache; remount menu (`AuditSelector`). **Backend (richiede deploy VPS):** `GET /audits` e dettaglio filtrano con `studioScopeClause` (`auditListRbac.service.js`); ruolo JWT normalizzato in `auth.middleware.js`; ruoli non previsti → vincolo `created_by` (mai lista org-wide implicita); `organization_id` sempre da `req.user` in `listAudits` / `getAuditById`. Test Jest: `auditListRbac.service.test.js`. | `StorageContext.jsx`, `AuditSelector.jsx`, `backend/src/services/auditListRbac.service.js`, `backend/src/middleware/auth.middleware.js`, `backend/src/controllers/audit.controller.js`; [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| **Disconnessione temporanea (non logout)** | Comportamento atteso: IndexedDB + coda; vedi doc dedicata. | [GESTIONE_PERDITA_CONNESSIONE.md](GESTIONE_PERDITA_CONNESSIONE.md) |

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
| **AuditSelector Q2+Q3** | Nascondi audit chiusi (default) + filtro azienda → audit; `auditsMenuKey` sul select audit | ✅ Completato (04/05/2026) |
| **Sync/API con UUID** | create/delete audit e custom-checklist-responses accettano UUID; merge preserva customChecklistId | ✅ Completato (15/03) |
| **Deploy backend VPS** | pscp/plink per controller, script deploy-controllers-to-vps.ps1 | ✅ Completato (15/03) |
| Export Word ISO 3834 | Da testare su produzione | 🔲 Da testare |
| **Foto embedded in Word** | pic:cNvPr id univoci per range separati (100+checklist ISO, 30000+custom, 88001+logo, 89001+logo org); fix già in produzione; checkbox UI "Incorpora foto" sempre visibile | ✅ Risolto (2026-04-23) |
| **Admin utenti (CRUD + standard)** | `UsersAdminPage`, API admin users; abbonamenti / piani | ✅ Core mar/2026; abbonamenti 🔲 |
| ISO 14001 checklist completa | Da norma PDF disponibile | 🔲 Prossima priorità |
| ISO 45001 checklist | Da norma PDF disponibile | 🔲 Backlog |
| Modulo SAL (Scenario 3) | Nuovo tipo documento per Camellini | 🔲 Backlog |
| Modulo RDP (Scenario 4) | Nuovo tipo documento per Mason — richiede foto embedded | 🔲 Backlog |
| Campo norm_excerpt | Stralcio norma nel report Word | 🔲 Backlog |

**Progress Overall**: ~85% funzionalità core Scenario 1 · **Macro piattaforma** (SaaS completo, registry documenti, sprint collegati): indicativo **~65%**

---

## Roadmap per Fasi

### Fase 0 — Chiusura bug minori e completamento Scenario 1 — PROSSIMA

| # | Task | File | Note |
|---|---|---|---|
| 0.1 | Test export Word ISO 9001 sommario | produzione | Verificare cap. 1→11, colonne, margini |
| 0.2 | ISO 14001 checklist da norma PDF | DB migration + `checklistTemplates.js` | Norma già disponibile e leggibile |
| 0.3 | ISO 45001 checklist da norma PDF | DB migration + `checklistTemplates.js` | Norma già disponibile e leggibile |
| 0.4 | Campo norm_excerpt in checklist_questions | DB + wordExportHelpers.js | Alto impatto, bassa complessità |
| 0.5 | Rilievi pendenti reali in Word | `ExportPanel.jsx`, `wordExport.js`, `wordExportHelpers.js` | ✅ Già implementato — `GET /audits/:id/pending-issues` + fallback `checkReaudit` in ExportPanel.jsx |
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

> ✅ **Bug foto embedded risolto (2026-04-23)**: Il codice di embedding (`xmlImageOoxml`) usa ora `imgId` univoci per range separati (100+ per checklist ISO, 30000+ per custom, 88001+ per logo azienda, 89001+ per logo organizzazione). `usePreview` e `preloadImagesIntoAudit` sono attivi. Il prerequisito per RDP è soddisfatto.

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
| **E — AI Import Pipeline** | **v1 in produzione**: upload batch + `pdf-parse` + confidence + revisione umana + **estrazione JSON OpenAI opzionale** su testo estratto (tabella sprint **9**). **Fasi successive**: staging tipizzato (sprint **10**), poi OCR e agenti multi-step / commit registry | Import massivo patentini, WPS, WPQR, dichiarazioni CE (progressivo) | v1 fatto; estensioni 1-2 settimane a slice |
| **F — RAG** | Indicizzazione vettoriale documenti + norm_excerpt + ricerca semantica | Ricerca "trova tutte le NC legate a clausola 8.4" | dopo registry + staging stabili |

**Regola di sequenza**: ogni sprint è indipendente e consegna valore, ma A è prerequisito di tutti. B è prerequisito di C e D. E (estensioni oltre v1) è prerequisito di F.

**Nota allineamento (11/04/2026)**: la tabella numerata **Sprint 0–11** in basso è la **fonte di verità** per naming e prerequisiti; questa tabella A–F resta come macro-fasi di prodotto.

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
| **AI** | Add-on | Import batch PDF (v1 testo locale), staging tipizzato (Sprint 10), ricerca semantica (backlog) |
| **Commesse / Riesame contratto** | Add-on futuro | Workflow riesame requisiti §8.2 (pilota “ordine diretto”): stati, checklist, allegati — vedi [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) |
| **Office Round-trip (beta)** | Auditor / Aziende (desktop) | Apertura Word/Excel desktop e salvataggio diretto su server via WebDAV/Helper custom — vedi [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md) |

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
| **9** | Import PDF **v1** (ingest + AI opzionale) | Job `import_jobs` / `import_job_files`, estrazione **testo locale** (`pdf-parse`), confidence euristica, revisione umana, licenza `ai_import`, UI `/settings/import-jobs`. **Analisi strutturata** (OpenAI JSON) su testo estratto: endpoint `POST .../files/:fileId/ai-extract`, migrazione **039**. **Fuori scope immediato**: OCR, agenti multi-tool, commit automatico in registry. Obiettivo: **fondazione ingest** + primo valore AI testabile in sicurezza (revisione umana). | Sprint 1 |
| **10** | Import staging → registry | Da job file a **record di staging tipizzati** (`document_type` / form registry), commit umano verso persistenza documenti. Estensioni: OCR opzionale, classificazione assistita **dopo** registry stabile. | Sprint 9 |
| **11** | Commesse / Riesame contratto | Modulo workflow §8.2 (pilota): stati, storico, checklist, allegati in/out; **separato** dalla sola pipeline PDF. Specifica: [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md). | Sprint 1, Sprint 10 (consigliato) |
| **12** | Office Round-trip (PoC) | Tool desktop-first per documenti SGQ: link Office URI + endpoint `webdav-link` + WebDAV (GET/PUT/PROPFIND/LOCK/UNLOCK) + lock/versioning baseline. Specifica: [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md). | Sprint 1 |

### Copertura normativa per modulo SGQ

| Norma | Requisiti coperti dal modulo SGQ |
|---|---|
| ISO 9001:2015 | §7.5 Documenti, §7.2 Competenze, §8.7+§10.2 NC/Azioni, §8.2.1 Reclami, §8.4 Fornitori, §9.1 Monitoraggio, §9.3 Riesame, §6.1 Rischi, §6.2 Obiettivi |
| ISO 14001:2015 | + Aspetti ambientali, Obblighi conformità, Piani emergenza, Monitoraggio ambientale |
| ISO 45001:2018 | + Identificazione pericoli, Incidenti/infortuni, Valutazione rischi H&S |
| ISO 3834 | Modulo Saldatura separato: WPS/WPQR, Qualifiche 9606/9712, Commesse, Trattamenti termici |

---

## Checklist sessioni — Licenze moduli, auth e allineamento API/UI

> Obiettivo: chiudere i gap tra **pannello licenze**, **menu/route frontend** e **middleware backend**; robustezza credenziali. Spuntare le voci a fine sessione. (Revisione tecnica 12/04/2026.)

**Test, DoD e smoke di release** (tutti i moduli, non solo licenze): piramide L1–L5, matrice manuale e Definition of Done in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) — sezione *Piano qualità: fasi di sviluppo e test di robustezza*.

### Sessione A — Sessione utente e licenze “a caldo”

- [x] Dopo `PATCH /admin/licenses`: aggiornare `user` nel client (`GET /auth/me` o merge risposta) senza richiedere login manuale all’admin che salva. *(Implementato: `refreshUser` in `AuthContext` + chiamata da `LicensesSettingsPage` dopo salvataggio — 2026-04-18.)*
- [x] Valutare propagazione agli altri utenti della stessa org (messaggio “riavvia sessione”, evento, o TTL breve token) — documentare scelta in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md). *(Scelta attuale: niente push real-time; messaggio in UI dopo salvataggio + riga guida tabella A — 2026-04-18.)*
- [ ] `POST /auth/refresh`: includere snapshot minimo (`licensed_modules`, `allowed_standard_ids`) **oppure** interceptor che chiama `/auth/me` dopo refresh riuscito.

### Sessione B — Enforcement backend coerente con il prodotto

- [ ] Allineare **alert** (`GET /alerts`, `GET /alerts/count`): `requireLicensedModule` appropriato (es. `documents`) **oppure** modulo `notifications` / chiave dedicata — allineato alla tabella `KNOWN_MODULE_KEYS`.
- [ ] Inventario route **solo `authenticate`**: custom-checklist, report-template, companies, sync, ecc. — decidere per ciascuna se resta inclusa nel modulo **audit** o merita `requireLicensedModule`.
- [ ] Verificare assenza di endpoint “sensibili” scoperti rispetto al contratto licenze (registro in tabella o ADR breve).

### Sessione C — UX e unicità codice frontend

- [ ] Centralizzare `hasLicensedModule` (un solo hook o util condiviso da `LicensedRoute` e `AppLayout`).
- [ ] Bottom nav mobile: nascondere o disabilitare voci verso moduli non licenziati (coerenza con sidebar).
- [x] Allineare `AuthContext.isAdmin()` a **admin + superadmin** se il context verrà usato per gating (oggi le pagine usano spesso il check inline). *(2026-04-18: `isAdmin()` include `superadmin`.)*

### Sessione D — Sicurezza credenziali e identità

- [ ] **JWT_SECRET** (e segreti analoghi): fail-fast in avvio se mancante in produzione; nessun default nel bundle/server pubblicato.
- [ ] Login con stessa **email su più organizzazioni**: obbligare `organization_id` o errore esplicito “account ambiguo” (no `recordset[0]` non deterministico).
- [ ] Endpoint **`register`**: policy produzione (disabilitato, solo invito, solo superadmin) — allineare a modello commerciale.

### Sessione E — Comportamento DB licenze (opzionale / hardening)

- [ ] Documentare esplicitamente **fail-open** (`licensed_modules` NULL / JSON invalido = tutti i moduli) in guida deploy; se serve modello più stringente: modalità deny-by-default dietro flag o colonna ambiente.

---

## Architettura utenti e segregazione (riferimento unico)

**Documento**: [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) — principi, livelli tenant→studio→azienda, catalogo ruoli, deleghe creazione utenti, scope per area, piano migrazione (fasi 0–4), DoD per modifiche RBAC.

**Da implementare in codice** (priorità quando si lavora su auth/audit): fix `auditorOrg.controller` (`isOrgWideAdmin` vs `isSuperadmin`); allineare write path audit/NC/allegati allo stesso scope della lista; servizio centralizzato `assert*` / `get*ScopeWhereClause` come da doc.

---

**Ultimo Aggiornamento**: 29 aprile 2026

### Sequenza priorità aggiornata (29 aprile 2026)

> **Priorità assoluta**: robustezza sync dati — nessuna perdita di lavoro in qualsiasi condizione di rete. Motivazione: bug Camellini 28/04/2026 (risposte checklist e testi mai sincronizzati per lock oscillante su rete mobile). L'affidabilità dell'app professionale viene prima di qualsiasi nuova funzionalità.

| # | Task | Modalità | Stato |
|---|---|---|---|
| P0 | 5 bug Camellini ISO 9001 (accordion, race condition, domande mancanti, audit sparisce) | Deputy | ✅ Chiuso |
| P1 | Custom checklist outcome buttons (C/OSS/NC/OM/NV/NA su flag) — migrazione 043, VPS, merge `e1f3c5b` | Deputy | ✅ Completato — Smoke L3 umano da fare |
| P2 | Sicurezza credenziali: JWT_SECRET fail-fast, login email ambiguo, register prod | Sessione D | ✅ Completato |
| Bug | Audit cancellati non ricompaiono nel menu dropdown (StorageContext.jsx + recentlyDeletedRef) | Fix mirato | ✅ Completato |
| Bug | LOCK-* audit ricomparivano tra device — isIntentionalDraft + forceClearLocalCache | Fix mirato | ✅ Completato (24/04) |
| P3 | **Sprint 0–9** — Navigation, Registry, Alert, Notifiche, Qualifiche, NC, Rischi, Reclami, Licensing, Import PDF | Multi-sessione | ✅ Tutti completati |
| **🔴 SYNC-1** | **save_responses indipendente dal lock** — risposte checklist sempre accodate (bug Camellini) | Fix mirato | ✅ Completato (29/04) — PR #18 — deploy necessario |
| **🔴 SYNC-2** | **Conflict resolution campo per campo** — testi/note non scartati da server-wins su updated_at | Fix mirato | ✅ Completato (29/04) — PR #19 — deploy VPS fatto |
| **🔴 SYNC-3** | **Banner merge dati** — `SyncMergeBanner` avvisa quando il backend applica field-level merge | Fix mirato | ✅ Completato (29/04) — solo frontend, Netlify |
| **🔴 SYNC-4** | **Guard logout con modal React** — `LogoutSyncGuard` con attesa sync, spinner, 3 opzioni | ADR-007 | ✅ Completato (29/04) — solo frontend, Netlify |
| **🟡 SYNC-5** | **Upload allegati offline** — blob in IndexedDB → upload automatico al reconnect | SyncService v3 | ⏳ Backlog attivo |
| **🔴 T0** | **Staging environment** — DB separato + dati anonimi. Valutato: **non necessario** per T1-T2 (migrazioni additive). Da rivalutare per T3. | Infra | ✅ Saltato (decisione 29/04) |
| **🔴 T1** | **Temporal tables** su `audit_responses` + `audits` — storicizzazione automatica nativa SQL Server | DB migration | ✅ Completato (29/04/2026) — migration 045, backup pre-T1 ok |
| **🔴 T2** | **Event store** + tabella `audit_events` + endpoint `POST /audits/:uuid/events` + idempotency | Backend | ✅ Completato (30/04/2026) — migration 046, deploy VPS, smoke OK |
| **🔴 T3** | **Frontend event-based** per `save_responses` — ogni risposta = evento atomico (feature flag) | Frontend | ✅ Completato + Smoke L3 ✅ (01/05/2026) — status + note multi-device verificati su prod, `VITE_SYNC_MODE=events` attivo |
| **🔴 T4** | **Frontend event-based** per campi ricchi — `field_updated` con debounce 500ms | Frontend | ✅ Completato (01/05/2026) — generalData/auditObjective/auditOutcome/notes con debounce 500ms |
| **🔴 T5** | **Lock opzionale** — rimuove lock come prerequisito scrittura; lock solo UX informativo | Full-stack | ✅ Completato (01/05/2026) — assertWriteAllowed rimosso da audit/response/customChecklist/attachment controller |
| **🔴 T6** | **Recovery UI + history API** + compaction job notturno — compliance ISO 9001 §7.5 | Full-stack | ⏳ Dopo T5 |
| P4 | ISO 14001 checklist completa da norma PDF | Deputy | Backlog — dopo SYNC-3 |
| P5 | Deputy Mason: dropdown seconda parte + foto Word OOXML fix | Deputy | In corso (DEPUTYTASK.md) |
| P6 | **Sprint 10** - Ingest PDF → staging → document registry (commit umano) | Agente | ✅ Completato (03/05/2026) - commit `939af59` |
| P7 | Sprint 11 — Riesame contratto / commesse | Backlog | Dipende Sprint 10 |
| P8 | Sprint 12 — Office Round-trip WebDAV (PoC) | Backlog parallelo | [`agent-tasks/TASK_SPRINT12_WEBDAV_PARALLEL.md`](agent-tasks/TASK_SPRINT12_WEBDAV_PARALLEL.md) |
| **S-A1** | **Gate read-only UI** — banner + disabilitazione tutti i controlli per audit `completed`/`approved`/`archived` | Deputy (04/05/2026) | ✅ Completato |
| **S-A2** | **Policy API `AUDIT_READ_ONLY`** — guard HTTP 403 su `saveResponse`, `bulkSaveResponses`, `updateAudit`; stall permanente in syncService | Deputy (04/05/2026) | ✅ Completato |
| **S-A3** | **ClosePanel custom completion** — blocco chiusura audit solo-custom senza risposte | Deputy (04/05/2026) | ✅ Completato |
| **S-A4** | **Pending deep-link** — ordinamento NC→OSS→NV, zero-state esplicito, pulsante "Vai alla domanda" con scroll accordion | Deputy (06/05/2026) | ✅ Completato |
| **S-A5** | **Preserva pendingIssues al reconcile** — Eccezione 7 in `StorageContext.reconcileAuditsFromServer`: locale non azzerato a ogni fetch | Deputy (05/05/2026) | ✅ Completato |
| **S-A6** | **NC audit vs modulo NC** — Opzione C implementata: pulsante "Registra nel modulo NC" in `NonConformitiesManager`. Route `apiService.createNonConformity` corretta. Conflitti Git irrisolti rimossi. `updateAuditMetrics` somma ISO+custom. | Deputy (07/05/2026) | ✅ Completato |

**Prossimo Step**: Sprint sync chiuso — SYNC-1/2/3/4 ✅, T1 ✅, T2 ✅, T3 ✅ (30/04/2026). `VITE_SYNC_MODE=legacy` default — nessuna variazione comportamento produzione. Smoke L3 umano con flag `events` da pianificare. **Nota infra**: `run-migration-agent.sh` non raggiunge il DB direttamente da cloud (DNS); le migrazioni vanno eseguite via SSH sul VPS (che ha accesso diretto). Documentare in ACCESSO_DEPLOY_AGENTS.md.

> **Regola architetturale da ADR-008 (vincolante)**: ogni nuova feature che tocca la sincronizzazione dati deve essere progettata compatibile con il modello event-based. Nessun nuovo endpoint che accetti "stato corrente intero" senza event log parallelo.

#### Smoke L3 manuale P1 — checklist (utente, produzione)

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 1 | Login Camellini | ✅ | 03/05/2026 | JWT + org 1002 |
| 2 | Crea/apri checklist "Test Smoke L3" con flag "Abilita valutazione" | ✅ | 03/05/2026 | has_outcome_buttons: true, pulsanti visibili |
| 3 | Aprila da dentro audit MSN-260503-01 (custom_checklist_id: 13) | ✅ | 03/05/2026 | |
| 4 | Click C su domanda 1.1 → UI verde, auto-save | ✅ | 03/05/2026 | |
| 5 | Reload F5 → esito "C" persistito sul server | ✅ | 03/05/2026 | |
| 6 | Export Word — tabella checklist colori corretti | ⚠️ | 03/05/2026 | Pulsante presente; download bloccato da sezioni obbligatorie vuote — comportamento corretto |
| 7 | Riepilogo Word — contatori NC/OSS/OM/NV | ⏳ | — | Rinviato a smoke su audit reale Camellini compilato |

> **Sprint 9 (implementato / ingest v1 + AI strutturata opzionale)**: come sopra; analisi campi con **OpenAI** solo se `OPENAI_API_KEY` configurata (altrimenti 503). Deploy: migrazioni `038` + `039`, `npm install` backend (`pdf-parse`).  
> **Sprint 10 (implementato — 03/05/2026)**: collegare ingest v1 al **document registry** tramite staging tipizzato e commit esplicito (non confusione con workflow contratti).  
> **Sprint 11 (backlog)**: riesame requisiti contratto / ciclo commerciale — vedi [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md).
> **Sprint 12 (nuovo backlog tecnico)**: Office Round-trip editing desktop (Windows + Office) con infrastruttura nostra WebDAV/Helper — vedi [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md).


