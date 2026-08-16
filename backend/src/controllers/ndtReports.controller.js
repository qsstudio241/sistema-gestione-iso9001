/**
 * ndtReports.controller.js — CRUD Verbali CND (VT/MT/PT/UT)
 *
 * Numerazione automatica: VT-YYYY-NNN (come RD-YYYY-NNN per riesami)
 * Tenant-isolated: organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    hasCompanyAccessRows,
    assertCompanyAccess,
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');

// ── Numerazione automatica ───────────────────────────────────────────────────
async function allocateReportNumber(pool_query, report_type, report_year, organization_id) {
    const result = await pool_query(`
        SELECT COUNT(*) AS cnt
        FROM ndt_reports
        WHERE report_type = @report_type
          AND report_year = @report_year
          AND organization_id = @organization_id
          AND report_number IS NOT NULL
    `, { report_type, report_year, organization_id });

    const seq = result.recordset[0].cnt + 1;
    return `${report_type}-${report_year}-${String(seq).padStart(3, '0')}`;
}

// ── GET /ndt-reports/stats ───────────────────────────────────────────────────
async function getNdtStats(req, res) {
    try {
        const { organization_id } = req.user;
        const { company_id } = req.query;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'r');

        const conditions = ['r.organization_id = @organization_id', 'r.is_deleted = 0'];
        const params = { organization_id };
        if (companyFilter.clause) conditions.push(companyFilter.clause);
        Object.assign(params, companyFilter.params);
        if (company_id) { conditions.push('r.company_id = @company_id'); params.company_id = parseInt(company_id); }

        const result = await query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN r.status = 'draft' THEN 1 ELSE 0 END) AS draft,
                SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN r.report_type = 'VT' THEN 1 ELSE 0 END) AS vt_count,
                SUM(CASE WHEN r.report_type = 'MT' THEN 1 ELSE 0 END) AS mt_count,
                SUM(CASE WHEN r.report_type = 'PT' THEN 1 ELSE 0 END) AS pt_count,
                SUM(CASE WHEN r.report_type = 'UT' THEN 1 ELSE 0 END) AS ut_count
            FROM ndt_reports r
            WHERE ${conditions.join(' AND ')}
        `, params);

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        logger.error('getNdtStats error', { error: err.message });
        res.status(500).json({ error: 'Errore statistiche verbali CND', code: 'NDT_STATS_ERROR' });
    }
}

// ── GET /ndt-reports ─────────────────────────────────────────────────────────
async function listNdtReports(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id, report_type, status,
            date_from, date_to, search,
            page = 1, limit = 50,
        } = req.query;

        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'r');

        const conditions = ['r.organization_id = @organization_id', 'r.is_deleted = 0'];
        const params = { organization_id, limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) };
        if (companyFilter.clause) conditions.push(companyFilter.clause);
        Object.assign(params, companyFilter.params);

        if (company_id) { conditions.push('r.company_id = @company_id'); params.company_id = parseInt(company_id); }
        if (report_type) { conditions.push('r.report_type = @report_type'); params.report_type = report_type; }
        if (status) { conditions.push('r.status = @status'); params.status = status; }
        if (date_from) { conditions.push('r.inspection_date >= @date_from'); params.date_from = date_from; }
        if (date_to) { conditions.push('r.inspection_date <= @date_to'); params.date_to = date_to; }
        if (search) {
            conditions.push('(r.client LIKE @search OR r.job_order LIKE @search OR r.report_number LIKE @search OR r.inspector LIKE @search)');
            params.search = `%${search}%`;
        }

        const where = conditions.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            query(`
                SELECT r.id, r.uuid, r.report_number, r.report_type, r.report_year,
                       r.client, r.job_order, r.inspector, r.status,
                       r.inspection_date, r.certificate_date,
                       r.created_at, r.updated_at,
                       c.name AS company_name,
                       (SELECT COUNT(*) FROM ndt_report_items i WHERE i.report_id = r.id) AS items_count
                FROM ndt_reports r
                LEFT JOIN companies c ON c.id = r.company_id
                WHERE ${where}
                ORDER BY r.updated_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `, params),
            query(`SELECT COUNT(*) AS total FROM ndt_reports r WHERE ${where}`, params),
        ]);

        res.json({
            success: true,
            data: dataResult.recordset,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.recordset[0].total,
                totalPages: Math.ceil(countResult.recordset[0].total / parseInt(limit)),
            },
        });
    } catch (err) {
        logger.error('listNdtReports error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero verbali CND', code: 'NDT_LIST_ERROR' });
    }
}

// ── GET /ndt-reports/:id ──────────────────────────────────────────────────────
async function getNdtReport(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id);

        const [reportResult, itemsResult, instrumentsResult] = await Promise.all([
            query(`
                SELECT r.*, c.name AS company_name
                FROM ndt_reports r
                LEFT JOIN companies c ON c.id = r.company_id
                WHERE r.id = @id AND r.organization_id = @organization_id AND r.is_deleted = 0
            `, { id, organization_id }),
            query(`
                SELECT id, report_id, sort_order, position_code, quantity, description, examined_part, surface_condition, inspection_percentage, defects, evaluation, notes, created_at, updated_at FROM ndt_report_items WHERE report_id = @id ORDER BY sort_order ASC
            `, { id }),
            query(`
                SELECT ri.*, ea.name AS asset_name, ea.model, ea.serial_number,
                       ea.status AS asset_status, ea.next_calibration_date,
                       DATEDIFF(day, GETDATE(), ea.next_calibration_date) AS days_to_expiry
                FROM ndt_report_instruments ri
                JOIN equipment_assets ea ON ea.id = ri.asset_id
                WHERE ri.report_id = @id
            `, { id }),
        ]);

        if (reportResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Verbale CND non trovato', code: 'NDT_NOT_FOUND' });
        }

        const report = reportResult.recordset[0];
        const accessList = await ensureCompanyAccessLoaded(req.user);
        if (hasCompanyAccessRows(accessList)) {
            if (!report.company_id) {
                return res.status(403).json({ error: 'Azienda non accessibile', code: 'FORBIDDEN' });
            }
            const denied = await assertCompanyAccess(req.user, report.company_id, 'read');
            if (denied) return sendAccessDenied(res, denied);
        }

        res.json({
            success: true,
            data: {
                ...report,
                items: itemsResult.recordset,
                instruments: instrumentsResult.recordset,
            },
        });
    } catch (err) {
        logger.error('getNdtReport error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero verbale CND', code: 'NDT_GET_ERROR' });
    }
}

// ── POST /ndt-reports ─────────────────────────────────────────────────────────
async function createNdtReport(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id, report_type = 'VT',
            client, supplier_name, job_order, wps_number, wps_id,
            base_material, material_standard, joint_type, quality_level,
            method_params, notes,
            inspection_date, certificate_date,
            responsible, inspector, client_representative,
            status = 'draft',
            items = [],
            instrument_ids = [],
        } = req.body;

        const companyIdVal = company_id ? parseInt(company_id) : null;
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: companyIdVal });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const year = new Date().getFullYear();
        const report_number = await allocateReportNumber(query, report_type, year, organization_id);

        // Inserisce testata
        const reportResult = await query(`
            INSERT INTO ndt_reports (
                organization_id, company_id, report_type, report_number, report_year,
                client, supplier_name, job_order, wps_number, wps_id,
                base_material, material_standard, joint_type, quality_level,
                method_params, notes,
                inspection_date, certificate_date,
                responsible, inspector, client_representative,
                status, created_by
            )
            OUTPUT INSERTED.*
            VALUES (
                @organization_id, @company_id, @report_type, @report_number, @report_year,
                @client, @supplier_name, @job_order, @wps_number, @wps_id,
                @base_material, @material_standard, @joint_type, @quality_level,
                @method_params, @notes,
                @inspection_date, @certificate_date,
                @responsible, @inspector, @client_representative,
                @status, @created_by
            )
        `, {
            organization_id,
            company_id: companyIdVal,
            report_type,
            report_number,
            report_year: year,
            client: client || null,
            supplier_name: supplier_name || null,
            job_order: job_order || null,
            wps_number: wps_number || null,
            wps_id: wps_id ? parseInt(wps_id) : null,
            base_material: base_material || null,
            material_standard: material_standard || null,
            joint_type: joint_type || 'SALDATURA AD ANGOLO MONO E MULTI PASSATA',
            quality_level: quality_level || 'UNI EN ISO 5817 Lev.C',
            method_params: method_params ? JSON.stringify(method_params) : null,
            notes: notes || 'NULLA DA SEGNALARE, L\'ESITO \u00C8 DA RITENERSI SODDISFACENTE.',
            inspection_date: inspection_date || null,
            certificate_date: certificate_date || null,
            responsible: responsible || null,
            // Auto-fill ispettore: usa nome utente loggato se non fornito
            inspector: inspector || req.user.full_name || null,
            client_representative: client_representative || null,
            status,
            created_by: req.user.user_id,
        });

        const report_id = reportResult.recordset[0].id;

        // Inserisce righe Elenco Marche
        if (items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await query(`
                    INSERT INTO ndt_report_items
                        (report_id, sort_order, position_code, quantity, description,
                         examined_part, surface_condition, inspection_percentage, defects, evaluation, notes)
                    VALUES
                        (@report_id, @sort_order, @position_code, @quantity, @description,
                         @examined_part, @surface_condition, @inspection_percentage, @defects, @evaluation, @notes)
                `, {
                    report_id,
                    sort_order: i,
                    position_code: item.position_code || null,
                    quantity: item.quantity || null,
                    description: item.description || null,
                    examined_part: item.examined_part || 'SALDATURA',
                    surface_condition: item.surface_condition || 'M/S',
                    inspection_percentage: item.inspection_percentage !== undefined ? parseInt(item.inspection_percentage) : 100,
                    defects: item.defects || 'NESSUNO',
                    evaluation: item.evaluation || 'A',
                    notes: item.notes || null,
                });
            }
        }

        // Inserisce strumenti usati
        if (instrument_ids.length > 0) {
            for (const inst of instrument_ids) {
                await query(`
                    INSERT INTO ndt_report_instruments (report_id, asset_id, instrument_role, measured_value)
                    VALUES (@report_id, @asset_id, @instrument_role, @measured_value)
                `, {
                    report_id,
                    asset_id: parseInt(inst.asset_id || inst),
                    instrument_role: inst.instrument_role || null,
                    measured_value: inst.measured_value ? JSON.stringify(inst.measured_value) : null,
                });
            }
        }

        res.status(201).json({ success: true, data: reportResult.recordset[0] });
    } catch (err) {
        logger.error('createNdtReport error', { error: err.message });
        res.status(500).json({ error: 'Errore creazione verbale CND', code: 'NDT_CREATE_ERROR' });
    }
}

// ── PUT /ndt-reports/:id ──────────────────────────────────────────────────────
async function updateNdtReport(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id);

        const existing = await query(
            `SELECT id, company_id FROM ndt_reports WHERE id = @id AND organization_id = @organization_id AND is_deleted = 0`,
            { id, organization_id }
        );
        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Verbale CND non trovato', code: 'NDT_NOT_FOUND' });
        }

        const existingCompanyId = existing.recordset[0].company_id;
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: existingCompanyId });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const {
            company_id, client, supplier_name, job_order, wps_number, wps_id,
            base_material, material_standard, joint_type, quality_level,
            method_params, notes,
            inspection_date, certificate_date,
            responsible, inspector, client_representative,
            status, items, instrument_ids,
        } = req.body;

        const nextCompanyId = company_id !== undefined
            ? (company_id ? parseInt(company_id) : null)
            : existingCompanyId;
        if (nextCompanyId !== existingCompanyId) {
            const nextDenied = await assertMutatingAllowed(req.user, { companyId: nextCompanyId });
            if (nextDenied) return sendAccessDenied(res, nextDenied);
        }

        await query(`
            UPDATE ndt_reports SET
                company_id = @company_id, client = @client, supplier_name = @supplier_name, job_order = @job_order,
                wps_number = @wps_number, wps_id = @wps_id,
                base_material = @base_material, material_standard = @material_standard,
                joint_type = @joint_type, quality_level = @quality_level,
                method_params = @method_params, notes = @notes,
                inspection_date = @inspection_date, certificate_date = @certificate_date,
                responsible = @responsible, inspector = @inspector,
                client_representative = @client_representative,
                status = @status,
                updated_at = GETDATE()
            WHERE id = @id
        `, {
            id,
            company_id: nextCompanyId,
            client: client || null,
            supplier_name: supplier_name || null,
            job_order: job_order || null,
            wps_number: wps_number || null,
            wps_id: wps_id ? parseInt(wps_id) : null,
            base_material: base_material || null,
            material_standard: material_standard || null,
            joint_type: joint_type || null,
            quality_level: quality_level || null,
            method_params: method_params ? JSON.stringify(method_params) : null,
            notes: notes || null,
            inspection_date: inspection_date || null,
            certificate_date: certificate_date || null,
            responsible: responsible || null,
            inspector: inspector || null,
            client_representative: client_representative || null,
            status: status || 'draft',
        });

        // Aggiorna righe Elenco Marche (replace completo)
        if (items !== undefined) {
            await query(`DELETE FROM ndt_report_items WHERE report_id = @id`, { id });
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await query(`
                    INSERT INTO ndt_report_items
                        (report_id, sort_order, position_code, quantity, description,
                         examined_part, surface_condition, inspection_percentage, defects, evaluation, notes)
                    VALUES
                        (@report_id, @sort_order, @position_code, @quantity, @description,
                         @examined_part, @surface_condition, @inspection_percentage, @defects, @evaluation, @notes)
                `, {
                    report_id: id,
                    sort_order: i,
                    position_code: item.position_code || null,
                    quantity: item.quantity || null,
                    description: item.description || null,
                    examined_part: item.examined_part || 'SALDATURA',
                    surface_condition: item.surface_condition || 'M/S',
                    inspection_percentage: item.inspection_percentage !== undefined ? parseInt(item.inspection_percentage) : 100,
                    defects: item.defects || 'NESSUNO',
                    evaluation: item.evaluation || 'A',
                    notes: item.notes || null,
                });
            }
        }

        // Aggiorna strumenti (replace completo)
        if (instrument_ids !== undefined) {
            await query(`DELETE FROM ndt_report_instruments WHERE report_id = @id`, { id });
            for (const inst of instrument_ids) {
                await query(`
                    INSERT INTO ndt_report_instruments (report_id, asset_id, instrument_role, measured_value)
                    VALUES (@report_id, @asset_id, @instrument_role, @measured_value)
                `, {
                    report_id: id,
                    asset_id: parseInt(inst.asset_id || inst),
                    instrument_role: inst.instrument_role || null,
                    measured_value: inst.measured_value ? JSON.stringify(inst.measured_value) : null,
                });
            }
        }

        const updated = await query(
            `SELECT r.*, c.name AS company_name FROM ndt_reports r LEFT JOIN companies c ON c.id = r.company_id WHERE r.id = @id`,
            { id }
        );

        res.json({ success: true, data: updated.recordset[0] });
    } catch (err) {
        logger.error('updateNdtReport error', { error: err.message });
        res.status(500).json({ error: 'Errore aggiornamento verbale CND', code: 'NDT_UPDATE_ERROR' });
    }
}

// ── DELETE /ndt-reports/:id (soft delete) ────────────────────────────────────
async function deleteNdtReport(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id);

        const existing = await query(
            `SELECT id, company_id FROM ndt_reports WHERE id = @id AND organization_id = @organization_id AND is_deleted = 0`,
            { id, organization_id }
        );
        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Verbale CND non trovato', code: 'NDT_NOT_FOUND' });
        }

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: existing.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await query(`UPDATE ndt_reports SET is_deleted = 1, updated_at = GETDATE() WHERE id = @id`, { id });
        res.json({ success: true });
    } catch (err) {
        logger.error('deleteNdtReport error', { error: err.message });
        res.status(500).json({ error: 'Errore eliminazione verbale CND', code: 'NDT_DELETE_ERROR' });
    }
}

module.exports = {
    getNdtStats,
    listNdtReports,
    getNdtReport,
    createNdtReport,
    updateNdtReport,
    deleteNdtReport,
};
