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
            'audit_created', 'audit_status_changed',
            'response_set', 'response_cleared',
            'field_updated',
            'attachment_added', 'attachment_removed',
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
