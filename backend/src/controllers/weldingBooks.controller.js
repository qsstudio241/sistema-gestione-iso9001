/**
 * weldingBooks.controller.js — CRUD Welding Book ISO 3834 (IOF)
 * Tenant-isolated: organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

async function allocateBookNumber(report_year, organization_id) {
    const result = await query(`
        SELECT COUNT(*) AS cnt
        FROM welding_books
        WHERE book_year = @book_year
          AND organization_id = @organization_id
          AND book_number IS NOT NULL
    `, { book_year: report_year, organization_id });

    const seq = result.recordset[0].cnt + 1;
    return `WB-${report_year}-${String(seq).padStart(3, '0')}`;
}

function parseJsonField(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

// ── GET /welding-books/stats ─────────────────────────────────────────────────
async function getWeldingBookStats(req, res) {
    try {
        const { organization_id } = req.user;
        const { company_id } = req.query;

        const conditions = ['b.organization_id = @organization_id', 'b.is_deleted = 0'];
        const params = { organization_id };
        if (company_id) {
            conditions.push('b.company_id = @company_id');
            params.company_id = parseInt(company_id, 10);
        }

        const result = await query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN b.status = 'draft' THEN 1 ELSE 0 END) AS draft,
                SUM(CASE WHEN b.status = 'released' THEN 1 ELSE 0 END) AS released
            FROM welding_books b
            WHERE ${conditions.join(' AND ')}
        `, params);

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        logger.error('getWeldingBookStats error', { error: err.message });
        res.status(500).json({ error: 'Errore statistiche Welding Book', code: 'WB_STATS_ERROR' });
    }
}

// ── GET /welding-books ───────────────────────────────────────────────────────
async function listWeldingBooks(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id, status, search,
            page = 1, limit = 50,
        } = req.query;

        const conditions = ['b.organization_id = @organization_id', 'b.is_deleted = 0'];
        const params = {
            organization_id,
            limit: parseInt(limit, 10),
            offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
        };

        if (company_id) {
            conditions.push('b.company_id = @company_id');
            params.company_id = parseInt(company_id, 10);
        }
        if (status) {
            conditions.push('b.status = @status');
            params.status = status;
        }
        if (search) {
            conditions.push(`(
                b.product_code LIKE @search OR b.product_description LIKE @search
                OR b.book_number LIKE @search OR b.job_order LIKE @search
                OR b.client_name LIKE @search
            )`);
            params.search = `%${search}%`;
        }

        const where = conditions.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            query(`
                SELECT b.id, b.uuid, b.book_number, b.book_year,
                       b.product_code, b.product_description, b.job_order,
                       b.client_name, b.wps_code, b.wpqr_code,
                       b.coordinator_name, b.status, b.document_revision,
                       b.created_at, b.updated_at,
                       c.name AS company_name,
                       (SELECT COUNT(*) FROM welding_book_welds w WHERE w.book_id = b.id) AS welds_count
                FROM welding_books b
                LEFT JOIN companies c ON c.id = b.company_id
                WHERE ${where}
                ORDER BY b.updated_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `, params),
            query(`SELECT COUNT(*) AS total FROM welding_books b WHERE ${where}`, params),
        ]);

        res.json({
            success: true,
            data: dataResult.recordset,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total: countResult.recordset[0].total,
                totalPages: Math.ceil(countResult.recordset[0].total / parseInt(limit, 10)),
            },
        });
    } catch (err) {
        logger.error('listWeldingBooks error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero Welding Book', code: 'WB_LIST_ERROR' });
    }
}

async function loadBookChildren(bookId) {
    const [equipmentResult, weldsResult] = await Promise.all([
        query(`
            SELECT be.id, be.book_id, be.asset_id, be.equipment_role, be.sort_order, be.notes,
                   ea.internal_code, ea.name AS asset_name, ea.model, ea.serial_number
            FROM welding_book_equipment be
            JOIN equipment_assets ea ON ea.id = be.asset_id
            WHERE be.book_id = @book_id
            ORDER BY be.sort_order ASC, be.id ASC
        `, { book_id: bookId }),
        query(`
            SELECT id, book_id, sort_order, sequence_no, joint_code, joint_description,
                   wps_id, welder_name, weld_date, weld_params, notes,
                   created_at, updated_at
            FROM welding_book_welds
            WHERE book_id = @book_id
            ORDER BY sort_order ASC, id ASC
        `, { book_id: bookId }),
    ]);

    return {
        equipment: equipmentResult.recordset,
        welds: weldsResult.recordset.map((row) => ({
            ...row,
            weld_params: row.weld_params
                ? (typeof row.weld_params === 'string' ? JSON.parse(row.weld_params) : row.weld_params)
                : {},
        })),
    };
}

// ── GET /welding-books/:id ───────────────────────────────────────────────────
async function getWeldingBook(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id, 10);

        const bookResult = await query(`
            SELECT b.*, c.name AS company_name
            FROM welding_books b
            LEFT JOIN companies c ON c.id = b.company_id
            WHERE b.id = @id AND b.organization_id = @organization_id AND b.is_deleted = 0
        `, { id, organization_id });

        if (bookResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Welding Book non trovato', code: 'WB_NOT_FOUND' });
        }

        const children = await loadBookChildren(id);

        res.json({
            success: true,
            data: {
                ...bookResult.recordset[0],
                ...children,
            },
        });
    } catch (err) {
        logger.error('getWeldingBook error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero Welding Book', code: 'WB_GET_ERROR' });
    }
}

async function replaceEquipment(bookId, equipment = []) {
    await query(`DELETE FROM welding_book_equipment WHERE book_id = @book_id`, { book_id: bookId });
    for (let i = 0; i < equipment.length; i++) {
        const row = equipment[i];
        if (!row.asset_id) continue;
        await query(`
            INSERT INTO welding_book_equipment (book_id, asset_id, equipment_role, sort_order, notes)
            VALUES (@book_id, @asset_id, @equipment_role, @sort_order, @notes)
        `, {
            book_id: bookId,
            asset_id: parseInt(row.asset_id, 10),
            equipment_role: row.equipment_role || 'other',
            sort_order: row.sort_order != null ? row.sort_order : i,
            notes: row.notes || null,
        });
    }
}

async function replaceWelds(bookId, welds = []) {
    await query(`DELETE FROM welding_book_welds WHERE book_id = @book_id`, { book_id: bookId });
    for (let i = 0; i < welds.length; i++) {
        const row = welds[i];
        await query(`
            INSERT INTO welding_book_welds (
                book_id, sort_order, sequence_no, joint_code, joint_description,
                wps_id, welder_name, weld_date, weld_params, notes
            )
            VALUES (
                @book_id, @sort_order, @sequence_no, @joint_code, @joint_description,
                @wps_id, @welder_name, @weld_date, @weld_params, @notes
            )
        `, {
            book_id: bookId,
            sort_order: row.sort_order != null ? row.sort_order : i,
            sequence_no: row.sequence_no || null,
            joint_code: row.joint_code || null,
            joint_description: row.joint_description || null,
            wps_id: row.wps_id ? parseInt(row.wps_id, 10) : null,
            welder_name: row.welder_name || null,
            weld_date: row.weld_date || null,
            weld_params: parseJsonField(row.weld_params),
            notes: row.notes || null,
        });
    }
}

// ── POST /welding-books ──────────────────────────────────────────────────────
async function createWeldingBook(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id, project_id,
            product_code, product_description, job_order, client_name,
            drawing_ref, drawing_revision,
            wps_id, wpqr_id, wps_code, wpqr_code,
            base_material, filler_material, welding_process,
            coordinator_name, document_revision, notes,
            status = 'draft',
            equipment = [],
            welds = [],
        } = req.body;

        const book_year = new Date().getFullYear();
        const book_number = await allocateBookNumber(book_year, organization_id);

        const bookResult = await query(`
            INSERT INTO welding_books (
                organization_id, company_id, book_number, book_year, project_id,
                product_code, product_description, job_order, client_name,
                drawing_ref, drawing_revision,
                wps_id, wpqr_id, wps_code, wpqr_code,
                base_material, filler_material, welding_process,
                coordinator_name, document_revision, notes,
                status, created_by
            )
            OUTPUT INSERTED.*
            VALUES (
                @organization_id, @company_id, @book_number, @book_year, @project_id,
                @product_code, @product_description, @job_order, @client_name,
                @drawing_ref, @drawing_revision,
                @wps_id, @wpqr_id, @wps_code, @wpqr_code,
                @base_material, @filler_material, @welding_process,
                @coordinator_name, @document_revision, @notes,
                @status, @created_by
            )
        `, {
            organization_id,
            company_id: company_id ? parseInt(company_id, 10) : null,
            book_number,
            book_year,
            project_id: project_id ? parseInt(project_id, 10) : null,
            product_code: product_code || null,
            product_description: product_description || null,
            job_order: job_order || null,
            client_name: client_name || null,
            drawing_ref: drawing_ref || null,
            drawing_revision: drawing_revision || null,
            wps_id: wps_id ? parseInt(wps_id, 10) : null,
            wpqr_id: wpqr_id ? parseInt(wpqr_id, 10) : null,
            wps_code: wps_code || null,
            wpqr_code: wpqr_code || null,
            base_material: base_material || null,
            filler_material: filler_material || null,
            welding_process: welding_process || null,
            coordinator_name: coordinator_name || null,
            document_revision: document_revision || '0',
            notes: notes || null,
            status,
            created_by: req.user.user_id || null,
        });

        const book = bookResult.recordset[0];
        await replaceEquipment(book.id, equipment);
        await replaceWelds(book.id, welds);

        const children = await loadBookChildren(book.id);
        res.status(201).json({ success: true, data: { ...book, ...children } });
    } catch (err) {
        logger.error('createWeldingBook error', { error: err.message });
        res.status(500).json({ error: 'Errore creazione Welding Book', code: 'WB_CREATE_ERROR' });
    }
}

// ── PUT /welding-books/:id ───────────────────────────────────────────────────
async function updateWeldingBook(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id, 10);
        const {
            company_id, project_id,
            product_code, product_description, job_order, client_name,
            drawing_ref, drawing_revision,
            wps_id, wpqr_id, wps_code, wpqr_code,
            base_material, filler_material, welding_process,
            coordinator_name, document_revision, notes, status,
            equipment, welds,
        } = req.body;

        const existing = await query(`
            SELECT id FROM welding_books
            WHERE id = @id AND organization_id = @organization_id AND is_deleted = 0
        `, { id, organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Welding Book non trovato', code: 'WB_NOT_FOUND' });
        }

        await query(`
            UPDATE welding_books SET
                company_id = @company_id,
                project_id = @project_id,
                product_code = @product_code,
                product_description = @product_description,
                job_order = @job_order,
                client_name = @client_name,
                drawing_ref = @drawing_ref,
                drawing_revision = @drawing_revision,
                wps_id = @wps_id,
                wpqr_id = @wpqr_id,
                wps_code = @wps_code,
                wpqr_code = @wpqr_code,
                base_material = @base_material,
                filler_material = @filler_material,
                welding_process = @welding_process,
                coordinator_name = @coordinator_name,
                document_revision = @document_revision,
                notes = @notes,
                status = COALESCE(@status, status),
                updated_at = GETDATE()
            WHERE id = @id AND organization_id = @organization_id
        `, {
            id,
            organization_id,
            company_id: company_id ? parseInt(company_id, 10) : null,
            project_id: project_id ? parseInt(project_id, 10) : null,
            product_code: product_code || null,
            product_description: product_description || null,
            job_order: job_order || null,
            client_name: client_name || null,
            drawing_ref: drawing_ref || null,
            drawing_revision: drawing_revision || null,
            wps_id: wps_id ? parseInt(wps_id, 10) : null,
            wpqr_id: wpqr_id ? parseInt(wpqr_id, 10) : null,
            wps_code: wps_code || null,
            wpqr_code: wpqr_code || null,
            base_material: base_material || null,
            filler_material: filler_material || null,
            welding_process: welding_process || null,
            coordinator_name: coordinator_name || null,
            document_revision: document_revision || '0',
            notes: notes || null,
            status: status || null,
        });

        if (Array.isArray(equipment)) await replaceEquipment(id, equipment);
        if (Array.isArray(welds)) await replaceWelds(id, welds);

        const bookResult = await query(`SELECT * FROM welding_books WHERE id = @id`, { id });
        const children = await loadBookChildren(id);
        res.json({ success: true, data: { ...bookResult.recordset[0], ...children } });
    } catch (err) {
        logger.error('updateWeldingBook error', { error: err.message });
        res.status(500).json({ error: 'Errore aggiornamento Welding Book', code: 'WB_UPDATE_ERROR' });
    }
}

// ── DELETE /welding-books/:id ────────────────────────────────────────────────
async function deleteWeldingBook(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id, 10);

        const result = await query(`
            UPDATE welding_books SET is_deleted = 1, updated_at = GETDATE()
            WHERE id = @id AND organization_id = @organization_id AND is_deleted = 0
        `, { id, organization_id });

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Welding Book non trovato', code: 'WB_NOT_FOUND' });
        }

        res.json({ success: true });
    } catch (err) {
        logger.error('deleteWeldingBook error', { error: err.message });
        res.status(500).json({ error: 'Errore eliminazione Welding Book', code: 'WB_DELETE_ERROR' });
    }
}

module.exports = {
    getWeldingBookStats,
    listWeldingBooks,
    getWeldingBook,
    createWeldingBook,
    updateWeldingBook,
    deleteWeldingBook,
};
