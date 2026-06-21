/**
 * equipment.controller.js — CRUD Strumenti e Attrezzature CND/SGQ
 *
 * Multi-tenant: organization_id dal JWT.
 * company_id NULL = asset dello studio (visibile a tutte le aziende del tenant).
 * company_id = X  = asset dell'azienda X (visibile solo a X e allo studio).
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ── Scope helper ────────────────────────────────────────────────────────────
// Un utente studio vede: asset del proprio studio (company_id IS NULL)
//                       + asset di tutte le aziende del tenant
// Un utente azienda vede: asset dello studio (company_id IS NULL)
//                        + asset della propria azienda

function buildScopeCondition(user, alias = 'ea') {
    const { organization_id, company_id: userCompanyId, role } = user;
    // Studio admin/superadmin/auditor: vede tutto il tenant
    if (!userCompanyId) {
        return {
            condition: `${alias}.organization_id = @organization_id`,
            params: { organization_id },
        };
    }
    // Utente azienda: vede solo studio (NULL) + la propria azienda
    return {
        condition: `(${alias}.organization_id = @organization_id AND (${alias}.company_id IS NULL OR ${alias}.company_id = @user_company_id))`,
        params: { organization_id, user_company_id: userCompanyId },
    };
}

// ── GET /equipment ───────────────────────────────────────────────────────────
async function listEquipment(req, res) {
    try {
        const scope = buildScopeCondition(req.user);
        const {
            company_id,
            asset_category,
            applicable_method,
            status,
            expiring_days,
            search,
            page  = 1,
            limit = 50,
        } = req.query;

        const conditions = [scope.condition, 'ea.is_deleted = 0'];
        const params = { ...scope.params, limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) };

        if (company_id) { conditions.push('ea.company_id = @company_id'); params.company_id = parseInt(company_id); }
        if (asset_category) { conditions.push('ea.asset_category = @asset_category'); params.asset_category = asset_category; }
        if (status) { conditions.push('ea.status = @status'); params.status = status; }
        if (applicable_method) {
            conditions.push("ea.applicable_methods LIKE @applicable_method");
            params.applicable_method = `%${applicable_method}%`;
        }
        if (expiring_days) {
            const days = parseInt(expiring_days);
            conditions.push('ea.next_calibration_date IS NOT NULL AND ea.next_calibration_date <= DATEADD(day, @expiring_days, GETDATE()) AND ea.requires_calibration = 1');
            params.expiring_days = days;
        }
        if (search) {
            conditions.push('(ea.name LIKE @search OR ea.model LIKE @search OR ea.serial_number LIKE @search OR ea.internal_code LIKE @search)');
            params.search = `%${search}%`;
        }

        const where = conditions.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            query(`
                SELECT ea.*,
                       c.name AS company_name,
                       DATEDIFF(day, GETDATE(), ea.next_calibration_date) AS days_to_expiry
                FROM equipment_assets ea
                LEFT JOIN companies c ON c.id = ea.company_id
                WHERE ${where}
                ORDER BY ea.next_calibration_date ASC, ea.name ASC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `, params),
            query(`SELECT COUNT(*) AS total FROM equipment_assets ea WHERE ${where}`, params),
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
        logger.error('listEquipment error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero strumenti', code: 'EQUIPMENT_LIST_ERROR' });
    }
}

// ── GET /equipment/:id ───────────────────────────────────────────────────────
async function getEquipment(req, res) {
    try {
        const scope = buildScopeCondition(req.user);
        const id = parseInt(req.params.id);

        const [assetResult, calResult] = await Promise.all([
            query(`
                SELECT ea.*, c.name AS company_name,
                       DATEDIFF(day, GETDATE(), ea.next_calibration_date) AS days_to_expiry
                FROM equipment_assets ea
                LEFT JOIN companies c ON c.id = ea.company_id
                WHERE ea.id = @id AND ${scope.condition} AND ea.is_deleted = 0
            `, { id, ...scope.params }),
            query(`
                SELECT ec.*, u.full_name AS created_by_name
                FROM equipment_calibrations ec
                LEFT JOIN users u ON u.user_id = ec.created_by
                WHERE ec.asset_id = @id
                ORDER BY ec.calibration_date DESC
            `, { id }),
        ]);

        if (assetResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Strumento non trovato', code: 'EQUIPMENT_NOT_FOUND' });
        }

        res.json({
            success: true,
            data: { ...assetResult.recordset[0], calibrations: calResult.recordset },
        });
    } catch (err) {
        logger.error('getEquipment error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero strumento', code: 'EQUIPMENT_GET_ERROR' });
    }
}

// ── POST /equipment ──────────────────────────────────────────────────────────
async function createEquipment(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id, asset_category, asset_subcategory,
            name, manufacturer, model, serial_number, internal_code,
            applicable_systems, applicable_methods,
            location, status,
            requires_calibration, calibration_frequency_months,
            last_calibration_date, next_calibration_date,
            purchase_date, purchase_price, notes,
        } = req.body;

        if (!name) return res.status(400).json({ error: 'Il nome è obbligatorio', code: 'EQUIPMENT_NAME_REQUIRED' });

        const result = await query(`
            INSERT INTO equipment_assets (
                organization_id, company_id, asset_category, asset_subcategory,
                name, manufacturer, model, serial_number, internal_code,
                applicable_systems, applicable_methods,
                location, status, requires_calibration, calibration_frequency_months,
                last_calibration_date, next_calibration_date,
                purchase_date, purchase_price, notes, created_by
            )
            OUTPUT INSERTED.*
            VALUES (
                @organization_id, @company_id, @asset_category, @asset_subcategory,
                @name, @manufacturer, @model, @serial_number, @internal_code,
                @applicable_systems, @applicable_methods,
                @location, @status, @requires_calibration, @calibration_frequency_months,
                @last_calibration_date, @next_calibration_date,
                @purchase_date, @purchase_price, @notes, @created_by
            )
        `, {
            organization_id,
            company_id: company_id ? parseInt(company_id) : null,
            asset_category: asset_category || 'measuring_instrument',
            asset_subcategory: asset_subcategory || null,
            name,
            manufacturer: manufacturer || null,
            model: model || null,
            serial_number: serial_number || null,
            internal_code: internal_code || null,
            applicable_systems: applicable_systems ? JSON.stringify(applicable_systems) : null,
            applicable_methods: applicable_methods ? JSON.stringify(applicable_methods) : null,
            location: location || null,
            status: status || 'active',
            requires_calibration: requires_calibration !== false ? 1 : 0,
            calibration_frequency_months: calibration_frequency_months ? parseInt(calibration_frequency_months) : null,
            last_calibration_date: last_calibration_date || null,
            next_calibration_date: next_calibration_date || null,
            purchase_date: purchase_date || null,
            purchase_price: purchase_price ? parseFloat(purchase_price) : null,
            notes: notes || null,
            created_by: req.user.user_id,
        });

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (err) {
        logger.error('createEquipment error', { error: err.message });
        res.status(500).json({ error: 'Errore creazione strumento', code: 'EQUIPMENT_CREATE_ERROR' });
    }
}

// ── PUT /equipment/:id ───────────────────────────────────────────────────────
async function updateEquipment(req, res) {
    try {
        const scope = buildScopeCondition(req.user);
        const id = parseInt(req.params.id);

        const existing = await query(
            `SELECT id FROM equipment_assets ea WHERE ea.id = @id AND ${scope.condition} AND ea.is_deleted = 0`,
            { id, ...scope.params }
        );
        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Strumento non trovato', code: 'EQUIPMENT_NOT_FOUND' });
        }

        const {
            company_id, asset_category, asset_subcategory,
            name, manufacturer, model, serial_number, internal_code,
            applicable_systems, applicable_methods,
            location, status, requires_calibration, calibration_frequency_months,
            last_calibration_date, next_calibration_date,
            purchase_date, purchase_price, notes,
        } = req.body;

        const result = await query(`
            UPDATE equipment_assets
            SET asset_category = @asset_category,
                asset_subcategory = @asset_subcategory,
                company_id = @company_id,
                name = @name,
                manufacturer = @manufacturer,
                model = @model,
                serial_number = @serial_number,
                internal_code = @internal_code,
                applicable_systems = @applicable_systems,
                applicable_methods = @applicable_methods,
                location = @location,
                status = @status,
                requires_calibration = @requires_calibration,
                calibration_frequency_months = @calibration_frequency_months,
                last_calibration_date = @last_calibration_date,
                next_calibration_date = @next_calibration_date,
                purchase_date = @purchase_date,
                purchase_price = @purchase_price,
                notes = @notes,
                updated_at = GETDATE()
            OUTPUT INSERTED.*
            WHERE id = @id
        `, {
            id,
            company_id: company_id ? parseInt(company_id) : null,
            asset_category: asset_category || 'measuring_instrument',
            asset_subcategory: asset_subcategory || null,
            name: name || existing.recordset[0]?.name,
            manufacturer: manufacturer || null,
            model: model || null,
            serial_number: serial_number || null,
            internal_code: internal_code || null,
            applicable_systems: applicable_systems ? JSON.stringify(applicable_systems) : null,
            applicable_methods: applicable_methods ? JSON.stringify(applicable_methods) : null,
            location: location || null,
            status: status || 'active',
            requires_calibration: requires_calibration !== false ? 1 : 0,
            calibration_frequency_months: calibration_frequency_months ? parseInt(calibration_frequency_months) : null,
            last_calibration_date: last_calibration_date || null,
            next_calibration_date: next_calibration_date || null,
            purchase_date: purchase_date || null,
            purchase_price: purchase_price ? parseFloat(purchase_price) : null,
            notes: notes || null,
        });

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        logger.error('updateEquipment error', { error: err.message });
        res.status(500).json({ error: 'Errore aggiornamento strumento', code: 'EQUIPMENT_UPDATE_ERROR' });
    }
}

// ── DELETE /equipment/:id (soft delete) ─────────────────────────────────────
async function deleteEquipment(req, res) {
    try {
        const scope = buildScopeCondition(req.user);
        const id = parseInt(req.params.id);

        const existing = await query(
            `SELECT id FROM equipment_assets ea WHERE ea.id = @id AND ${scope.condition} AND ea.is_deleted = 0`,
            { id, ...scope.params }
        );
        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Strumento non trovato', code: 'EQUIPMENT_NOT_FOUND' });
        }

        await query(`UPDATE equipment_assets SET is_deleted = 1, updated_at = GETDATE() WHERE id = @id`, { id });
        res.json({ success: true });
    } catch (err) {
        logger.error('deleteEquipment error', { error: err.message });
        res.status(500).json({ error: 'Errore eliminazione strumento', code: 'EQUIPMENT_DELETE_ERROR' });
    }
}

// ── POST /equipment/:id/calibrations ─────────────────────────────────────────
async function addCalibration(req, res) {
    try {
        const scope = buildScopeCondition(req.user);
        const asset_id = parseInt(req.params.id);

        const existing = await query(
            `SELECT id FROM equipment_assets ea WHERE ea.id = @id AND ${scope.condition} AND ea.is_deleted = 0`,
            { id: asset_id, ...scope.params }
        );
        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Strumento non trovato', code: 'EQUIPMENT_NOT_FOUND' });
        }

        const { calibration_date, next_calibration_date, calibrated_by, certificate_number, result: calResult, attachment_id, notes } = req.body;
        if (!calibration_date || !next_calibration_date) {
            return res.status(400).json({ error: 'Date taratura obbligatorie', code: 'CALIBRATION_DATES_REQUIRED' });
        }

        // Inserisce la taratura (event log)
        const insertResult = await query(`
            INSERT INTO equipment_calibrations
                (asset_id, calibration_date, next_calibration_date, calibrated_by, certificate_number, result, attachment_id, notes, created_by)
            OUTPUT INSERTED.*
            VALUES (@asset_id, @calibration_date, @next_calibration_date, @calibrated_by, @certificate_number, @result, @attachment_id, @notes, @created_by)
        `, {
            asset_id,
            calibration_date,
            next_calibration_date,
            calibrated_by: calibrated_by || null,
            certificate_number: certificate_number || null,
            result: calResult || 'pass',
            attachment_id: attachment_id ? parseInt(attachment_id) : null,
            notes: notes || null,
            created_by: req.user.user_id,
        });

        // Aggiorna denormalizzazione su equipment_assets
        await query(`
            UPDATE equipment_assets
            SET last_calibration_date = @calibration_date,
                next_calibration_date = @next_calibration_date,
                updated_at = GETDATE()
            WHERE id = @asset_id
        `, { asset_id, calibration_date, next_calibration_date });

        res.status(201).json({ success: true, data: insertResult.recordset[0] });
    } catch (err) {
        logger.error('addCalibration error', { error: err.message });
        res.status(500).json({ error: 'Errore registrazione taratura', code: 'CALIBRATION_CREATE_ERROR' });
    }
}

// ── GET /equipment/:id/calibrations ──────────────────────────────────────────
async function getCalibrations(req, res) {
    try {
        const asset_id = parseInt(req.params.id);
        const result = await query(`
            SELECT ec.*, u.full_name AS created_by_name
            FROM equipment_calibrations ec
            LEFT JOIN users u ON u.user_id = ec.created_by
            WHERE ec.asset_id = @asset_id
            ORDER BY ec.calibration_date DESC
        `, { asset_id });
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        logger.error('getCalibrations error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero tarature', code: 'CALIBRATION_LIST_ERROR' });
    }
}

// ── GET /equipment/stats ──────────────────────────────────────────────────────
async function getEquipmentStats(req, res) {
    try {
        const scope = buildScopeCondition(req.user);
        const result = await query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN ea.status = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN ea.status = 'calibrating' THEN 1 ELSE 0 END) AS calibrating,
                SUM(CASE WHEN ea.status = 'retired' THEN 1 ELSE 0 END) AS retired,
                SUM(CASE WHEN ea.next_calibration_date < GETDATE() AND ea.requires_calibration = 1 AND ea.status = 'active' THEN 1 ELSE 0 END) AS expired,
                SUM(CASE WHEN ea.next_calibration_date BETWEEN GETDATE() AND DATEADD(day, 30, GETDATE()) AND ea.requires_calibration = 1 AND ea.status = 'active' THEN 1 ELSE 0 END) AS expiring_30d
            FROM equipment_assets ea
            WHERE ${scope.condition} AND ea.is_deleted = 0
        `, scope.params);

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        logger.error('getEquipmentStats error', { error: err.message });
        res.status(500).json({ error: 'Errore statistiche strumenti', code: 'EQUIPMENT_STATS_ERROR' });
    }
}

// ── GET /equipment/for-report?method=VT ──────────────────────────────────────
// Usato dal form VT per popolare la select strumenti con stato e avvisi taratura
async function getEquipmentForReport(req, res) {
    try {
        const scope = buildScopeCondition(req.user);
        const { method, company_id } = req.query;

        const conditions = [scope.condition, "ea.is_deleted = 0", "ea.status != 'retired'", "ea.status != 'lost'"];
        const params = { ...scope.params };

        if (method) {
            conditions.push("ea.applicable_methods LIKE @method");
            params.method = `%${method}%`;
        }
        if (company_id) {
            // Strumenti dello studio (NULL) o dell'azienda specifica
            conditions.push("(ea.company_id IS NULL OR ea.company_id = @filter_company_id)");
            params.filter_company_id = parseInt(company_id);
        }

        const result = await query(`
            SELECT ea.id, ea.name, ea.model, ea.serial_number, ea.asset_subcategory,
                   ea.status, ea.next_calibration_date, ea.company_id,
                   DATEDIFF(day, GETDATE(), ea.next_calibration_date) AS days_to_expiry,
                   CASE
                       WHEN ea.next_calibration_date < GETDATE() THEN 'expired'
                       WHEN ea.next_calibration_date <= DATEADD(day, 30, GETDATE()) THEN 'expiring'
                       ELSE 'ok'
                   END AS calibration_status
            FROM equipment_assets ea
            WHERE ${conditions.join(' AND ')}
            ORDER BY ea.asset_subcategory, ea.name
        `, params);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        logger.error('getEquipmentForReport error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero strumenti per verbale', code: 'EQUIPMENT_FOR_REPORT_ERROR' });
    }
}

module.exports = {
    listEquipment,
    getEquipment,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    addCalibration,
    getCalibrations,
    getEquipmentStats,
    getEquipmentForReport,
};
