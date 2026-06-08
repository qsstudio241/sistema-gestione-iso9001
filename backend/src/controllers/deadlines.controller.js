/**
 * deadlines.controller.js — Scadenzario da file (ADR-013)
 *
 * S3: POST /documents/:id/detect-deadlines  ? analisi euristica del file
 * S4: POST /documents/:id/import-deadlines  ? import righe in deadline_items
 *     GET  /deadline-items                  ? lista per org (con filtri)
 *     GET  /deadline-items/priority         ? scaduti + in scadenza entro N giorni
 *     PATCH /deadline-items/:itemId         ? aggiorna stato / assegnazione / note
 *     POST  /deadline-items/:itemId/complete ? segna completato
 *     DELETE /deadline-items/:itemId        ? elimina
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const { detectDeadlineFile } = require('../utils/excelDeadlineDetector');
const XLSX = require('xlsx');

// ?? helpers ???????????????????????????????????????????????????????????????????

/**
 * Legge il file fisico corrente associato a un documento.
 * Restituisce { filePath, fileName } oppure null.
 */
async function getCurrentFileForDoc(pool, docId, orgId) {
    const r = await pool.request()
        .input('docId',  docId)
        .input('orgId',  orgId)
        .query(`
            SELECT TOP 1 a.attachment_id, a.file_name, a.storage_path, a.mime_type
            FROM attachments a
            JOIN document_registry dr ON dr.id = a.document_id
            WHERE a.document_id = @docId
              AND dr.organization_id = @orgId
              AND a.is_current_doc_version = 1
            ORDER BY a.created_at DESC
        `);
    if (!r.recordset.length) return null;
    const att = r.recordset[0];
    if (!fs.existsSync(att.storage_path)) return null;
    return { filePath: att.storage_path, fileName: att.file_name, attachmentId: att.attachment_id };
}

/**
 * Verifica che il documento appartenga all'org corrente.
 */
async function getDocumentOrFail(pool, docId, orgId) {
    const r = await pool.request()
        .input('docId', docId)
        .input('orgId', orgId)
        .query(`
            SELECT id, title, company_id, organization_id
            FROM document_registry
            WHERE id = @docId AND organization_id = @orgId
        `);
    return r.recordset[0] || null;
}

/**
 * Converte un valore cella in stringa data ISO (YYYY-MM-DD).
 * Restituisce null se non parsabile.
 */
function parseCellDate(v) {
    if (!v && v !== 0) return null;
    if (v instanceof Date) {
        if (isNaN(v.getTime())) return null;
        return v.toISOString().slice(0, 10);
    }
    // Serial Excel
    if (typeof v === 'number' && v > 1 && v < 3000000) {
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    if (typeof v === 'string') {
        const s = v.trim();
        // DD/MM/YYYY o DD-MM-YYYY
        const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyMatch) {
            const [, d, m, y] = dmyMatch;
            return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) return parsed.toISOString().slice(0, 10);
    }
    return null;
}

// ?? S3: POST /documents/:id/detect-deadlines ??????????????????????????????????

async function detectDeadlines(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const docId = parseInt(req.params.id);

        const doc = await getDocumentOrFail(pool, docId, orgId);
        if (!doc) return res.status(404).json({ error: 'Documento non trovato.' });

        const fileInfo = await getCurrentFileForDoc(pool, docId, orgId);
        if (!fileInfo) return res.status(422).json({ error: 'Nessun file allegato al documento.' });

        const ext = path.extname(fileInfo.fileName).toLowerCase();
        if (!['.xlsx', '.xls', '.csv', '.ods'].includes(ext)) {
            return res.json({ isDeadlineFile: false, sheets: [], suggestedMapping: null, reason: 'not_spreadsheet' });
        }

        const buffer = fs.readFileSync(fileInfo.filePath);
        const result = detectDeadlineFile(buffer);

        // Conta eventuali righe entro 30 gg + scadute per il preview
        let previewStats = null;
        if (result.isDeadlineFile && result.suggestedMapping) {
            const sm = result.suggestedMapping;
            const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
            const sheet = wb.Sheets[sm.sheetName];
            const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
            const headers = (rows[0] || []).map(h => String(h ?? '').trim());
            const dateIdx = headers.indexOf(sm.dateColumn);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const window30 = new Date(today); window30.setDate(window30.getDate() + 30);

            let expired = 0, soon = 0, total = 0;
            for (const row of rows.slice(1)) {
                if (!row || row.every(c => c == null || c === '')) continue;
                total++;
                const dateStr = parseCellDate(row[dateIdx]);
                if (!dateStr) continue;
                const d = new Date(dateStr);
                if (d < today) expired++;
                else if (d <= window30) soon++;
            }
            previewStats = { total, expired, soon };
        }

        return res.json({ ...result, previewStats, fileName: fileInfo.fileName });
    } catch (err) {
        logger.error('detectDeadlines:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ?? S4a: POST /documents/:id/import-deadlines ?????????????????????????????????

async function importDeadlines(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const userId = req.user.user_id;
        const docId  = parseInt(req.params.id);

        const {
            sheetName,
            dateColumn,
            titleColumn,
            categoryColumn = null,
            referenceColumn = null,
            label = null,
            visibilityDays = 30,
            autoRefresh = false,
        } = req.body;

        if (!dateColumn || !titleColumn) {
            return res.status(400).json({ error: 'dateColumn e titleColumn sono obbligatori.' });
        }

        const doc = await getDocumentOrFail(pool, docId, orgId);
        if (!doc) return res.status(404).json({ error: 'Documento non trovato.' });

        const fileInfo = await getCurrentFileForDoc(pool, docId, orgId);
        if (!fileInfo) return res.status(422).json({ error: 'Nessun file allegato al documento.' });

        const buffer  = fs.readFileSync(fileInfo.filePath);
        const wb      = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const targetSheet = sheetName || wb.SheetNames[0];
        const sheet   = wb.Sheets[targetSheet];
        if (!sheet) return res.status(400).json({ error: `Foglio "${targetSheet}" non trovato.` });

        const rows    = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        if (rows.length < 2) return res.status(400).json({ error: 'Il foglio non contiene dati sufficienti.' });

        const headers    = (rows[0] || []).map(h => String(h ?? '').trim());
        const dateIdx    = headers.indexOf(dateColumn);
        const titleIdx   = headers.indexOf(titleColumn);
        const catIdx     = categoryColumn ? headers.indexOf(categoryColumn) : -1;
        const refIdx     = referenceColumn ? headers.indexOf(referenceColumn) : -1;

        if (dateIdx < 0)  return res.status(400).json({ error: `Colonna scadenza "${dateColumn}" non trovata.` });
        if (titleIdx < 0) return res.status(400).json({ error: `Colonna descrizione "${titleColumn}" non trovata.` });

        // Salva / aggiorna config import
        await pool.request()
            .input('docId',    docId)
            .input('orgId',    orgId)
            .input('compId',   doc.company_id)
            .input('label',    label)
            .input('sheet',    targetSheet)
            .input('datCol',   dateColumn)
            .input('titCol',   titleColumn)
            .input('catCol',   categoryColumn)
            .input('refCol',   referenceColumn)
            .input('visDays',  visibilityDays)
            .input('autoRef',  autoRefresh ? 1 : 0)
            .query(`
                MERGE deadline_import_config AS t
                USING (SELECT @docId AS document_id) AS s ON t.document_id = s.document_id
                WHEN MATCHED THEN UPDATE SET
                    label = @label, sheet_name = @sheet,
                    date_column = @datCol, title_column = @titCol,
                    category_column = @catCol, reference_column = @refCol,
                    visibility_days = @visDays, auto_refresh = @autoRef,
                    last_import_at = GETDATE()
                WHEN NOT MATCHED THEN INSERT
                    (document_id, organization_id, company_id, label, sheet_name,
                     date_column, title_column, category_column, reference_column,
                     visibility_days, auto_refresh, last_import_at)
                VALUES (@docId, @orgId, @compId, @label, @sheet,
                        @datCol, @titCol, @catCol, @refCol,
                        @visDays, @autoRef, GETDATE());
            `);

        // Elimina righe precedenti (re-import idempotente)
        await pool.request()
            .input('docId', docId)
            .query(`DELETE FROM deadline_items WHERE source_document_id = @docId`);

        let inserted = 0, skipped = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);

        for (let rowNum = 1; rowNum < rows.length; rowNum++) {
            const row = rows[rowNum];
            if (!row || row.every(c => c == null || c === '')) continue;

            const dateStr = parseCellDate(row[dateIdx]);
            const title   = String(row[titleIdx] ?? '').trim();
            if (!dateStr || !title) { skipped++; continue; }

            // Extra data: tutte le altre colonne come JSON
            const extra = {};
            headers.forEach((h, i) => {
                if (i !== dateIdx && i !== titleIdx && i !== catIdx && i !== refIdx && row[i] != null) {
                    extra[h] = row[i];
                }
            });

            await pool.request()
                .input('orgId',    orgId)
                .input('compId',   doc.company_id)
                .input('srcDocId', docId)
                .input('srcSheet', targetSheet)
                .input('srcRow',   rowNum + 1) // 1-indexed, +1 per header
                .input('title',    title)
                .input('dueDate',  dateStr)
                .input('category', catIdx >= 0 ? String(row[catIdx] ?? '').trim() || null : null)
                .input('refCode',  refIdx >= 0 ? String(row[refIdx] ?? '').trim() || null : null)
                .input('extra',    Object.keys(extra).length ? JSON.stringify(extra) : null)
                .input('userId',   userId)
                .query(`
                    INSERT INTO deadline_items
                        (organization_id, company_id, source_document_id, source_sheet_name,
                         source_row_number, title, due_date, category, reference_code,
                         extra_data, created_by)
                    VALUES
                        (@orgId, @compId, @srcDocId, @srcSheet,
                         @srcRow, @title, @dueDate, @category, @refCode,
                         @extra, @userId)
                `);
            inserted++;
        }

        // Aggiorna conteggio righe nel config
        await pool.request()
            .input('docId', docId)
            .input('rows',  inserted)
            .query(`UPDATE deadline_import_config SET last_import_rows = @rows WHERE document_id = @docId`);

        logger.info(`[Deadlines] Import doc ${docId}: ${inserted} righe, ${skipped} saltate`);
        res.json({ success: true, inserted, skipped, documentId: docId });
    } catch (err) {
        logger.error('importDeadlines:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ?? S4b: GET /deadline-items ??????????????????????????????????????????????????

async function listDeadlineItems(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const {
            company_id, status, assigned_to, source_document_id,
            priority_only, days = 30, page = 1, limit = 100,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = 'WHERE di.organization_id = @orgId';
        const req2 = pool.request().input('orgId', orgId);

        if (company_id)           { where += ' AND di.company_id = @compId';    req2.input('compId', parseInt(company_id)); }
        if (status)               { where += ' AND di.status = @status';         req2.input('status', status); }
        if (assigned_to)          { where += ' AND di.assigned_to = @assignedTo';req2.input('assignedTo', parseInt(assigned_to)); }
        if (source_document_id)   { where += ' AND di.source_document_id = @srcDocId'; req2.input('srcDocId', parseInt(source_document_id)); }
        if (priority_only === '1') {
            where += ` AND di.status = 'active' AND di.due_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))`;
            req2.input('days', parseInt(days));
        }

        const countRes = await req2.query(`SELECT COUNT(*) AS total FROM deadline_items di ${where}`);
        const total = countRes.recordset[0].total;

        req2.input('limit', parseInt(limit)).input('offset', offset);

        const r = await req2.query(`
            SELECT di.*,
                   c.name AS company_name,
                   dr.title AS source_document_title,
                   u.full_name AS assigned_to_name,
                   DATEDIFF(day, CAST(GETDATE() AS DATE), di.due_date) AS days_until_due
            FROM deadline_items di
            LEFT JOIN companies c           ON c.id = di.company_id
            LEFT JOIN document_registry dr  ON dr.id = di.source_document_id
            LEFT JOIN users u               ON u.user_id = di.assigned_to
            ${where}
            ORDER BY di.due_date ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        res.json({
            data: r.recordset,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (err) {
        logger.error('listDeadlineItems:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ?? GET /deadline-items/priority ?????????????????????????????????????????????

async function getPriorityDeadlines(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const { company_id, days = 30 } = req.query;

        const req2 = pool.request()
            .input('orgId', orgId)
            .input('days',  parseInt(days));

        let compFilter = '';
        if (company_id) {
            compFilter = ' AND di.company_id = @compId';
            req2.input('compId', parseInt(company_id));
        }

        const r = await req2.query(`
            SELECT di.*,
                   c.name AS company_name,
                   dr.title AS source_document_title,
                   u.full_name AS assigned_to_name,
                   DATEDIFF(day, CAST(GETDATE() AS DATE), di.due_date) AS days_until_due
            FROM deadline_items di
            LEFT JOIN companies c           ON c.id = di.company_id
            LEFT JOIN document_registry dr  ON dr.id = di.source_document_id
            LEFT JOIN users u               ON u.user_id = di.assigned_to
            WHERE di.organization_id = @orgId
              AND di.status = 'active'
              AND di.due_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
              ${compFilter}
            ORDER BY di.due_date ASC
        `);

        res.json({ data: r.recordset });
    } catch (err) {
        logger.error('getPriorityDeadlines:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ?? PATCH /deadline-items/:itemId ????????????????????????????????????????????

async function updateDeadlineItem(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const itemId = parseInt(req.params.itemId);
        const { status, notes, assigned_to, assigned_email } = req.body;

        const check = await pool.request()
            .input('id', itemId).input('orgId', orgId)
            .query('SELECT id FROM deadline_items WHERE id = @id AND organization_id = @orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Item non trovato.' });

        const sets = ['updated_at = GETDATE()'];
        const req2 = pool.request().input('id', itemId);

        if (status !== undefined)         { sets.push('status = @status');           req2.input('status', status); }
        if (notes !== undefined)          { sets.push('notes = @notes');             req2.input('notes', notes); }
        if (assigned_to !== undefined)    { sets.push('assigned_to = @assignedTo');  req2.input('assignedTo', assigned_to || null); }
        if (assigned_email !== undefined) { sets.push('assigned_email = @assignedEmail'); req2.input('assignedEmail', assigned_email || null); }

        await req2.query(`UPDATE deadline_items SET ${sets.join(', ')} WHERE id = @id`);
        const r = await pool.request().input('id', itemId).query('SELECT * FROM deadline_items WHERE id = @id');
        res.json({ success: true, item: r.recordset[0] });
    } catch (err) {
        logger.error('updateDeadlineItem:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ?? POST /deadline-items/:itemId/complete ????????????????????????????????????

async function completeDeadlineItem(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const userId = req.user.user_id;
        const itemId = parseInt(req.params.itemId);

        const check = await pool.request()
            .input('id', itemId).input('orgId', orgId)
            .query('SELECT id FROM deadline_items WHERE id = @id AND organization_id = @orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Item non trovato.' });

        await pool.request()
            .input('id', itemId).input('userId', userId)
            .query(`
                UPDATE deadline_items
                SET status = 'completed', completed_at = GETDATE(), completed_by = @userId, updated_at = GETDATE()
                WHERE id = @id
            `);
        res.json({ success: true });
    } catch (err) {
        logger.error('completeDeadlineItem:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ?? DELETE /deadline-items/:itemId ???????????????????????????????????????????

async function deleteDeadlineItem(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const itemId = parseInt(req.params.itemId);

        const check = await pool.request()
            .input('id', itemId).input('orgId', orgId)
            .query('SELECT id FROM deadline_items WHERE id = @id AND organization_id = @orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Item non trovato.' });

        await pool.request().input('id', itemId).query('DELETE FROM deadline_items WHERE id = @id');
        res.json({ success: true });
    } catch (err) {
        logger.error('deleteDeadlineItem:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ?? GET /documents/:id/deadline-config ??????????????????????????????????????

async function getDeadlineConfig(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const docId = parseInt(req.params.id);

        const r = await pool.request()
            .input('docId', docId).input('orgId', orgId)
            .query(`
                SELECT dic.*
                FROM deadline_import_config dic
                JOIN document_registry dr ON dr.id = dic.document_id
                WHERE dic.document_id = @docId AND dr.organization_id = @orgId
            `);
        res.json({ config: r.recordset[0] || null });
    } catch (err) {
        logger.error('getDeadlineConfig:', err.message);
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    detectDeadlines,
    importDeadlines,
    listDeadlineItems,
    getPriorityDeadlines,
    updateDeadlineItem,
    completeDeadlineItem,
    deleteDeadlineItem,
    getDeadlineConfig,
};
