/**
 * caseExtractedCoverage.service.js
 * Copertura qualifiche/WPS arricchita con requisiti estratti dai documenti commessa (slice #7).
 */

'use strict';

const { query } = require('../config/database');
const {
    computeQualificationCoverage,
    computeWpsCoverageEsito,
} = require('../utils/qualificationCoverage');
const {
    buildTechnicalProfile,
    mergeWpsWithExtractedProfile,
    profileHasTechnicalData,
} = require('../utils/extractedRequirementsProfile');

function semaforoExpiry(expiryDate, status) {
    if (status === 'revocata' || status === 'sospesa') return 'rosso';
    if (!expiryDate) return 'verde';
    const exp = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'rosso';
    if (diffDays <= 90) return 'arancione';
    return 'verde';
}

async function loadExtractedRequirements(caseId, organizationId) {
    const result = await query(
        `
        SELECT
            r.req_type,
            r.field_key,
            r.value_text,
            r.unit,
            r.confidence,
            r.review_status,
            e.source
        FROM commercial_case_extracted_requirements r
        INNER JOIN commercial_case_drawing_extractions e ON e.id = r.extraction_id
        INNER JOIN commercial_cases c ON c.id = e.case_id
        WHERE c.id = @caseId
          AND c.organization_id = @organizationId
          AND e.status = 'done'
          AND r.review_status IN ('extracted', 'confirmed', 'edited')
        ORDER BY r.confidence DESC, r.id ASC
        `,
        { caseId, organizationId },
    );
    return result.recordset || [];
}

/**
 * @param {object} params
 * @returns {Promise<object>}
 */
async function computeCaseProjectCoverage({ caseId, projectId, organizationId }) {
    const projRes = await query(
        `
        SELECT id, project_code, applicable_wps_ids, company_id
        FROM projects
        WHERE id = @projectId AND organization_id = @organizationId
        `,
        { projectId, organizationId },
    );
    const project = projRes.recordset[0];
    if (!project) {
        const e = new Error('Commessa non trovata');
        e.code = 'NOT_FOUND';
        throw e;
    }

    const requirements = await loadExtractedRequirements(caseId, organizationId);
    const extractedProfile = buildTechnicalProfile(requirements);

    let wpsIds = [];
    try {
        wpsIds = JSON.parse(project.applicable_wps_ids || '[]');
    } catch {
        wpsIds = [];
    }

    if (!wpsIds.length) {
        return {
            case_id: caseId,
            project_id: projectId,
            project_code: project.project_code,
            has_wps: false,
            extracted_profile: extractedProfile,
            extracted_profile_active: profileHasTechnicalData(extractedProfile),
            coverage: [],
            summary: { total: 0, covered: 0, partial: 0, uncovered: 0 },
        };
    }

    const ph = wpsIds.map((_, i) => `@wid${i}`).join(',');
    const wpsParams = { organizationId };
    wpsIds.forEach((id, i) => {
        wpsParams[`wid${i}`] = parseInt(id, 10);
    });

    const wpsRes = await query(
        `
        SELECT id, wps_code, welding_process,
               base_material_group, material_group,
               thickness_range_min, thickness_range_max, thickness_range,
               welding_positions, position
        FROM welding_procedures
        WHERE id IN (${ph}) AND organization_id = @organizationId AND status != 'annullata'
        `,
        wpsParams,
    );
    const wpsRows = wpsRes.recordset || [];

    const qParams = { organizationId };
    let qWhere = `
        q.organization_id = @organizationId
        AND q.approval_status = 'approvata'
        AND q.status NOT IN ('revocata','sospesa')
        AND (q.expiry_date IS NULL OR q.expiry_date >= CAST(GETDATE() AS DATE))
        AND q.qualification_type LIKE '%9606%'
    `;
    if (project.company_id) {
        qParams.projCompId = project.company_id;
        qWhere += ' AND q.company_id = @projCompId';
    }

    const qualRes = await query(
        `
        SELECT q.id, q.person_name, q.person_code, q.qualification_type,
               q.welding_process, q.material_group, q.position_range,
               q.thickness_min_mm, q.thickness_max_mm, q.thickness_range, q.joint_type,
               q.expiry_date, q.status, q.approval_status,
               c.name AS company_name
        FROM qualifications q
        LEFT JOIN companies c ON c.id = q.company_id
        WHERE ${qWhere}
        ORDER BY q.person_name
        `,
        qParams,
    );
    const qualRows = qualRes.recordset || [];

    const normalizeWps = (wps) => mergeWpsWithExtractedProfile(
        {
            ...wps,
            base_material_group: wps.base_material_group || wps.material_group || null,
            welding_positions: wps.welding_positions || wps.position || null,
        },
        extractedProfile,
    );

    const rows = wpsRows.map((rawWps) => {
        const wps = normalizeWps(rawWps);
        const qualifiersWithDetail = qualRows.map((q) => {
            const detail = computeQualificationCoverage(q, wps);
            return { q, detail };
        }).filter(({ detail }) => detail.overall !== 'excluded');

        const coverageDetails = qualifiersWithDetail.map(({ detail }) => detail);
        const esito = computeWpsCoverageEsito(coverageDetails);

        return {
            wps_id: wps.id,
            wps_code: wps.wps_code,
            welding_process: wps.welding_process,
            material_group: wps.base_material_group,
            thickness_range_min: wps.thickness_range_min,
            thickness_range_max: wps.thickness_range_max,
            welding_positions: wps.welding_positions,
            qualified_count: qualifiersWithDetail.length,
            esito,
            enriched_from_documents: profileHasTechnicalData(extractedProfile),
            qualifiers: qualifiersWithDetail.map(({ q, detail }) => ({
                id: q.id,
                person_name: q.person_name,
                person_code: q.person_code,
                company_name: q.company_name,
                expiry_date: q.expiry_date,
                semaforo: semaforoExpiry(q.expiry_date, q.status),
                coverage_detail: detail,
            })),
        };
    });

    const covered = rows.filter((r) => r.esito === 'verde').length;
    const partial = rows.filter((r) => r.esito === 'giallo').length;
    const uncovered = rows.filter((r) => r.esito === 'rosso').length;

    return {
        case_id: caseId,
        project_id: projectId,
        project_code: project.project_code,
        has_wps: rows.length > 0,
        extracted_profile: extractedProfile,
        extracted_profile_active: profileHasTechnicalData(extractedProfile),
        requirements_used: requirements.length,
        coverage: rows,
        summary: {
            total: rows.length,
            covered,
            partial,
            uncovered,
        },
    };
}

module.exports = {
    computeCaseProjectCoverage,
    loadExtractedRequirements,
};
