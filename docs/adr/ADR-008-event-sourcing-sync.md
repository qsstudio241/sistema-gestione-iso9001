# ADR-008 — Event-Sourced Sync: architettura target per robustezza e compliance

> **Stato**: Accettato — 29 aprile 2026  
> **Autori**: Lead architect (AI), Product owner  
> **Sostituisce parzialmente**: ADR-002 (offline-first sync), ADR-003 (bidirectional sync), ADR-006 (auto-reconcile)  
> **Decisione vincolante**: questa architettura è il target di lungo termine. Ogni nuova feature che tocca la sincronizzazione dei dati deve essere progettata in modo compatibile con questo modello.

---

## Contesto e motivazione

### Il problema che ha innescato questa decisione

Il 28 aprile 2026, l'utente `marcocamellini@gmail.com` ha perso ore di lavoro su un audit (MSN-260428-01, cliente SIR) a causa di un bug nel meccanismo di sincronizzazione. L'indagine post-mortem ha identificato la causa radice:

**Il sistema inviava lo stato corrente dell'intero audit come payload unico** (`update_audit`). Questo approccio è intrinsecamente fragile per tre motivi:

1. Il lock heartbeat aggiornava `updated_at` sul server → il server considerava il client "obsoleto" → rifiutava il payload con 409 → i dati locali venivano scartati silenziosamente.
2. La guard del lock bloccava l'enqueue delle risposte checklist (`save_responses`) ogni volta che il lock oscillava su rete mobile instabile.
3. Non c'era nessuna storia delle modifiche: una volta perso un dato, era irrecuperabile.

I fix SYNC-1/2/3/4 (29/04/2026) hanno risolto il problema immediato, ma rappresentano workaround a una debolezza strutturale dell'architettura corrente.

### Confronto con i competitor

Analisi delle architetture di sync dei prodotti leader nel mobile audit management e nel SaaS qualità:

| Prodotto | Approccio sync | Conflict resolution | History |
|---|---|---|---|
| **iAuditor (SafetyCulture)** | Event-level (risposta singola) | Append-only, no conflicts | Completo per clausola §7.5 |
| **Linear** | Event sourcing puro | Tutti gli eventi accettati | Completo |
| **MasterControl** | Temporal data + audit trail | Server-side merge per campo | Completo, FDA 21 CFR Part 11 |
| **Intelex** | Versioning per record | Snapshot + delta | Completo, ISO 9001 §7.5 |
| **Nostro sistema (pre-fix)** | Stato intero per sync | Server-wins timestamp | Nessuna |
| **Nostro sistema (post SYNC-1/4)** | Stato intero + field-merge | Field-level merge | Nessuna |
| **Target (ADR-008)** | Event per campo atomico | Append-only, no conflicts | Completa, queryable |

### Requisiti normativi

ISO 9001:2015 §7.5.2 richiede che le informazioni documentate siano soggette a controllo che garantisca: disponibilità, idoneità all'uso, protezione adeguata. ISO 9001:2015 §7.5.3 richiede la gestione delle modifiche alle informazioni documentate con tracciabilità di chi ha modificato cosa e quando.

L'event sourcing soddisfa questi requisiti **per costruzione**, non come feature aggiuntiva.

---

## Decisione

### Architettura target: Event-Sourced Sync

Ogni modifica a un campo di un audit produce un **evento immutabile** persistito in un event store append-only. Lo stato corrente è sempre derivabile dalla riduzione di tutti gli eventi. Nessun evento viene mai sovrascritto o eliminato nella finestra di retention attiva.

#### Principi non negoziabili

1. **Immutabilità**: ogni evento inserito nell'event store non viene mai modificato né cancellato durante il periodo di retention.
2. **Idempotenza**: ogni evento porta una `idempotency_key` UUID generata dal client e persistita in IndexedDB. La stessa operazione inviata N volte produce un solo evento sul server.
3. **Nessun conflict by design**: il server accetta sempre tutti gli eventi. Non esiste "server-wins" perché non c'è mai uno stato da sovrascrivere — solo eventi da appendere.
4. **Backward compatibility**: il vecchio endpoint `/audits/sync` rimane attivo per tutta la durata della transizione. I client non aggiornati non si rompono mai.
5. **Lock opzionale**: il lock pessimistico diventa pura funzionalità UX (avvisare che un altro utente sta lavorando). Non è mai un prerequisito per la scrittura.

#### Schema dell'event store (SQL Server)

```sql
CREATE TABLE audit_events (
    event_id         BIGINT IDENTITY(1,1) NOT NULL,
    event_uuid       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    audit_id         INT NOT NULL,
    audit_uuid       UNIQUEIDENTIFIER NOT NULL,
    event_type       NVARCHAR(50) NOT NULL,
    field_path       NVARCHAR(200) NULL,
    old_value        NVARCHAR(MAX) NULL,
    new_value        NVARCHAR(MAX) NULL,
    user_id          INT NOT NULL,
    device_type      NVARCHAR(20) NULL,
    client_ts        DATETIME2(7) NOT NULL,
    client_ts_offset_ms INT NOT NULL DEFAULT 0,
    server_ts        DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    idempotency_key  UNIQUEIDENTIFIER NOT NULL,
    sync_batch_id    UNIQUEIDENTIFIER NULL,
    organization_id  INT NOT NULL,
    CONSTRAINT PK_audit_events PRIMARY KEY CLUSTERED (event_id),
    CONSTRAINT UQ_audit_events_idempotency UNIQUE (idempotency_key),
    CONSTRAINT FK_audit_events_audit FOREIGN KEY (audit_id) REFERENCES audits(audit_id),
    CONSTRAINT FK_audit_events_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT CK_audit_events_type CHECK (event_type IN (
        'audit_created', 'audit_status_changed',
        'response_set', 'response_cleared',
        'field_updated',
        'attachment_added', 'attachment_removed',
        'custom_response_set'
    ))
);

CREATE INDEX IX_audit_events_audit_ts   ON audit_events (audit_id, client_ts);
CREATE INDEX IX_audit_events_audit_uuid ON audit_events (audit_uuid, client_ts);
CREATE INDEX IX_audit_events_user_ts    ON audit_events (user_id, server_ts);
CREATE INDEX IX_audit_events_org        ON audit_events (organization_id, server_ts);
```

#### Temporal tables (SQL Server native)

```sql
-- audit_responses: storicizzazione automatica a costo zero
ALTER TABLE audit_responses ADD
    ValidFrom DATETIME2(7) GENERATED ALWAYS AS ROW START HIDDEN,
    ValidTo   DATETIME2(7) GENERATED ALWAYS AS ROW END HIDDEN,
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
ALTER TABLE audit_responses
    SET (SYSTEM_VERSIONING = ON (
        HISTORY_TABLE = dbo.audit_responses_history,
        DATA_CONSISTENCY_CHECK = ON
    ));

-- audits: stesso trattamento
ALTER TABLE audits ADD
    ValidFrom DATETIME2(7) GENERATED ALWAYS AS ROW START HIDDEN,
    ValidTo   DATETIME2(7) GENERATED ALWAYS AS ROW END HIDDEN,
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
ALTER TABLE audits
    SET (SYSTEM_VERSIONING = ON (
        HISTORY_TABLE = dbo.audits_history,
        DATA_CONSISTENCY_CHECK = ON
    ));
```

#### Tipi di evento e payload

| event_type | field_path esempio | new_value esempio |
|---|---|---|
| `audit_created` | null | `{"audit_number":"MSN-260428-01","client_name":"SIR"}` |
| `response_set` | `responses.87` | `{"conformity_status":"NC","notes":"Procedura non applicata"}` |
| `response_cleared` | `responses.87` | null |
| `field_updated` | `generalData.conclusions` | `"Testo conclusioni..."` |
| `field_updated` | `notes` | `"Nota auditor"` |
| `field_updated` | `auditObjective.description` | `"Verifica SGQ §4"` |
| `status_changed` | `status` | `"in_progress"` |
| `attachment_added` | `attachments` | `{"attachment_id":77,"file_name":"foto.jpg"}` |

#### Gestione skew orologi

Al login, il server include `server_ts` nella risposta di `/auth/me`. Il client calcola:
```js
const clockOffset = Date.now() - new Date(serverTs).getTime();
// Persiste in localStorage: 'sgq_clock_offset'
```
Ogni evento generato dal client usa: `client_ts = new Date(Date.now() - clockOffset)`.

#### Tiebreaker per eventi contemporanei

Quando `client_ts` di due eventi è identico o entro 1 secondo:
1. `server_ts` (ordine di ricezione sul server)
2. `user_id` (deterministico, non arbitrario)

Questo garantisce convergenza identica su tutti i nodi.

#### Snapshot e compaction

Ogni 24h un job server crea uno snapshot dell'audit e marca tutti gli eventi precedenti come "compactable". Gli eventi più vecchi di 365 giorni vengono archiviati in `audit_events_archive` (stessa struttura, storage cold). Il record dell'evento rimane con i campi testuali anonimizzati (GDPR) ma i metadati (chi, quando, tipo) vengono conservati per 10 anni (requisito ISO 9001 §7.5 retention).

---

## Impatto sui sistemi esistenti

### Cosa NON cambia

- Tabella `audits`: stessa struttura, aggiunta temporal table (backward compatible)
- Tabella `audit_responses`: stessa struttura, aggiunta temporal table (backward compatible)
- Endpoint `POST /audits/sync`: rimane attivo per tutta la transizione
- Frontend: il vecchio codice continua a funzionare (feature flag)
- Lock pessimistico: rimane come UX, non come guard obbligatoria

### Cosa cambia progressivamente

- Aggiunta di `audit_events` (nuova tabella)
- Nuovo endpoint `POST /audits/:uuid/events`
- Frontend: ogni campo genera evento atomico (T3-T4, con feature flag)
- Lock: da prerequisito a opzionale (T5, dopo T3-T4 stabili)

---

## Piano di implementazione (Sprint T1–T6)

> **Regola**: ogni sprint è committabile indipendentemente. Nessuno sprint rompe il sistema corrente. Ogni sprint ha una procedura di rollback documentata.

### T1 — Temporal tables + migration DB ✅ COMPLETATO (29/04/2026)

**Obiettivo**: storicizzazione automatica di `audit_responses` e `audits` senza toccare codice applicativo.

**Prerequisito staging**: rivalutato il 29/04/2026 — gli audit presenti sono test/sviluppo, le anagrafiche (utenti, aziende, checklist, template) sono reali ma non toccate dalla migrazione. Il backup DB pre-migrazione (`SGQ_ISO9001_pre_T1_2026-04-29_13_06.bak`, 20MB) è sufficiente come rete di sicurezza. Staging formale da rivalutare prima di T3.

**Eseguito**: migrazione `045_temporal_tables_T1.sql` — SQL Server 2025 Enterprise, history tables create, verificate, L1 90/90 green, health API OK post-migrazione.

**File coinvolti**: solo `database/migrations/`

**Test L1**: automatici — verifica che le query esistenti funzionino invariate dopo la migrazione.

**Test L1 automatici**: ✅ 90/90 — nessuna regressione post-migrazione (29/04/2026)

**Test L2 (verifiche DB)**:
- ✅ `audit_responses` e `audits` — `temporal_type = SYSTEM_VERSIONED`
- ✅ `ValidFrom`/`ValidTo` nascoste (non appaiono in `SELECT *`)
- ✅ `audit_responses_history` e `audits_history` create e attive
- ✅ UPDATE genera righe in history (verificato: 2 righe in `audit_responses_history`, 6 in `audits_history`)
- ✅ Health API post-migrazione: `{"status":"healthy","database":{"healthy":true}}`

**Test L3 (smoke umano) — ✅ COMPLETATO (29/04/2026)**:
- [x] Login account admin su produzione
- [x] Apri audit — modifica risposta checklist
- [x] Chiusura e rientro nell'audit
- [x] Risposta persistente ✅
- Esecutore: product owner — dispositivo: PC desktop
- Note: account `admin@sgq.local` (superadmin). Comportamento identico per tutti gli utenti — temporal table è su `audit_responses`, condivisa cross-account.

**Rollback (se necessario)**:
```sql
ALTER TABLE audit_responses SET (SYSTEM_VERSIONING = OFF);
ALTER TABLE audit_responses DROP PERIOD FOR SYSTEM_TIME;
ALTER TABLE audit_responses DROP COLUMN ValidFrom, ValidTo;
DROP TABLE IF EXISTS dbo.audit_responses_history;
ALTER TABLE audits SET (SYSTEM_VERSIONING = OFF);
ALTER TABLE audits DROP PERIOD FOR SYSTEM_TIME;
ALTER TABLE audits DROP COLUMN ValidFrom, ValidTo;
DROP TABLE IF EXISTS dbo.audits_history;
```

---

### T2 — Event store + endpoint /events

**Obiettivo**: tabella `audit_events` attiva. Endpoint `POST /audits/:uuid/events` accetta eventi e li persiste. Il vecchio `/sync` continua a funzionare.

**Prerequisito**: T1 completato e stabile in produzione per almeno 48h.

**File coinvolti**: `database/migrations/`, `backend/src/controllers/`, `backend/src/routes/`

**Test L1**: Jest — verifica idempotency key, accettazione batch, rifiuto eventi con org_id diverso.

**Test L2**: script di carico — invia 1000 eventi per audit, verifica che tutti siano presenti e che le query di stato siano invariate.

**Test L3 (smoke umano)**:
- [ ] Invia manualmente un batch di eventi via Postman/curl
- [ ] Verifica record in `audit_events` con `SELECT * FROM audit_events WHERE audit_uuid = '...'`
- [ ] Invia lo stesso batch di nuovo — verifica che `skipped = N` (idempotency)
- [ ] Verifica che `/audits/sync` funzioni ancora normalmente

**Rollback**: disabilita route `/events` con `router.use('/events', (req,res) => res.status(503).json({code:'FEATURE_DISABLED'}))`

---

### T3 — Frontend: save_responses → eventi granulari

**Obiettivo**: ogni risposta checklist genera un evento `response_set` atomico anziché un batch dell'intero audit. Feature flag `VITE_SYNC_MODE`.

**Prerequisito**: T2 in produzione stabile per almeno 1 settimana.

**File coinvolti**: `app/src/services/syncService.js`, `app/src/contexts/StorageContext.jsx`, `app/src/.env`

**Feature flag**: `VITE_SYNC_MODE=events` attiva il nuovo percorso. Default: `legacy`. Il flag si può cambiare su Netlify senza push di codice.

**Test L1**: Vitest — verifica che ogni modifica di risposta produca esattamente 1 evento con idempotency_key univoco e field_path corretto.

**Test L3 (smoke umano — da fare con feature flag attivo)**:
- [ ] Attiva `VITE_SYNC_MODE=events` su Netlify
- [ ] Login Camellini su mobile
- [ ] Compila 5 risposte C/NC/OSS
- [ ] Vai offline (modalità aereo)
- [ ] Compila altre 3 risposte
- [ ] Torna online
- [ ] Verifica che tutte e 8 le risposte siano in `audit_responses` sul DB
- [ ] Verifica 8 eventi in `audit_events`
- [ ] Ricarica pagina — tutte le risposte ancora presenti

**Rollback**: `VITE_SYNC_MODE=legacy` su Netlify → zero deploy

---

### T4 — Frontend: campi ricchi → eventi field_updated

**Obiettivo**: ogni modifica a `notes`, `generalData`, `auditObjective`, `auditOutcome` genera evento `field_updated` atomico. Elimina `update_audit` come operazione atomica sull'intero oggetto.

**Prerequisito**: T3 stabile per 2 settimane, zero incidenti.

**File coinvolti**: `app/src/contexts/StorageContext.jsx`, `app/src/components/Dashboard.jsx`

**Criticità**: questo sprint richiede debounce aggressivo (500ms) perché i campi testo generano eventi a ogni keystroke. Il debounce raggruppa le modifiche consecutive in un unico evento.

**Test L1**: Vitest — verifica debounce, verifica che eventi distanziati meno di 500ms vengano collassati in uno solo.

**Test L3 (smoke umano)**:
- [ ] Attiva feature flag T4
- [ ] Vai offline
- [ ] Scrivi 3 paragrafi di conclusioni (testo lungo)
- [ ] Torna online
- [ ] Verifica che il testo sia in `audit_extra_data` sul DB
- [ ] Verifica eventi `field_updated` per `generalData.conclusions` in `audit_events`
- [ ] Ripeti aprendo prima l'audit su PC, poi modificando su mobile → verifica che entrambe le modifiche sopravvivano

**Rollback**: feature flag → `legacy`

---

### T5 — Lock diventa opzionale per le scritture

**Obiettivo**: rimuovere il lock come prerequisito per `update_audit` e invio eventi. Il lock rimane solo come banner UX informativo.

**Prerequisito**: T3+T4 stabili per 2 settimane. Zero segnalazioni di perdita dati.

**File coinvolti**: `app/src/contexts/StorageContext.jsx`, `backend/src/controllers/audit.controller.js`, `backend/src/services/auditLock.service.js`

**Attenzione**: questo sprint ha il rischio più alto di regressione su scenari multi-utente. Richiede test L4 (due sessioni concorrenti).

**Test L4 (hardening — due utenti)**:
- [ ] Utente A apre audit su PC
- [ ] Utente B apre stesso audit su mobile
- [ ] Entrambi modificano campi diversi contemporaneamente
- [ ] Verifica che entrambe le modifiche siano nel DB
- [ ] Entrambi modificano lo stesso campo → verifica che l'ultimo vince (deterministic tiebreaker)
- [ ] Verifica `audit_events` per entrambe le modifiche

**Rollback**: reintroduce guard lock con feature flag

---

### T6 — Recovery UI + history API + compaction

**Obiettivo**: funzionalità di compliance ISO 9001 §7.5 visibili e usabili. Job di compaction notturno.

**Prerequisito**: T5 stabile. Nessun requisito temporale stretto.

**File coinvolti**: nuovo `backend/src/controllers/auditHistory.controller.js`, nuovo `app/src/components/AuditHistoryPanel.jsx`

**Funzionalità**:
- `GET /audits/:uuid/history` → lista eventi con chi/cosa/quando
- `GET /audits/:uuid/state?at=TIMESTAMP` → stato in quel momento
- UI "Cronologia modifiche" nell'audit (solo admin/auditor)
- Job nightly: snapshot + marca eventi compactable

**Test L3 (smoke umano)**:
- [ ] Apri cronologia di un audit compilato
- [ ] Verifica che ogni risposta mostri chi l'ha impostata e quando
- [ ] Verifica che i campi testo mostrino la storia delle modifiche
- [ ] Richiedi stato a timestamp specifico → verifica coerenza

---

## Rischi e mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| Temporal tables rallentano le query | Bassa | Medio | Indici su history tables + test carico T1 |
| Idempotency key persa al reload (T3) | Media | Alto | Chiave persistita in IndexedDB, non solo memoria |
| Skew orologi su mobile vecchi | Media | Medio | Offset server calcolato al login, aggiornato ogni 30 min |
| Client PWA cachati con vecchio SW | Alta | Medio | Endpoint `/sync` legacy attivo per tutta la transizione |
| Debounce T4 troppo aggressivo | Bassa | Basso | Configurabile via env var, default 500ms |
| Due utenti sovrascrivono stesso campo | Bassa | Medio | Tiebreaker deterministico documentato |
| Crescita illimitata event store | Media | Medio | Compaction job T6, alert su dimensione tabella |

---

## Decisioni rinviate

- **CRDT vs last-write-wins**: manteniamo last-write-wins per semplicità. CRDT è valutabile solo per la feature di editing testuale collaborativo real-time, se mai richiesta.
- **Background Sync API (Service Worker)**: da valutare in T3 come ottimizzazione per Android, non prerequisito.
- **WebSocket per sync real-time**: fuori scope per questa fase. L'architettura event-based è compatibile con polling, long-polling o WebSocket in futuro.

---

## Riferimenti

- [ADR-002 — Offline-first sync](ADR-002-offline-first-sync.md) — superato per i punti sul conflict resolution
- [ADR-006 — Auto-reconcile cache sync](ADR-006-auto-reconcile-cache-sync.md) — superato dal modello eventi
- [ADR-007 — Logout offline backup](ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) — ancora attivo, SYNC-4 è la prima implementazione
- [docs/GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md) — sezione "Piano qualità: fasi sviluppo T1-T6"
- Post-mortem bug Camellini 28/04/2026: audit MSN-260428-01, `audit_responses = 0` nonostante ore di compilazione
- Fix immediati: SYNC-1 (PR #18), SYNC-2 (PR #19), SYNC-3/4 (commit 29/04/2026)

---

*Approvato: 29 aprile 2026 — Product owner + Lead architect*
