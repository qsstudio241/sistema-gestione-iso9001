# DEPUTYTASK — T2: Event store audit_events + endpoint /events

> **Prerequisito**: T1 (temporal tables, migrazione 045) in produzione stabile da almeno 24h ✅
> **Quando lanciare**: 30 aprile 2026 o successivo
>
> **Segreti necessari** (già configurati il 28/04/2026):
> `SGQ_SSH_KEY_B64`, `SGQ_SUDO_PASSWORD`, `DB_SERVER`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`
>
> Usa `bash backend/scripts/deploy-to-vps.sh` e `bash backend/scripts/run-migration-agent.sh`.

---

## Obiettivo

Aggiungere la tabella `audit_events` (event store append-only) e il relativo endpoint
`POST /audits/:uuid/events` sul backend. Il vecchio `/audits/sync` rimane invariato.
Nessuna modifica al frontend in questo task — solo backend + DB.

Riferimento architetturale: `docs/adr/ADR-008-event-sourcing-sync.md` (sezione T2).

---

## Step 1 — Verifica segreti

```bash
env | grep -E "^(SGQ_|DB_)" | sed 's/=.*/=***/'
```

Devono comparire tutti e 7. Se mancano, fermarsi.

---

## Step 2 — Crea migrazione 046 (tabella audit_events)

Crea il file `database/migrations/046_audit_events_T2.sql`:

```sql
-- Migration 046: Event store audit_events (T2 — ADR-008)
-- Idempotente: IF NOT EXISTS su ogni oggetto.
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'audit_events' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.audit_events (
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
        CONSTRAINT CK_audit_events_type CHECK (event_type IN (
            'audit_created', 'audit_status_changed',
            'response_set', 'response_cleared',
            'field_updated',
            'attachment_added', 'attachment_removed',
            'custom_response_set'
        )),
        CONSTRAINT FK_audit_events_audit FOREIGN KEY (audit_id)
            REFERENCES dbo.audits(audit_id),
        CONSTRAINT FK_audit_events_user FOREIGN KEY (user_id)
            REFERENCES dbo.users(user_id)
    );
    PRINT 'Tabella audit_events creata.';
END
ELSE
    PRINT 'Tabella audit_events già presente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_audit_ts')
    CREATE INDEX IX_audit_events_audit_ts   ON dbo.audit_events (audit_id, client_ts);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_audit_uuid')
    CREATE INDEX IX_audit_events_audit_uuid ON dbo.audit_events (audit_uuid, client_ts);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_user_ts')
    CREATE INDEX IX_audit_events_user_ts    ON dbo.audit_events (user_id, server_ts);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_org')
    CREATE INDEX IX_audit_events_org        ON dbo.audit_events (organization_id, server_ts);

PRINT 'Migration 046 completata.';
```

---

## Step 3 — Crea script Node run-migration-046.js

Crea `backend/scripts/run-migration-046.js` seguendo esattamente lo stesso pattern
di `backend/scripts/run-migration-045.js` (stessa struttura, cambia solo numero e SQL).

Il SQL da eseguire è quello della migration 046 sopra.

---

## Step 4 — Crea controller auditEvents.controller.js

Crea `backend/src/controllers/auditEvents.controller.js`:

```javascript
/**
 * POST /api/v1/audits/:uuid/events
 * Accetta un batch di eventi audit e li persiste in audit_events (append-only).
 * Idempotente: eventi con idempotency_key già presente vengono saltati (non errore).
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function postAuditEvents(req, res) {
    try {
        const { uuid } = req.params;
        const { organization_id, user_id } = req.user;
        const { events } = req.body;

        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ error: 'events deve essere un array non vuoto', code: 'INVALID_PAYLOAD' });
        }
        if (events.length > 200) {
            return res.status(400).json({ error: 'Massimo 200 eventi per batch', code: 'BATCH_TOO_LARGE' });
        }

        // Risolvi audit_id da UUID (verifica appartenenza org)
        const auditRow = await query(
            `SELECT audit_id FROM dbo.audits
             WHERE audit_uuid = @uuid AND organization_id = @org AND is_deleted = 0`,
            { uuid, org: organization_id }
        );
        if (!auditRow.recordset.length) {
            return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
        }
        const audit_id = auditRow.recordset[0].audit_id;

        const VALID_TYPES = new Set([
            'audit_created','audit_status_changed',
            'response_set','response_cleared',
            'field_updated',
            'attachment_added','attachment_removed',
            'custom_response_set'
        ]);

        let inserted = 0;
        let skipped = 0;

        for (const ev of events) {
            if (!ev.idempotency_key || !ev.event_type || !ev.client_ts) {
                return res.status(400).json({ error: 'Ogni evento richiede idempotency_key, event_type, client_ts', code: 'MISSING_FIELDS' });
            }
            if (!VALID_TYPES.has(ev.event_type)) {
                return res.status(400).json({ error: `event_type non valido: ${ev.event_type}`, code: 'INVALID_EVENT_TYPE' });
            }

            try {
                await query(`
                    INSERT INTO dbo.audit_events
                        (audit_id, audit_uuid, event_type, field_path, old_value, new_value,
                         user_id, device_type, client_ts, client_ts_offset_ms,
                         idempotency_key, sync_batch_id, organization_id)
                    VALUES
                        (@audit_id, @audit_uuid, @event_type, @field_path, @old_value, @new_value,
                         @user_id, @device_type, @client_ts, @offset_ms,
                         @idempotency_key, @sync_batch_id, @org_id)
                `, {
                    audit_id,
                    audit_uuid: uuid,
                    event_type: ev.event_type,
                    field_path: ev.field_path ?? null,
                    old_value: ev.old_value != null ? JSON.stringify(ev.old_value) : null,
                    new_value: ev.new_value != null ? JSON.stringify(ev.new_value) : null,
                    user_id,
                    device_type: ev.device_type ?? null,
                    client_ts: ev.client_ts,
                    offset_ms: ev.client_ts_offset_ms ?? 0,
                    idempotency_key: ev.idempotency_key,
                    sync_batch_id: ev.sync_batch_id ?? null,
                    org_id: organization_id,
                });
                inserted++;
            } catch (err) {
                // Unique constraint violation = idempotency_key già presente → skip
                if (err.number === 2627 || err.number === 2601) {
                    skipped++;
                } else {
                    throw err;
                }
            }
        }

        logger.info('Audit events saved', { audit_id, inserted, skipped, user_id });
        return res.status(207).json({ inserted, skipped, total: events.length });

    } catch (error) {
        logger.error('Error saving audit events', { error: error.message });
        return res.status(500).json({ error: 'Errore salvataggio eventi', code: 'EVENTS_SAVE_ERROR' });
    }
}

async function getAuditEvents(req, res) {
    try {
        const { uuid } = req.params;
        const { organization_id } = req.user;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const since = req.query.since || null;

        const rows = await query(`
            SELECT TOP (@limit)
                event_uuid, event_type, field_path,
                new_value, user_id, device_type,
                client_ts, server_ts
            FROM dbo.audit_events
            WHERE audit_uuid = @uuid
              AND organization_id = @org
              ${since ? 'AND server_ts > @since' : ''}
            ORDER BY client_ts ASC, server_ts ASC
        `, { uuid, org: organization_id, limit, ...(since ? { since } : {}) });

        return res.json({ events: rows.recordset });
    } catch (error) {
        logger.error('Error fetching audit events', { error: error.message });
        return res.status(500).json({ error: 'Errore lettura eventi', code: 'EVENTS_FETCH_ERROR' });
    }
}

module.exports = { postAuditEvents, getAuditEvents };
```

---

## Step 5 — Crea route auditEvents.routes.js

Crea `backend/src/routes/auditEvents.routes.js`:

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { postAuditEvents, getAuditEvents } = require('../controllers/auditEvents.controller');

// POST /api/v1/audits/:uuid/events  — batch insert eventi
router.post('/:uuid/events', authenticate, postAuditEvents);

// GET  /api/v1/audits/:uuid/events  — lettura eventi (debug/smoke)
router.get('/:uuid/events', authenticate, getAuditEvents);

module.exports = router;
```

---

## Step 6 — Monta la route in server.js

Nel file `backend/src/server.js`, dopo le altre route audit esistenti, aggiungi:

```javascript
const auditEventsRoutes = require('./routes/auditEvents.routes');
// ... dopo il mount delle altre route audit:
app.use('/api/v1/audits', auditEventsRoutes);
```

Verifica che non ci siano conflitti con route già esistenti su `/audits`.

---

## Step 7 — Test L1

Crea `backend/src/tests/auditEvents.test.js` con almeno questi casi:
- POST batch valido → 207 con `inserted > 0`
- POST stesso batch → 207 con `skipped = N, inserted = 0` (idempotency)
- POST con `event_type` non valido → 400
- POST senza `idempotency_key` → 400
- POST su audit di altra org → 404

Esegui i test: `cd app && NODE_ENV=test npm run test:run`

---

## Step 8 — Commit e push

```bash
git add database/migrations/046_audit_events_T2.sql \
        backend/scripts/run-migration-046.js \
        backend/src/controllers/auditEvents.controller.js \
        backend/src/routes/auditEvents.routes.js \
        backend/src/server.js
git commit -m "feat(events): T2 — tabella audit_events + endpoint POST/GET /audits/:uuid/events

- Migration 046: audit_events append-only con idempotency_key unique,
  FK su audits e users, CHECK su event_type (8 tipi da ADR-008)
- auditEvents.controller: batch insert con skip su duplicate key (207),
  GET per lettura con paginazione server_ts
- auditEvents.routes: mount su /audits/:uuid/events (authenticate)
- server.js: mount auditEventsRoutes

Backward compatible: /audits/sync invariato. Nessuna modifica frontend.
Test L1: N/N green."
git push -u origin main
```

---

## Step 9 — Migrazione DB 046

```bash
bash backend/scripts/run-migration-agent.sh 046 production
```

Output atteso: `Migration 046 completata.`

---

## Step 10 — Deploy VPS

```bash
bash backend/scripts/deploy-to-vps.sh
```

Lo script include già `server.js`. Aggiungi manualmente al deploy i nuovi file
se non coperti dallo script (vedi Step 11).

---

## Step 11 — Copia manualmente i nuovi file sul VPS (se lo script non li include)

```bash
SGQ_KEY_FILE=$(mktemp /tmp/sgq_XXXXXX)
chmod 600 "$SGQ_KEY_FILE"
echo "$SGQ_SSH_KEY_B64" | base64 -d > "$SGQ_KEY_FILE"

scp -P 1122 -i "$SGQ_KEY_FILE" -o StrictHostKeyChecking=accept-new \
  backend/src/controllers/auditEvents.controller.js \
  spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/

scp -P 1122 -i "$SGQ_KEY_FILE" -o StrictHostKeyChecking=accept-new \
  backend/src/routes/auditEvents.routes.js \
  spascarella@www.fr-busato.it:/var/www/sgq-backend/src/routes/

rm -f "$SGQ_KEY_FILE"
```

Poi riavvia:
```bash
SGQ_KEY_FILE=$(mktemp /tmp/sgq_XXXXXX)
chmod 600 "$SGQ_KEY_FILE"
echo "$SGQ_SSH_KEY_B64" | base64 -d > "$SGQ_KEY_FILE"
ssh -i "$SGQ_KEY_FILE" -o StrictHostKeyChecking=accept-new -p 1122 \
  spascarella@www.fr-busato.it \
  "echo '$SGQ_SUDO_PASSWORD' | sudo -S systemctl restart sgq-backend.service && sleep 3 && sudo systemctl status sgq-backend | head -5"
rm -f "$SGQ_KEY_FILE"
```

---

## Step 12 — Smoke test endpoint

```bash
# Health
curl -s https://www.fr-busato.it:8443/api/v1/health | python3 -m json.tool

# Verifica route attiva (401 = route presente, auth richiesta)
curl -s -o /dev/null -w "%{http_code}" \
  https://www.fr-busato.it:8443/api/v1/audits/00000000-0000-0000-0000-000000000000/events
# Atteso: 401
```

---

## Definition of Done

- [ ] Migration 046 → `MIGRATION COMPLETATA` sul DB prod
- [ ] `audit_events` presente: `SELECT TOP 1 * FROM audit_events` (0 righe = ok, tabella esiste)
- [ ] `POST /audits/:uuid/events` → 401 senza token, 404 con token su UUID inesistente
- [ ] Idempotency: stesso batch inviato 2 volte → secondo `skipped = N`
- [ ] `GET /api/v1/health` → 200 healthy
- [ ] Test L1 tutti verdi (incluso il nuovo `auditEvents.test.js`)
- [ ] Aggiorna roadmap: T2 ✅

Chiudi con **TEST OK** o **FIX NON APPLICABILI** elencando l'esito di ogni step.
