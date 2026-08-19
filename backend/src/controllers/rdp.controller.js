/**
 * rdp.controller.js — CRUD Rapporti di Prova (RDP, Scenario 4 — cliente Mason)
 *
 * Riferimento: docs/PROJECT_ROADMAP.md sezione "Modulo RDP - Rapporto di Prova
 * (Scenario 4 - Mason)". Struttura dati: rdp_reports (testata) -> rdp_sections
 * (aree, es. "GESTIONE QUALITA'") -> rdp_tests (singola prova con foto obbligatorie
 * tramite attachments.rdp_test_id).
 *
 * Numerazione automatica: RDP-YYYY-NNN (pattern identico a ndt_reports).
 * Tenant-isolated: organization_id dal JWT.
 *
 * Nota update sezioni/prove: a differenza del pattern "replace completo" usato in
 * altri moduli (es. ndt_report_items), qui si usa un upsert-by-id perche' le foto
 * (attachments.rdp_test_id) sono FK verso rdp_tests.id senza ON DELETE CASCADE —
 * un delete+recreate romperebbe il vincolo o orfanizzerebbe le foto gia' caricate.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { resolveOptionalProjectId } = require('../utils/resolveOptionalProjectId');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    hasCompanyAccessRows,
    assertCompanyAccess,
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');

// ── Numerazione automatica ───────────────────────────────────────────────────
async function allocateReportNumber(organization_id, report_year) {
    const result = await query(`
        SELECT COUNT(*) AS cnt
        FROM rdp_reports
        WHERE organization_id = @organization_id
          AND report_year = @report_year
          AND report_number IS NOT NULL
    `, { organization_id, report_year });

    const seq = result.recordset[0].cnt + 1;
    return `RDP-${report_year}-${String(seq).padStart(3, '0')}`;
}

// ── Helper: media punteggi (ignora NULL) ─────────────────────────────────────
function computeAverageScore(sections) {
    const scores = [];
    for (const section of sections || []) {
        for (const test of section.tests || []) {
            const s = test.score !== undefined && test.score !== null && test.score !== ''
                ? parseFloat(String(test.score).replace(',', '.'))
                : null;
            if (s !== null && !Number.isNaN(s)) scores.push(s);
        }
    }
    if (scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg * 100) / 100;
}

// ── Upsert sezioni + prove (preserva id esistenti per non orfanizzare le foto) ─
async function upsertSectionsAndTests(reportId, sections) {
    const existingSectionsResult = await query(
        `SELECT id FROM rdp_sections WHERE report_id = @report_id`,
        { report_id: reportId }
    );
    const existingSectionIds = new Set(existingSectionsResult.recordset.map((r) => r.id));
    const keptSectionIds = new Set();

    for (let sIdx = 0; sIdx < (sections || []).length; sIdx++) {
        const section = sections[sIdx];
        let sectionId = section.id ? parseInt(section.id) : null;

        if (sectionId && existingSectionIds.has(sectionId)) {
            await query(`
                UPDATE rdp_sections SET title = @title, sort_order = @sort_order, updated_at = GETDATE()
                WHERE id = @id AND report_id = @report_id
            `, { id: sectionId, report_id: reportId, title: section.title || `Sezione ${sIdx + 1}`, sort_order: sIdx });
        } else {
            const insertResult = await query(`
                INSERT INTO rdp_sections (report_id, sort_order, title)
                OUTPUT INSERTED.id
                VALUES (@report_id, @sort_order, @title)
            `, { report_id: reportId, sort_order: sIdx, title: section.title || `Sezione ${sIdx + 1}` });
            sectionId = insertResult.recordset[0].id;
        }
        keptSectionIds.add(sectionId);

        // ── Prove della sezione ──────────────────────────────────────────────
        const existingTestsResult = await query(
            `SELECT id FROM rdp_tests WHERE section_id = @section_id`,
            { section_id: sectionId }
        );
        const existingTestIds = new Set(existingTestsResult.recordset.map((r) => r.id));
        const keptTestIds = new Set();

        const tests = section.tests || [];
        for (let tIdx = 0; tIdx < tests.length; tIdx++) {
            const test = tests[tIdx];
            const scoreValue = test.score !== undefined && test.score !== null && test.score !== ''
                ? parseFloat(String(test.score).replace(',', '.'))
                : null;
            const params = {
                section_id: sectionId,
                sort_order: tIdx,
                reference_code: test.reference_code || null,
                test_name: test.test_name || '',
                expected_value: test.expected_value || null,
                measured_value: test.measured_value || null,
                evidence_notes: test.evidence_notes || null,
                score: scoreValue,
                result_code: test.result_code || null,
            };
            let testId = test.id ? parseInt(test.id) : null;

            if (testId && existingTestIds.has(testId)) {
                await query(`
                    UPDATE rdp_tests SET
                        sort_order = @sort_order, reference_code = @reference_code, test_name = @test_name,
                        expected_value = @expected_value, measured_value = @measured_value,
                        evidence_notes = @evidence_notes, score = @score, result_code = @result_code,
                        updated_at = GETDATE()
                    WHERE id = @test_id AND section_id = @section_id
                `, { ...params, test_id: testId });
            } else {
                const insertResult = await query(`
                    INSERT INTO rdp_tests (
                        section_id, sort_order, reference_code, test_name,
                        expected_value, measured_value, evidence_notes, score, result_code
                    )
                    OUTPUT INSERTED.id
                    VALUES (
                        @section_id, @sort_order, @reference_code, @test_name,
                        @expected_value, @measured_value, @evidence_notes, @score, @result_code
                    )
                `, params);
                testId = insertResult.recordset[0].id;
            }
            keptTestIds.add(testId);
        }

        // Rimuove prove non piu' presenti nel payload — ma MAI se hanno foto allegate
        // (evita violazione FK e perdita silenziosa di evidenze fotografiche).
        const testIdsToRemove = [...existingTestIds].filter((id) => !keptTestIds.has(id));
        for (const testId of testIdsToRemove) {
            const attCheck = await query(
                `SELECT COUNT(*) AS cnt FROM attachments WHERE rdp_test_id = @test_id`,
                { test_id: testId }
            );
            if (attCheck.recordset[0].cnt > 0) {
                logger.warn('rdp.controller: prova non rimossa perche\' ha foto allegate', { testId });
                continue;
            }
            await query(`DELETE FROM rdp_tests WHERE id = @test_id`, { test_id: testId });
        }
    }

    // Rimuove sezioni non piu' presenti — solo se non hanno piu' prove residue (con foto)
    const sectionIdsToRemove = [...existingSectionIds].filter((id) => !keptSectionIds.has(id));
    for (const sectionId of sectionIdsToRemove) {
        const remainingTests = await query(
            `SELECT COUNT(*) AS cnt FROM rdp_tests WHERE section_id = @section_id`,
            { section_id: sectionId }
        );
        if (remainingTests.recordset[0].cnt > 0) {
            logger.warn('rdp.controller: sezione non rimossa perche\' contiene ancora prove (con foto)', { sectionId });
            continue;
        }
        await query(`DELETE FROM rdp_sections WHERE id = @section_id`, { section_id: sectionId });
    }
}

// ── GET /rdp-reports/stats ───────────────────────────────────────────────────
async function getRdpStats(req, res) {
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
                AVG(r.average_score) AS avg_score_overall
            FROM rdp_reports r
            WHERE ${conditions.join(' AND ')}
        `, params);

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        logger.error('getRdpStats error', { error: err.message });
        res.status(500).json({ error: 'Errore statistiche rapporti RDP', code: 'RDP_STATS_ERROR' });
    }
}

// ── GET /rdp-reports ─────────────────────────────────────────────────────────
async function listRdpReports(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id, status, date_from, date_to, search,
            page = 1, limit = 50,
        } = req.query;

        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'r');

        const conditions = ['r.organization_id = @organization_id', 'r.is_deleted = 0'];
        const params = { organization_id, limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) };
        if (companyFilter.clause) conditions.push(companyFilter.clause);
        Object.assign(params, companyFilter.params);

        if (company_id) { conditions.push('r.company_id = @company_id'); params.company_id = parseInt(company_id); }
        if (status) { conditions.push('r.status = @status'); params.status = status; }
        if (date_from) { conditions.push('r.inspection_date >= @date_from'); params.date_from = date_from; }
        if (date_to) { conditions.push('r.inspection_date <= @date_to'); params.date_to = date_to; }
        if (search) {
            conditions.push('(r.client LIKE @search OR r.supplier_name LIKE @search OR r.report_number LIKE @search OR r.project_name LIKE @search OR EXISTS (SELECT 1 FROM projects px WHERE px.id = r.project_id AND px.project_code LIKE @search))');
            params.search = `%${search}%`;
        }

        const where = conditions.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            query(`
                SELECT r.id, r.uuid, r.report_number, r.report_year,
                       r.client, r.supplier_name, r.project_name, r.status,
                       r.inspection_date, r.average_score,
                       r.created_at, r.updated_at,
                       c.name AS company_name,
                       p.project_code,
                       (SELECT COUNT(*) FROM rdp_sections s WHERE s.report_id = r.id) AS sections_count,
                       (SELECT COUNT(*) FROM rdp_tests t INNER JOIN rdp_sections s2 ON s2.id = t.section_id WHERE s2.report_id = r.id) AS tests_count
                FROM rdp_reports r
                LEFT JOIN companies c ON c.id = r.company_id
                LEFT JOIN projects p ON p.id = r.project_id
                WHERE ${where}
                ORDER BY r.updated_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `, params),
            query(`SELECT COUNT(*) AS total FROM rdp_reports r WHERE ${where}`, params),
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
        logger.error('listRdpReports error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero rapporti RDP', code: 'RDP_LIST_ERROR' });
    }
}

// ── GET /rdp-reports/:id ──────────────────────────────────────────────────────
async function getRdpReport(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id);

        const [reportResult, sectionsResult, testsResult, photoCountsResult] = await Promise.all([
            query(`
                SELECT r.*, c.name AS company_name
                FROM rdp_reports r
                LEFT JOIN companies c ON c.id = r.company_id
                WHERE r.id = @id AND r.organization_id = @organization_id AND r.is_deleted = 0
            `, { id, organization_id }),
            query(`SELECT id, sort_order, title FROM rdp_sections WHERE report_id = @id ORDER BY sort_order ASC`, { id }),
            query(`
                SELECT t.id, t.section_id, t.sort_order, t.reference_code, t.test_name,
                       t.expected_value, t.measured_value, t.evidence_notes, t.score, t.result_code
                FROM rdp_tests t
                INNER JOIN rdp_sections s ON s.id = t.section_id
                WHERE s.report_id = @id
                ORDER BY s.sort_order ASC, t.sort_order ASC
            `, { id }),
            query(`
                SELECT t.id AS test_id, COUNT(a.attachment_id) AS photo_count
                FROM rdp_tests t
                INNER JOIN rdp_sections s ON s.id = t.section_id
                LEFT JOIN attachments a ON a.rdp_test_id = t.id
                WHERE s.report_id = @id
                GROUP BY t.id
            `, { id }),
        ]);

        if (reportResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Rapporto RDP non trovato', code: 'RDP_NOT_FOUND' });
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

        const photoCountByTest = new Map(photoCountsResult.recordset.map((r) => [r.test_id, r.photo_count]));
        const testsBySection = new Map();
        for (const test of testsResult.recordset) {
            const list = testsBySection.get(test.section_id) || [];
            list.push({ ...test, photo_count: photoCountByTest.get(test.id) || 0 });
            testsBySection.set(test.section_id, list);
        }
        const sections = sectionsResult.recordset.map((section) => ({
            ...section,
            tests: testsBySection.get(section.id) || [],
        }));

        res.json({
            success: true,
            data: { ...report, sections },
        });
    } catch (err) {
        logger.error('getRdpReport error', { error: err.message });
        res.status(500).json({ error: 'Errore recupero rapporto RDP', code: 'RDP_GET_ERROR' });
    }
}

// ── POST /rdp-reports ─────────────────────────────────────────────────────────
async function createRdpReport(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id, client, supplier_name, project_name, purpose,
            welded_element_type, drawing_reference,
            inspection_date, mason_inspector, client_inspector,
            notes, status = 'draft', sections = [],
            project_id: rawProjectId,
        } = req.body;

        const companyIdVal = company_id ? parseInt(company_id) : null;
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: companyIdVal });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const projectResolved = await resolveOptionalProjectId(query, {
            organizationId: organization_id,
            projectId: rawProjectId,
            companyId: companyIdVal,
        });
        if (projectResolved.error) {
            return res.status(projectResolved.status).json({
                error: projectResolved.error,
                code: projectResolved.code,
            });
        }
        const project_id = projectResolved.skip ? null : projectResolved.value;

        const report_year = new Date().getFullYear();
        const report_number = await allocateReportNumber(organization_id, report_year);
        const average_score = computeAverageScore(sections);

        const reportResult = await query(`
            INSERT INTO rdp_reports (
                organization_id, company_id, report_number, report_year,
                client, supplier_name, project_name, purpose,
                welded_element_type, drawing_reference,
                inspection_date, mason_inspector, client_inspector,
                average_score, notes, status, created_by, project_id
            )
            OUTPUT INSERTED.*
            VALUES (
                @organization_id, @company_id, @report_number, @report_year,
                @client, @supplier_name, @project_name, @purpose,
                @welded_element_type, @drawing_reference,
                @inspection_date, @mason_inspector, @client_inspector,
                @average_score, @notes, @status, @created_by, @project_id
            )
        `, {
            organization_id,
            company_id: companyIdVal,
            report_number,
            report_year,
            client: client || null,
            supplier_name: supplier_name || null,
            project_name: project_name || null,
            purpose: purpose || null,
            welded_element_type: welded_element_type || null,
            drawing_reference: drawing_reference || null,
            inspection_date: inspection_date || null,
            mason_inspector: mason_inspector || req.user.full_name || null,
            client_inspector: client_inspector || null,
            average_score,
            notes: notes || null,
            status,
            created_by: req.user.user_id,
            project_id,
        });

        const report = reportResult.recordset[0];
        if (sections.length > 0) {
            await upsertSectionsAndTests(report.id, sections);
        }

        const full = await getRdpReportById(report.id, organization_id);
        res.status(201).json({ success: true, data: full });
    } catch (err) {
        logger.error('createRdpReport error', { error: err.message });
        res.status(500).json({ error: 'Errore creazione rapporto RDP', code: 'RDP_CREATE_ERROR' });
    }
}

// ── Helper interno: rilettura completa dopo create/update ───────────────────
async function getRdpReportById(id, organization_id) {
    const [reportResult, sectionsResult, testsResult] = await Promise.all([
        query(`
            SELECT r.*, c.name AS company_name, p.project_code
            FROM rdp_reports r
            LEFT JOIN companies c ON c.id = r.company_id
            LEFT JOIN projects p ON p.id = r.project_id
            WHERE r.id = @id AND r.organization_id = @organization_id
        `, { id, organization_id }),
        query(`SELECT id, sort_order, title FROM rdp_sections WHERE report_id = @id ORDER BY sort_order ASC`, { id }),
        query(`
            SELECT t.id, t.section_id, t.sort_order, t.reference_code, t.test_name,
                   t.expected_value, t.measured_value, t.evidence_notes, t.score, t.result_code
            FROM rdp_tests t
            INNER JOIN rdp_sections s ON s.id = t.section_id
            WHERE s.report_id = @id
            ORDER BY s.sort_order ASC, t.sort_order ASC
        `, { id }),
    ]);
    const testsBySection = new Map();
    for (const test of testsResult.recordset) {
        const list = testsBySection.get(test.section_id) || [];
        list.push(test);
        testsBySection.set(test.section_id, list);
    }
    const sections = sectionsResult.recordset.map((section) => ({
        ...section,
        tests: testsBySection.get(section.id) || [],
    }));
    return { ...reportResult.recordset[0], sections };
}

// ── PUT /rdp-reports/:id ──────────────────────────────────────────────────────
async function updateRdpReport(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id);

        const existing = await query(
            `SELECT id, company_id, project_id FROM rdp_reports WHERE id = @id AND organization_id = @organization_id AND is_deleted = 0`,
            { id, organization_id }
        );
        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Rapporto RDP non trovato', code: 'RDP_NOT_FOUND' });
        }

        const existingCompanyId = existing.recordset[0].company_id;
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: existingCompanyId });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const {
            company_id, client, supplier_name, project_name, purpose,
            welded_element_type, drawing_reference,
            inspection_date, mason_inspector, client_inspector,
            notes, status, sections,
            project_id: rawProjectId,
        } = req.body;

        const nextCompanyId = company_id !== undefined
            ? (company_id ? parseInt(company_id) : null)
            : existingCompanyId;
        if (nextCompanyId !== existingCompanyId) {
            const nextDenied = await assertMutatingAllowed(req.user, { companyId: nextCompanyId });
            if (nextDenied) return sendAccessDenied(res, nextDenied);
        }

        let nextProjectId = existing.recordset[0].project_id;
        if (rawProjectId !== undefined) {
            const projectResolved = await resolveOptionalProjectId(query, {
                organizationId: organization_id,
                projectId: rawProjectId,
                companyId: nextCompanyId,
            });
            if (projectResolved.error) {
                return res.status(projectResolved.status).json({
                    error: projectResolved.error,
                    code: projectResolved.code,
                });
            }
            nextProjectId = projectResolved.value;
        }

        const average_score = sections !== undefined ? computeAverageScore(sections) : undefined;

        await query(`
            UPDATE rdp_reports SET
                company_id = @company_id, client = @client, supplier_name = @supplier_name,
                project_name = @project_name, purpose = @purpose,
                welded_element_type = @welded_element_type, drawing_reference = @drawing_reference,
                inspection_date = @inspection_date, mason_inspector = @mason_inspector,
                client_inspector = @client_inspector,
                ${average_score !== undefined ? 'average_score = @average_score,' : ''}
                notes = @notes, status = @status, project_id = @project_id,
                updated_at = GETDATE()
            WHERE id = @id
        `, {
            id,
            company_id: nextCompanyId,
            client: client || null,
            supplier_name: supplier_name || null,
            project_name: project_name || null,
            purpose: purpose || null,
            welded_element_type: welded_element_type || null,
            drawing_reference: drawing_reference || null,
            inspection_date: inspection_date || null,
            mason_inspector: mason_inspector || null,
            client_inspector: client_inspector || null,
            ...(average_score !== undefined ? { average_score } : {}),
            notes: notes || null,
            status: status || 'draft',
            project_id: nextProjectId,
        });

        if (sections !== undefined) {
            await upsertSectionsAndTests(id, sections);
        }

        const full = await getRdpReportById(id, organization_id);
        res.json({ success: true, data: full });
    } catch (err) {
        logger.error('updateRdpReport error', { error: err.message });
        res.status(500).json({ error: 'Errore aggiornamento rapporto RDP', code: 'RDP_UPDATE_ERROR' });
    }
}

// ── DELETE /rdp-reports/:id (soft delete) ────────────────────────────────────
async function deleteRdpReport(req, res) {
    try {
        const { organization_id } = req.user;
        const id = parseInt(req.params.id);

        const existing = await query(
            `SELECT id, company_id FROM rdp_reports WHERE id = @id AND organization_id = @organization_id AND is_deleted = 0`,
            { id, organization_id }
        );
        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Rapporto RDP non trovato', code: 'RDP_NOT_FOUND' });
        }

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: existing.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await query(`UPDATE rdp_reports SET is_deleted = 1, updated_at = GETDATE() WHERE id = @id`, { id });
        res.json({ success: true });
    } catch (err) {
        logger.error('deleteRdpReport error', { error: err.message });
        res.status(500).json({ error: 'Errore eliminazione rapporto RDP', code: 'RDP_DELETE_ERROR' });
    }
}

module.exports = {
    getRdpStats,
    listRdpReports,
    getRdpReport,
    createRdpReport,
    updateRdpReport,
    deleteRdpReport,
};
