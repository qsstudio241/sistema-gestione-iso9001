/**
 * caseCoverageAdvisory.service.js — P5 riesame
 * Sezioni ADVISORY (non bloccanti) per copertura WPQR multi-giunto e idoneità visiva.
 * Non modifica il semaforo saldatori ↔ WPS.
 */

'use strict';

const { generateWpsFromWpqr } = require('./wpsGenerator.service');
const { findVisionFitnessGaps } = require('./visionFitness.service');
const { profileHasTechnicalData } = require('../utils/extractedRequirementsProfile');

/**
 * Costruisce richieste giunto da profilo estratto e/o WPS di commessa.
 * @param {object} extractedProfile
 * @param {object[]} wpsRows
 * @returns {{ source: string, requests: object[] }}
 */
function buildJointRequestsFromSources(extractedProfile, wpsRows = []) {
    const requests = [];
    const profile = extractedProfile || {};
    const hasProfile = profileHasTechnicalData(profile);

    if (hasProfile) {
        const mat = profile.base_material_group || '';
        const tMin = profile.thickness_range_min;
        const tMax = profile.thickness_range_max != null ? profile.thickness_range_max : tMin;
        requests.push({
            joint_key: 'extracted-1',
            label: [
                'Giunto da documenti',
                mat ? `materiale ${mat}` : null,
                tMin != null ? `spessore ${tMin}${tMax != null && tMax !== tMin ? `\u2013${tMax}` : ''} mm` : null,
                profile.welding_process ? `proc. ${profile.welding_process}` : null,
            ].filter(Boolean).join(' \u00B7 ') || 'Giunto da documenti',
            request: {
                joint_type: '', // spesso assente nei requisiti flat → need_input se manca
                parent_material_a: mat || '',
                parent_material_b: mat || '',
                thickness_a_mm: tMin != null ? tMin : null,
                thickness_b_mm: tMax != null ? tMax : null,
                welding_process: profile.welding_process || undefined,
            },
        });
        return { source: 'extracted_requirements', requests };
    }

    const rows = Array.isArray(wpsRows) ? wpsRows : [];
    if (rows.length) {
        rows.forEach((wps, idx) => {
            const mat = wps.base_material_group || wps.material_group || '';
            const tMin = wps.thickness_range_min;
            const tMax = wps.thickness_range_max != null ? wps.thickness_range_max : tMin;
            requests.push({
                joint_key: `wps-${wps.id || idx}`,
                label: `WPS ${wps.wps_code || wps.id || idx}`,
                request: {
                    joint_type: wps.joint_type || '',
                    parent_material_a: mat || '',
                    parent_material_b: mat || '',
                    thickness_a_mm: tMin != null ? Number(tMin) : null,
                    thickness_b_mm: tMax != null ? Number(tMax) : null,
                    welding_process: wps.welding_process || undefined,
                },
            });
        });
        return { source: 'project_wps', requests };
    }

    return { source: 'none', requests: [] };
}

/**
 * Valuta ogni giunto con generateWpsFromWpqr (stesso motore P0–P3).
 * @param {object} params
 * @returns {Promise<object>}
 */
async function evaluateWpqrJointsAdvisory({
    organizationId,
    companyId = null,
    extractedProfile,
    wpsRows,
}) {
    const { source, requests } = buildJointRequestsFromSources(extractedProfile, wpsRows);
    const joints = [];
    const summary = {
        total: requests.length,
        ok: 0,
        partial: 0,
        not_possible: 0,
        need_input: 0,
        skipped: 0,
    };

    for (const item of requests) {
        try {
            const result = await generateWpsFromWpqr({
                organizationId,
                companyId,
                request: item.request,
            });
            const status = result.status || 'skipped';
            if (summary[status] != null) summary[status] += 1;
            else summary.skipped += 1;

            joints.push({
                joint_key: item.joint_key,
                label: item.label,
                request: item.request,
                status,
                wpqr_code: result.wpqr_used
                    ? (result.wpqr_used.wpqr_code || String(result.wpqr_used.id))
                    : null,
                extensions_needed: result.extensions_needed || [],
                questions: result.questions || [],
                warnings: result.warnings || [],
                note: 'Solo informativo: non modifica la copertura saldatori.',
            });
        } catch (err) {
            summary.skipped += 1;
            joints.push({
                joint_key: item.joint_key,
                label: item.label,
                request: item.request,
                status: 'skipped',
                wpqr_code: null,
                extensions_needed: [],
                questions: [],
                warnings: [err.message || 'Errore valutazione WPQR'],
                note: 'Solo informativo: non modifica la copertura saldatori.',
            });
        }
    }

    return { source, joints, summary };
}

/**
 * Blocco advisory completo per riesame.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function buildCaseCoverageAdvisory({
    organizationId,
    companyId = null,
    extractedProfile,
    wpsRows,
}) {
    const [wpqr_joints, visionRaw] = await Promise.all([
        evaluateWpqrJointsAdvisory({
            organizationId,
            companyId,
            extractedProfile,
            wpsRows,
        }),
        companyId
            ? findVisionFitnessGaps(organizationId, { companyId }).catch(() => ({
                gaps: [],
                summary: { persons_requiring: 0, missing: 0, expired: 0, ok: 0 },
            }))
            : findVisionFitnessGaps(organizationId, {}).catch(() => ({
                gaps: [],
                summary: { persons_requiring: 0, missing: 0, expired: 0, ok: 0 },
            })),
    ]);

    return {
        blocking: false,
        wpqr_joints,
        vision_fitness: {
            company_id: companyId,
            gaps: visionRaw.gaps || [],
            summary: visionRaw.summary || {
                persons_requiring: 0,
                missing: 0,
                expired: 0,
                ok: 0,
            },
        },
    };
}

module.exports = {
    buildJointRequestsFromSources,
    evaluateWpqrJointsAdvisory,
    buildCaseCoverageAdvisory,
};
