/**
 * Controlli previsti sulla commessa (migrazione 180).
 * La lista vive sulla commessa. «Crea bozze» scrive verbali CND in stato bozza.
 * Fase e metodo sono quelli già usati dai verbali. La norma di accettazione
 * resta il testo inserito dall'utente.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    hasCompanyAccessRows,
    assertMutatingAllowed,
    assertCompanyRead,
    sendAccessDenied,
} = require('../services/companyAccess.service');

const PHASES = new Set(['before', 'during', 'after']);
const METHODS = new Set(['VT', 'MT', 'PT', 'UT', 'RT', 'ET']);

function isMissingItemsTable(err) {
    return /Invalid object name ['"]?(?:dbo\.)?project_inspection_items['"]?/i.test(String(err && err.message || ''));
}

function isMissingPhaseColumn(err) {
    return /Invalid column name ['"]inspection_phase['"]/i.test(String(err && err.message || ''));
}

function parsePhase(raw) {
    if (raw == null || String(raw).trim() === '') return { value: null };
    const value = String(raw).trim().toLowerCase();
    if (!PHASES.has(value)) {
        return { error: 'Fase non valida. Usa prima, durante o dopo la saldatura.', code: 'INSPECTION_PHASE_INVALID' };
    }
    return { value };
}

function parseMethod(raw) {
    if (raw == null || String(raw).trim() === '') return { value: null };
    const value = String(raw).trim().toUpperCase();
    if (!METHODS.has(value)) {
        return { error: 'Metodo CND non valido.', code: 'INSPECTION_METHOD_INVALID' };
    }
    return { value };
}

function parsePercent(raw) {
    if (raw == null || String(raw).trim() === '') return { value: null };
    const text = String(raw).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(text)) {
        return { error: 'La percentuale deve essere un numero tra 0 e 100.', code: 'INSPECTION_PERCENT_INVALID' };
    }
    const value = Math.round(Number(text) * 100) / 100;
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        return { error: 'La percentuale deve essere un numero tra 0 e 100.', code: 'INSPECTION_PERCENT_INVALID' };
    }
    return { value };
}

function parseAcceptance(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    return String(raw).trim().slice(0, 500);
}

function sendInvalid(res, parsed) {
    return res.status(400).json({ error: parsed.error, code: parsed.code });
}

async function loadLiveProject(organizationId, projectId) {
    const found = await query(`
        SELECT id, organization_id, company_id, project_code, client_name, deleted_at
        FROM projects
        WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL
    `, { id: projectId, organization_id: organizationId });
    return found.recordset[0] || null;
}

async function denyProject(res, user, project, level) {
    if (!project) {
        res.status(404).json({ error: 'Commessa non trovata', code: 'PROJECT_NOT_FOUND' });
        return true;
    }
    if (project.company_id == null) {
        const access = await ensureCompanyAccessLoaded(user);
        if (hasCompanyAccessRows(access)) {
            sendAccessDenied(res, { status: 403, body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' } });
            return true;
        }
        if (level === 'write') {
            const denied = await assertMutatingAllowed(user, {});
            if (denied) {
                sendAccessDenied(res, denied);
                return true;
            }
        }
        return false;
    }
    const denied = level === 'write'
        ? await assertMutatingAllowed(user, { companyId: project.company_id })
        : await assertCompanyRead(user, project.company_id);
    if (denied) {
        sendAccessDenied(res, denied);
        return true;
    }
    return false;
}

function projectIdOf(req) {
    const id = parseInt(req.params.id, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function listItems(req, res) {
    try {
        const projectId = projectIdOf(req);
        if (!projectId) return res.status(400).json({ error: 'Identificativo non valido.', code: 'INVALID_ID' });
        const project = await loadLiveProject(req.user.organization_id, projectId);
        if (await denyProject(res, req.user, project, 'read')) return;
        const rows = await query(`
            SELECT id, project_id, organization_id, inspection_phase, method,
                   coverage_percent, acceptance_standard, created_at
            FROM project_inspection_items
            WHERE project_id = @project_id
              AND organization_id = @organization_id
              AND deleted_at IS NULL
            ORDER BY id
        `, { project_id: projectId, organization_id: req.user.organization_id });
        res.json({ success: true, data: rows.recordset });
    } catch (err) {
        if (isMissingItemsTable(err)) {
            return res.json({ success: true, data: [], table_missing: true });
        }
        logger.error('list inspection items', { error: err.message });
        res.status(500).json({ error: 'Errore lettura controlli previsti', code: 'INSPECTION_LIST_ERROR' });
    }
}

async function createItem(req, res) {
    try {
        const projectId = projectIdOf(req);
        if (!projectId) return res.status(400).json({ error: 'Identificativo non valido.', code: 'INVALID_ID' });
        const phase = parsePhase(req.body.inspection_phase);
        if (phase.error) return sendInvalid(res, phase);
        const method = parseMethod(req.body.method);
        if (method.error) return sendInvalid(res, method);
        const percent = parsePercent(req.body.coverage_percent);
        if (percent.error) return sendInvalid(res, percent);

        const project = await loadLiveProject(req.user.organization_id, projectId);
        if (await denyProject(res, req.user, project, 'write')) return;

        const inserted = await query(`
            INSERT INTO project_inspection_items (
                organization_id, project_id, inspection_phase, method,
                coverage_percent, acceptance_standard, created_by
            )
            OUTPUT INSERTED.id, INSERTED.inspection_phase, INSERTED.method,
                   INSERTED.coverage_percent, INSERTED.acceptance_standard
            VALUES (
                @organization_id, @project_id, @inspection_phase, @method,
                @coverage_percent, @acceptance_standard, @created_by
            )
        `, {
            organization_id: req.user.organization_id,
            project_id: projectId,
            inspection_phase: phase.value,
            method: method.value,
            coverage_percent: percent.value,
            acceptance_standard: parseAcceptance(req.body.acceptance_standard),
            created_by: req.user.user_id || null,
        });
        res.status(201).json({ success: true, data: inserted.recordset[0] });
    } catch (err) {
        if (isMissingItemsTable(err)) {
            return res.status(503).json({
                error: 'Elenco controlli previsti non ancora disponibile.',
                code: 'INSPECTION_TABLE_MISSING',
            });
        }
        logger.error('create inspection item', { error: err.message });
        res.status(500).json({ error: 'Errore salvataggio controllo previsto', code: 'INSPECTION_CREATE_ERROR' });
    }
}

async function deleteItem(req, res) {
    try {
        const projectId = projectIdOf(req);
        const itemId = parseInt(req.params.itemId, 10);
        if (!projectId || !Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({ error: 'Identificativo non valido.', code: 'INVALID_ID' });
        }
        const project = await loadLiveProject(req.user.organization_id, projectId);
        if (await denyProject(res, req.user, project, 'write')) return;
        const updated = await query(`
            UPDATE project_inspection_items
            SET deleted_at = SYSUTCDATETIME(), deleted_by = @deleted_by
            OUTPUT INSERTED.id
            WHERE id = @id
              AND project_id = @project_id
              AND organization_id = @organization_id
              AND deleted_at IS NULL
        `, {
            id: itemId,
            project_id: projectId,
            organization_id: req.user.organization_id,
            deleted_by: req.user.user_id || null,
        });
        if (!updated.recordset[0]) {
            return res.status(404).json({ error: 'Controllo previsto non trovato', code: 'INSPECTION_NOT_FOUND' });
        }
        res.json({ success: true });
    } catch (err) {
        logger.error('delete inspection item', { error: err.message });
        res.status(500).json({ error: 'Errore cestino controllo previsto', code: 'INSPECTION_DELETE_ERROR' });
    }
}

function draftNotes(item) {
    const lines = [];
    if (item.acceptance_standard) lines.push(`Norma di accettazione: ${item.acceptance_standard}`);
    if (item.coverage_percent != null && item.coverage_percent !== '') {
        lines.push(`Percentuale prevista: ${item.coverage_percent}`);
    }
    return lines.length ? lines.join('\n') : null;
}

async function nextReportNumber(organizationId, reportType, year) {
    const result = await query(`
        SELECT COUNT(*) AS cnt
        FROM ndt_reports
        WHERE report_type = @report_type
          AND report_year = @report_year
          AND organization_id = @organization_id
    `, { report_type: reportType, report_year: year, organization_id: organizationId });
    const seq = Number(result.recordset[0].cnt) + 1;
    return `${reportType}-${year}-${String(seq).padStart(3, '0')}`;
}

async function findOpenDraft(organizationId, projectId, method, phase, notes, includePhase) {
    const sameNotes = `
          AND (
            (@notes IS NULL AND notes IS NULL)
            OR notes = @notes
          )`;
    if (!includePhase) {
        const found = await query(`
            SELECT TOP 1 id, report_number
            FROM ndt_reports
            WHERE organization_id = @organization_id
              AND project_id = @project_id
              AND report_type = @method
              AND is_deleted = 0
              AND status = 'draft'
              ${sameNotes}
        `, { organization_id: organizationId, project_id: projectId, method, notes });
        return found.recordset[0] || null;
    }
    const found = await query(`
        SELECT TOP 1 id, report_number
        FROM ndt_reports
        WHERE organization_id = @organization_id
          AND project_id = @project_id
          AND report_type = @method
          AND is_deleted = 0
          AND status = 'draft'
          AND (
            (@phase IS NULL AND inspection_phase IS NULL)
            OR inspection_phase = @phase
          )
          ${sameNotes}
    `, { organization_id: organizationId, project_id: projectId, method, phase, notes });
    return found.recordset[0] || null;
}

async function insertDraft(project, item, user, includePhase) {
    const year = new Date().getFullYear();
    const reportNumber = await nextReportNumber(project.organization_id, item.method, year);
    const notes = draftNotes(item);
    const params = {
        organization_id: project.organization_id,
        company_id: project.company_id || null,
        report_type: item.method,
        report_number: reportNumber,
        report_year: year,
        client: project.client_name || null,
        job_order: project.project_code || null,
        quality_level: null,
        joint_type: null,
        notes,
        status: 'draft',
        created_by: user.user_id || null,
        project_id: project.id,
        inspection_phase: item.inspection_phase || null,
    };
    const phaseColumn = includePhase ? ', inspection_phase' : '';
    const phaseValue = includePhase ? ', @inspection_phase' : '';
    const inserted = await query(`
        INSERT INTO ndt_reports (
            organization_id, company_id, report_type, report_number, report_year,
            client, job_order, quality_level, joint_type, notes,
            status, created_by, project_id${phaseColumn}
        )
        OUTPUT INSERTED.id, INSERTED.report_number, INSERTED.report_type, INSERTED.status
        VALUES (
            @organization_id, @company_id, @report_type, @report_number, @report_year,
            @client, @job_order, @quality_level, @joint_type, @notes,
            @status, @created_by, @project_id${phaseValue}
        )
    `, params);
    return inserted.recordset[0];
}

async function generateDrafts(req, res) {
    try {
        const projectId = projectIdOf(req);
        if (!projectId) return res.status(400).json({ error: 'Identificativo non valido.', code: 'INVALID_ID' });
        const project = await loadLiveProject(req.user.organization_id, projectId);
        if (await denyProject(res, req.user, project, 'write')) return;

        const rows = await query(`
            SELECT id, inspection_phase, method, coverage_percent, acceptance_standard
            FROM project_inspection_items
            WHERE project_id = @project_id
              AND organization_id = @organization_id
              AND deleted_at IS NULL
            ORDER BY id
        `, { project_id: projectId, organization_id: req.user.organization_id });

        const created = [];
        const already = [];
        const skipped = [];
        let includePhase = true;
        for (const item of rows.recordset) {
            if (!item.method) {
                skipped.push({ id: item.id, reason: 'senza metodo' });
                continue;
            }
            const notes = draftNotes(item);
            let existing;
            try {
                existing = await findOpenDraft(
                    project.organization_id, project.id, item.method, item.inspection_phase || null, notes, includePhase,
                );
            } catch (err) {
                if (!isMissingPhaseColumn(err)) throw err;
                includePhase = false;
                existing = await findOpenDraft(
                    project.organization_id, project.id, item.method, null, notes, false,
                );
            }
            if (existing) {
                already.push({ id: item.id, report_id: existing.id, report_number: existing.report_number });
                continue;
            }
            try {
                const draft = await insertDraft(project, item, req.user, includePhase);
                created.push({
                    id: item.id,
                    report_id: draft.id,
                    report_number: draft.report_number,
                    method: item.method,
                    inspection_phase: includePhase ? (item.inspection_phase || null) : null,
                });
            } catch (err) {
                if (!includePhase || !isMissingPhaseColumn(err)) throw err;
                includePhase = false;
                const draft = await insertDraft(project, item, req.user, false);
                created.push({
                    id: item.id,
                    report_id: draft.id,
                    report_number: draft.report_number,
                    method: item.method,
                    inspection_phase: null,
                });
            }
        }
        res.status(201).json({ success: true, data: { created, already, skipped } });
    } catch (err) {
        if (isMissingItemsTable(err)) {
            return res.status(503).json({
                error: 'Elenco controlli previsti non ancora disponibile.',
                code: 'INSPECTION_TABLE_MISSING',
            });
        }
        logger.error('generate inspection drafts', { error: err.message });
        res.status(500).json({ error: 'Errore creazione bozze CND', code: 'INSPECTION_DRAFT_ERROR' });
    }
}

module.exports = {
    listItems,
    createItem,
    deleteItem,
    generateDrafts,
    parsePercent,
    parsePhase,
    parseMethod,
};
