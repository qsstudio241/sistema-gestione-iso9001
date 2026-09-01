/**
 * caseCapabilityGapReport.service.js — VC-1 (+ VC-3 refresh pipeline)
 * Aggrega uno snapshot report gap capacità (studio) riusando i mattoni esistenti.
 * Non duplica algoritmi di match: chiama caseExtractedCoverage / caseCoverageAdvisory.
 * VC-3: maybeRefresh* aggiorna lo snapshot in best-effort dopo analisi / HITL.
 */

'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
    loadExtractedRequirements,
    computeCaseProjectCoverage,
} = require('./caseExtractedCoverage.service');
const { buildCaseCoverageAdvisory } = require('./caseCoverageAdvisory.service');
const {
    buildTechnicalProfile,
    profileHasTechnicalData,
} = require('../utils/extractedRequirementsProfile');

const COMPANY_ID_REQUIRED_MSG =
    "Associa un'azienda SGQ (capacità) al caso prima di generare il report.";

function makeError(message, code, httpStatus = 400) {
    const e = new Error(message);
    e.code = code;
    e.httpStatus = httpStatus;
    return e;
}

/**
 * Deriva esito sintetico per lo studio: ok | gap | need_input.
 * @param {object} params
 * @returns {'ok'|'gap'|'need_input'}
 */
function deriveReportStatus({
    profileActive,
    coverageSummary,
    wpqrSummary,
    visionSummary,
    gaps,
}) {
    const hasNeedInputGap = (gaps || []).some((g) => g.severity === 'need_input');
    if (hasNeedInputGap) return 'need_input';

    const wpqrNeed = (wpqrSummary && Number(wpqrSummary.need_input) > 0) || false;
    if (!profileActive && !(coverageSummary && coverageSummary.total > 0) && wpqrNeed) {
        return 'need_input';
    }
    if (!profileActive && !(coverageSummary && coverageSummary.total > 0) && !(gaps || []).length) {
        // Nessun requisito tecnico né copertura calcolabile → serve input
        return 'need_input';
    }
    if ((gaps || []).length > 0) return 'gap';
    if (coverageSummary && (coverageSummary.uncovered > 0 || coverageSummary.partial > 0)) {
        return 'gap';
    }
    if (wpqrSummary && (Number(wpqrSummary.not_possible) > 0 || Number(wpqrSummary.partial) > 0)) {
        return 'gap';
    }
    if (visionSummary && (Number(visionSummary.missing) > 0 || Number(visionSummary.expired) > 0)) {
        return 'gap';
    }
    return 'ok';
}

/**
 * Costruisce lista gap leggibile dallo studio a partire da coverage + advisory.
 * @returns {object[]}
 */
function buildGapsList({ coverage, advisory, profileActive }) {
    const gaps = [];

    if (!profileActive && !(coverage && coverage.has_wps)) {
        gaps.push({
            code: 'NO_TECHNICAL_INPUT',
            severity: 'need_input',
            source: 'extracted_requirements',
            message:
                'Mancano requisiti tecnici estratti (o confermati) e non c\'è una commessa collegata con WPS: non è possibile valutare la capacità.',
        });
    }

    if (coverage && Array.isArray(coverage.coverage)) {
        for (const row of coverage.coverage) {
            if (row.esito === 'rosso') {
                gaps.push({
                    code: 'WPS_UNCOVERED',
                    severity: 'gap',
                    source: 'welder_coverage',
                    wps_id: row.wps_id,
                    wps_code: row.wps_code,
                    message: `Nessun saldatore operativo copre la WPS ${row.wps_code || row.wps_id}.`,
                });
            } else if (row.esito === 'giallo') {
                gaps.push({
                    code: 'WPS_PARTIAL',
                    severity: 'gap',
                    source: 'welder_coverage',
                    wps_id: row.wps_id,
                    wps_code: row.wps_code,
                    message: `Copertura parziale saldatori per WPS ${row.wps_code || row.wps_id}.`,
                });
            }
        }
    }

    const joints = advisory?.wpqr_joints?.joints || [];
    for (const j of joints) {
        if (j.status === 'need_input') {
            gaps.push({
                code: 'WPQR_NEED_INPUT',
                severity: 'need_input',
                source: 'wpqr_advisory',
                joint_key: j.joint_key,
                message: j.label
                    ? `Dati incompleti per valutare WPQR: ${j.label}`
                    : 'Dati incompleti per valutare copertura WPQR.',
                questions: j.questions || [],
            });
        } else if (j.status === 'not_possible') {
            gaps.push({
                code: 'WPQR_NOT_POSSIBLE',
                severity: 'gap',
                source: 'wpqr_advisory',
                joint_key: j.joint_key,
                message: j.label
                    ? `Nessuna WPQR adeguata: ${j.label}`
                    : 'Nessuna WPQR adeguata al giunto richiesto.',
                extensions_needed: j.extensions_needed || [],
            });
        } else if (j.status === 'partial') {
            gaps.push({
                code: 'WPQR_PARTIAL',
                severity: 'gap',
                source: 'wpqr_advisory',
                joint_key: j.joint_key,
                message: j.label
                    ? `Copertura WPQR parziale: ${j.label}`
                    : 'Copertura WPQR parziale.',
                extensions_needed: j.extensions_needed || [],
            });
        }
    }

    const visionGaps = advisory?.vision_fitness?.gaps || [];
    for (const g of visionGaps) {
        gaps.push({
            code: g.vision_state === 'expired' ? 'VISION_EXPIRED' : 'VISION_MISSING',
            severity: 'gap',
            source: 'vision_fitness',
            person_name: g.person_name || null,
            message:
                g.vision_state === 'expired'
                    ? `Certificato oculistico scaduto: ${g.person_name || 'operatore NDT/VT'}.`
                    : `Certificato oculistico mancante: ${g.person_name || 'operatore NDT/VT'}.`,
        });
    }

    return gaps;
}

async function loadCaseForReport(caseId, organizationId) {
    const r = await query(
        `
        SELECT id, organization_id, company_id, title,
               capability_gap_report_json, capability_gap_report_at
        FROM commercial_cases
        WHERE id = @caseId AND organization_id = @organizationId
        `,
        { caseId, organizationId },
    );
    return r.recordset[0] || null;
}

async function resolveLinkedProjectId(caseId, organizationId, explicitProjectId) {
    if (explicitProjectId != null && explicitProjectId !== '') {
        const pid = parseInt(String(explicitProjectId), 10);
        if (!Number.isFinite(pid) || pid <= 0) {
            throw makeError('project_id non valido', 'VALIDATION_ERROR', 400);
        }
        const check = await query(
            `
            SELECT id FROM projects
            WHERE id = @projectId AND organization_id = @organizationId
            `,
            { projectId: pid, organizationId },
        );
        if (!check.recordset.length) {
            throw makeError('Commessa non trovata', 'NOT_FOUND', 404);
        }
        return pid;
    }

    const linked = await query(
        `
        SELECT TOP 1 id
        FROM projects
        WHERE commercial_case_id = @caseId
          AND organization_id = @organizationId
        ORDER BY id DESC
        `,
        { caseId, organizationId },
    ).catch(() => ({ recordset: [] }));

    return linked.recordset[0]?.id || null;
}

/**
 * Calcola lo snapshot (senza persistere).
 * @param {object} params
 * @returns {Promise<object>}
 */
async function buildCapabilityGapReport({
    caseId,
    organizationId,
    projectId = null,
    includeExtractionId = null,
}) {
    const caseRow = await loadCaseForReport(caseId, organizationId);
    if (!caseRow) {
        throw makeError('Caso non trovato', 'NOT_FOUND', 404);
    }
    if (caseRow.company_id == null) {
        throw makeError(COMPANY_ID_REQUIRED_MSG, 'COMPANY_ID_REQUIRED', 400);
    }

    const requirements = await loadExtractedRequirements(caseId, organizationId, {
        includeExtractionId,
    });
    const extractedProfile = buildTechnicalProfile(requirements);
    const profileActive = profileHasTechnicalData(extractedProfile);

    const resolvedProjectId = await resolveLinkedProjectId(caseId, organizationId, projectId);

    let coverage = null;
    if (resolvedProjectId) {
        coverage = await computeCaseProjectCoverage({
            caseId,
            projectId: resolvedProjectId,
            organizationId,
        });
    }

    const advisory =
        coverage && coverage.advisory
            ? coverage.advisory
            : await buildCaseCoverageAdvisory({
                organizationId,
                companyId: caseRow.company_id,
                extractedProfile,
                wpsRows: [],
            });

    const gaps = buildGapsList({ coverage, advisory, profileActive });
    const coverageSummary = coverage?.summary || null;
    const wpqrSummary = advisory?.wpqr_joints?.summary || null;
    const visionSummary = advisory?.vision_fitness?.summary || null;
    const status = deriveReportStatus({
        profileActive,
        coverageSummary,
        wpqrSummary,
        visionSummary,
        gaps,
    });

    const generatedAt = new Date().toISOString();

    return {
        version: 1,
        generated_at: generatedAt,
        case_id: caseId,
        organization_id: organizationId,
        company_id: caseRow.company_id,
        project_id: resolvedProjectId,
        summary: {
            status,
            requirements_count: requirements.length,
            extracted_profile_active: profileActive,
            gaps_count: gaps.length,
            coverage: coverageSummary,
            wpqr: wpqrSummary,
            vision: visionSummary
                ? {
                    persons_requiring: visionSummary.persons_requiring || 0,
                    missing: visionSummary.missing || 0,
                    expired: visionSummary.expired || 0,
                    ok: visionSummary.ok || 0,
                }
                : null,
        },
        gaps,
        extracted_profile: extractedProfile,
        coverage: coverage
            ? {
                has_wps: !!coverage.has_wps,
                summary: coverage.summary,
                rows: (coverage.coverage || []).map((row) => ({
                    wps_id: row.wps_id,
                    wps_code: row.wps_code,
                    welding_process: row.welding_process || null,
                    esito: row.esito,
                    qualified_count: row.qualified_count,
                })),
            }
            : null,
        advisory: {
            blocking: false,
            wpqr_joints: advisory.wpqr_joints,
            vision_fitness: {
                company_id: caseRow.company_id,
                summary: visionSummary || {
                    persons_requiring: 0,
                    missing: 0,
                    expired: 0,
                    ok: 0,
                },
                gaps: advisory.vision_fitness?.gaps || [],
            },
        },
    };
}

function parseStoredReport(rawJson, fallbackAt) {
    if (rawJson == null || rawJson === '') return null;
    try {
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.generated_at && fallbackAt) {
            parsed.generated_at = new Date(fallbackAt).toISOString();
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Legge l'ultimo snapshot persistito (null se assente).
 */
async function getPersistedCapabilityGapReport({ caseId, organizationId }) {
    const caseRow = await loadCaseForReport(caseId, organizationId);
    if (!caseRow) {
        throw makeError('Caso non trovato', 'NOT_FOUND', 404);
    }
    return parseStoredReport(caseRow.capability_gap_report_json, caseRow.capability_gap_report_at);
}

/**
 * Ricalcola e persiste lo snapshot sul caso.
 */
async function regenerateAndPersistCapabilityGapReport({
    caseId,
    organizationId,
    projectId = null,
    includeExtractionId = null,
}) {
    const report = await buildCapabilityGapReport({
        caseId,
        organizationId,
        projectId,
        includeExtractionId,
    });
    const json = JSON.stringify(report);

    const upd = await query(
        `
        UPDATE commercial_cases
        SET capability_gap_report_json = @json,
            capability_gap_report_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.id, INSERTED.capability_gap_report_at
        WHERE id = @caseId AND organization_id = @organizationId
        `,
        { json, caseId, organizationId },
    );

    if (!upd.recordset.length) {
        throw makeError('Caso non trovato', 'NOT_FOUND', 404);
    }

    const at = upd.recordset[0].capability_gap_report_at;
    if (at) {
        report.generated_at = new Date(at).toISOString();
    }
    return report;
}

/**
 * VC-3 — refresh best-effort dello snapshot dopo analisi docs / conferma requisiti.
 * Non lancia: skip se manca company_id / caso assente; errori di regenerate → log warn.
 * @returns {Promise<{ refreshed: boolean, skipped?: boolean, reason?: string, report?: object }>}
 */
async function maybeRefreshCapabilityGapReport({
    caseId,
    organizationId,
    projectId = null,
    includeExtractionId = null,
}) {
    try {
        const report = await regenerateAndPersistCapabilityGapReport({
            caseId,
            organizationId,
            projectId,
            includeExtractionId,
        });
        return { refreshed: true, report };
    } catch (err) {
        if (err && err.code === 'COMPANY_ID_REQUIRED') {
            return { refreshed: false, skipped: true, reason: 'no_company' };
        }
        if (err && err.code === 'NOT_FOUND') {
            return { refreshed: false, skipped: true, reason: 'not_found' };
        }
        logger.warn('maybeRefreshCapabilityGapReport', {
            caseId,
            organizationId,
            msg: err && err.message,
            code: err && err.code,
        });
        return {
            refreshed: false,
            skipped: true,
            reason: 'error',
            error: err && err.message,
        };
    }
}

module.exports = {
    COMPANY_ID_REQUIRED_MSG,
    deriveReportStatus,
    buildGapsList,
    buildCapabilityGapReport,
    getPersistedCapabilityGapReport,
    regenerateAndPersistCapabilityGapReport,
    maybeRefreshCapabilityGapReport,
};
