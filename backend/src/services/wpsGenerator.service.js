'use strict';

/**
 * wpsGenerator.service.js — generazione deterministica bozza WPS da WPQR (P0).
 * Vincoli numerici/gruppo: ISO 15614-1 Tabella 5 + range spessore dichiarati.
 * Nessuna chiamata AI, nessuna scrittura DB in P0.
 */

const {
    isParentMaterialCombinationCovered,
    resolveSteelGradeToGroup,
    computeQualifiedMaterialThicknessRangeLevel2,
    computeQualifiedFilletThroatThicknessRange,
} = require('../data/weldingQualificationRules15614');

/** Lazy require: evita process.exit in unit test senza database.json. */
function getDbQuery() {
    // eslint-disable-next-line global-require
    return require('../config/database').query;
}

/**
 * Carica WPQR nello scope org (+ company opzionale, pattern Ambito).
 * @param {number} organizationId
 * @param {number|null} companyId
 * @returns {Promise<object[]>}
 */
async function loadWpqrRecords(organizationId, companyId = null) {
    const query = getDbQuery();
    const params = { organization_id: Number(organizationId) };
    let sql = `
        SELECT wq.*
        FROM wpqr_records wq
        LEFT JOIN welding_procedures w ON w.id = wq.wps_id
        WHERE wq.organization_id = @organization_id
    `;
    if (companyId != null && companyId !== '') {
        sql += ` AND (wq.company_id = @company_id OR (wq.company_id IS NULL AND w.company_id = @company_id))`;
        params.company_id = Number(companyId);
    }
    sql += ' ORDER BY wq.id DESC';
    const result = await query(sql, params);
    return result.recordset || [];
}

/**
 * Risolve grado commerciale o codice gruppo → codice 15608.
 * @param {string} value
 * @param {string[]} warnings
 */
function resolveParentGroup(value, warnings) {
    const r = resolveSteelGradeToGroup(value);
    if (r.warning) warnings.push(r.warning);
    return r.group;
}

/**
 * Match tipo giunto: se WPQR non espone joint_type → non escludere (warning).
 * @param {object} wpqr
 * @param {string} requested
 * @param {string[]} warnings
 * @returns {boolean} true se compatibile
 */
function jointTypeCompatible(wpqr, requested, warnings) {
    const req = String(requested || '').trim().toUpperCase();
    if (!req) return true;

    const raw = wpqr.joint_type != null ? String(wpqr.joint_type).trim() : '';
    if (!raw) {
        warnings.push(
            `WPQR ${wpqr.wpqr_code || wpqr.id}: tipo giunto non dichiarato — non esclusa automaticamente`
        );
        return true;
    }
    const up = raw.toUpperCase();
    // Accetta "FW", "BW+FW", "BW / FW", ecc.
    if (up.includes(req)) return true;
    return false;
}

/**
 * Regola FW P0: entrambi gli spessori genitori devono cadere nel range materiale base.
 * Preferisce thickness_min/max dichiarati sul WPQR; altrimenti suggerisce da Tabella 7 Level 2
 * (o gola Tabella 8 solo come hint) con status partial.
 *
 * @returns {{ ok: boolean, partial: boolean, reason?: string, range?: { min: number|null, max: number|null } }}
 */
function checkThicknessCoverage(wpqr, thicknessA, thicknessB) {
    const tA = Number(thicknessA);
    const tB = Number(thicknessB);
    if (!Number.isFinite(tA) || !Number.isFinite(tB) || tA <= 0 || tB <= 0) {
        return { ok: false, partial: false, reason: 'Spessori richiesti non validi' };
    }

    let min = wpqr.thickness_min != null && wpqr.thickness_min !== ''
        ? Number(wpqr.thickness_min) : null;
    let max = wpqr.thickness_max != null && wpqr.thickness_max !== ''
        ? Number(wpqr.thickness_max) : null;
    let partial = false;
    let source = 'dichiarato';

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        const tested = wpqr.thickness_tested != null
            ? Number(wpqr.thickness_tested)
            : null;
        const level2 = Number.isFinite(tested)
            ? computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: tested })
            : null;
        if (level2) {
            min = level2.minMm;
            max = level2.maxMm;
            partial = true;
            source = 'calcolato Level 2 (Tabella 7) da thickness_tested';
        } else {
            // Fallback informativo gola FW — non usarlo come range materiale base vincente
            const fillet = Number.isFinite(tested)
                ? computeQualifiedFilletThroatThicknessRange({ testThicknessMm: tested })
                : null;
            if (fillet && fillet.maxMm != null) {
                return {
                    ok: false,
                    partial: true,
                    reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: range spessore materiale assente; solo hint gola Tabella 8 [${fillet.minMm}-${fillet.maxMm}] mm — non sufficiente per copertura genitori`,
                    range: { min: fillet.minMm, max: fillet.maxMm },
                };
            }
            return {
                ok: false,
                partial: false,
                reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: range spessore (thickness_min/max) assente e non calcolabile`,
            };
        }
    }

    const inRange = (t) => t >= min && (max == null || t <= max);
    if (inRange(tA) && inRange(tB)) {
        return {
            ok: true,
            partial,
            reason: partial
                ? `Spessori ok su range ${source}`
                : `Spessori ${tA}/${tB} mm entro ${min}-${max} mm (${source})`,
            range: { min, max },
        };
    }

    return {
        ok: false,
        partial,
        reason: `Spessore fuori range WPQR ${wpqr.wpqr_code || wpqr.id}: richiesti ${tA} e ${tB} mm, range ${min}-${max == null ? '∞' : max} mm (${source})`,
        range: { min, max },
    };
}

/**
 * Bozza WPS minima allineata a welding_procedures / 15609.
 */
function buildWpsDraft(wpqr, request, groupA, groupB) {
    const thicknesses = [Number(request.thickness_a_mm), Number(request.thickness_b_mm)]
        .filter((n) => Number.isFinite(n));
    const tMin = thicknesses.length ? Math.min(...thicknesses) : null;
    const tMax = thicknesses.length ? Math.max(...thicknesses) : null;

    return {
        welding_process: request.welding_process || wpqr.welding_process || null,
        material_group: groupA === groupB ? groupA : `${groupA}+${groupB}`,
        parent_material_a: request.parent_material_a || null,
        parent_material_b: request.parent_material_b || null,
        joint_type: request.joint_type || wpqr.joint_type || null,
        thickness_range_min: wpqr.thickness_min != null ? Number(wpqr.thickness_min) : tMin,
        thickness_range_max: wpqr.thickness_max != null ? Number(wpqr.thickness_max) : tMax,
        thickness_a_mm: request.thickness_a_mm != null ? Number(request.thickness_a_mm) : null,
        thickness_b_mm: request.thickness_b_mm != null ? Number(request.thickness_b_mm) : null,
        qualification_standard: wpqr.standard_reference || 'ISO 15614-1',
        wpqr_ref: wpqr.wpqr_code || null,
        wpqr_id: wpqr.id != null ? wpqr.id : null,
        filler_material: wpqr.filler_material || null,
        shielding_gas: wpqr.shielding_gas || null,
        welding_positions: wpqr.welding_positions || null,
        status: 'bozza',
    };
}

/**
 * Campi minimi per confrontare un giunto con le WPQR (ISO 15614).
 * Se incompleti → status need_input + domande all'utente (AI orchestra, non indovina).
 *
 * @param {object} request
 * @returns {{
 *   complete: boolean,
 *   questions: Array<{ field: string, question: string }>,
 *   resolved?: { jointType: string, groupA: string, groupB: string, thicknessA: number, thicknessB: number },
 *   warnings: string[]
 * }}
 */
function assessJointCoverageInputs(request = {}) {
    const warnings = [];
    const questions = [];

    const jointRaw = String(request.joint_type || '').trim();
    const jointType = jointRaw.toUpperCase();
    if (!jointType) {
        questions.push({
            field: 'joint_type',
            question: 'Qual è il tipo di giunto? (es. FW angolo o BW testa)',
        });
    }

    const matA = String(request.parent_material_a || '').trim();
    const matB = String(request.parent_material_b || '').trim();
    if (!matA) {
        questions.push({
            field: 'parent_material_a',
            question: 'Qual è il materiale / grado del primo pezzo (A)? (es. S355 oppure gruppo 1.2)',
        });
    }
    if (!matB) {
        questions.push({
            field: 'parent_material_b',
            question: 'Qual è il materiale / grado del secondo pezzo (B)? (es. S235 oppure gruppo 1.1)',
        });
    }

    const tAraw = request.thickness_a_mm;
    const tBraw = request.thickness_b_mm;
    const tA = tAraw === '' || tAraw == null ? NaN : Number(tAraw);
    const tB = tBraw === '' || tBraw == null ? NaN : Number(tBraw);
    if (!Number.isFinite(tA) || tA <= 0) {
        questions.push({
            field: 'thickness_a_mm',
            question: 'Qual è lo spessore del pezzo A in mm?',
        });
    }
    if (!Number.isFinite(tB) || tB <= 0) {
        questions.push({
            field: 'thickness_b_mm',
            question: 'Qual è lo spessore del pezzo B in mm?',
        });
    }

    // Materiali presenti ma non mappabili → chiedere chiarimento (non chiudere come "estensione mancante")
    let groupA = null;
    let groupB = null;
    if (matA) {
        groupA = resolveParentGroup(matA, warnings);
        if (!groupA) {
            questions.push({
                field: 'parent_material_a',
                question: `Non riconosco il materiale A «${matA}»: indica un grado noto (es. S355) o il gruppo ISO/TR 15608 (es. 1.2)`,
            });
        }
    }
    if (matB) {
        groupB = resolveParentGroup(matB, warnings);
        if (!groupB) {
            questions.push({
                field: 'parent_material_b',
                question: `Non riconosco il materiale B «${matB}»: indica un grado noto (es. S235) o il gruppo ISO/TR 15608 (es. 1.1)`,
            });
        }
    }

    if (questions.length > 0) {
        return { complete: false, questions, warnings };
    }

    return {
        complete: true,
        questions: [],
        warnings,
        resolved: {
            jointType,
            groupA,
            groupB,
            thicknessA: tA,
            thicknessB: tB,
        },
    };
}

function needInputResult(questions, warnings = []) {
    return {
        status: 'need_input',
        wpqr_used: null,
        candidates: [],
        wps_draft: null,
        extensions_needed: [],
        questions,
        warnings,
    };
}

/**
 * @param {object} params
 * @param {number} params.organizationId
 * @param {number|null} [params.companyId]
 * @param {object} params.request
 * @param {object[]} [params.wpqrRecords]
 * @returns {Promise<{
 *   status: 'ok'|'partial'|'not_possible'|'need_input',
 *   wpqr_used: object|null,
 *   candidates: object[],
 *   wps_draft: object|null,
 *   extensions_needed: string[],
 *   questions?: Array<{ field: string, question: string }>,
 *   warnings: string[]
 * }>}
 */
async function generateWpsFromWpqr(params = {}) {
    const {
        organizationId,
        companyId = null,
        request = {},
        wpqrRecords: injectedRecords,
    } = params;

    const assessed = assessJointCoverageInputs(request);
    if (!assessed.complete) {
        return needInputResult(assessed.questions, assessed.warnings);
    }

    const warnings = [...assessed.warnings];
    const extensionsNeeded = [];
    const { jointType, groupA, groupB } = assessed.resolved;
    // Normalizza request spessori numerici per buildWpsDraft / thickness check
    const normalizedRequest = {
        ...request,
        joint_type: jointType,
        thickness_a_mm: assessed.resolved.thicknessA,
        thickness_b_mm: assessed.resolved.thicknessB,
    };

    let records = injectedRecords;
    if (records == null) {
        if (organizationId == null) {
            return {
                status: 'not_possible',
                wpqr_used: null,
                candidates: [],
                wps_draft: null,
                extensions_needed: ['organizationId obbligatorio se non si passano wpqrRecords'],
                questions: [],
                warnings,
            };
        }
        records = await loadWpqrRecords(organizationId, companyId);
    }

    if (!Array.isArray(records) || records.length === 0) {
        return {
            status: 'not_possible',
            wpqr_used: null,
            candidates: [],
            wps_draft: null,
            extensions_needed: ['Registro WPQR vuoto: nessuna procedura qualificata disponibile per l\'ambito'],
            questions: [],
            warnings,
        };
    }

    const processFilter = request.welding_process
        ? String(request.welding_process).trim()
        : null;

    const candidates = [];
    const materialFailures = [];
    const thicknessFailures = [];
    const processFailures = [];
    const jointFailures = [];

    for (const wpqr of records) {
        const localWarnings = [];

        if (processFilter) {
            const proc = wpqr.welding_process != null ? String(wpqr.welding_process).trim() : '';
            if (proc && proc !== processFilter) {
                processFailures.push(
                    `WPQR ${wpqr.wpqr_code || wpqr.id}: processo ${proc} ≠ ${processFilter}`
                );
                continue;
            }
            if (!proc) {
                localWarnings.push(
                    `WPQR ${wpqr.wpqr_code || wpqr.id}: processo non dichiarato — non esclusa`
                );
            }
        }

        if (!jointTypeCompatible(wpqr, jointType, localWarnings)) {
            jointFailures.push(
                `WPQR ${wpqr.wpqr_code || wpqr.id}: tipo giunto ${wpqr.joint_type} non copre ${jointType}`
            );
            continue;
        }

        const testedGroup = wpqr.base_material_group || wpqr.material_group || null;
        const mat = isParentMaterialCombinationCovered({
            materialGroupTested: testedGroup,
            parentGroupA: groupA,
            parentGroupB: groupB,
        });
        if (!mat.covered) {
            materialFailures.push(
                `WPQR ${wpqr.wpqr_code || wpqr.id}: ${mat.reason}`
            );
            continue;
        }

        const th = checkThicknessCoverage(
            wpqr,
            normalizedRequest.thickness_a_mm,
            normalizedRequest.thickness_b_mm
        );
        if (!th.ok) {
            thicknessFailures.push(th.reason || 'Spessore fuori range');
            continue;
        }

        candidates.push({
            wpqr,
            material: mat,
            thickness: th,
            warnings: localWarnings,
            score: (th.partial ? 1 : 2) + (localWarnings.length ? 0 : 1),
        });
        warnings.push(...localWarnings);
    }

    if (candidates.length === 0) {
        if (materialFailures.length === records.length || materialFailures.length > 0) {
            extensionsNeeded.push(
                `Nessuna WPQR copre il gruppo materiale ${groupA}–${groupB}`
            );
        }
        if (thicknessFailures.length > 0) {
            extensionsNeeded.push(...thicknessFailures.slice(0, 3));
        }
        if (processFailures.length > 0 && candidates.length === 0) {
            extensionsNeeded.push(
                `Nessuna WPQR con processo ${processFilter}`
            );
        }
        if (jointFailures.length > 0) {
            extensionsNeeded.push(
                `Nessuna WPQR con tipo giunto compatibile ${jointType}`
            );
        }
        if (extensionsNeeded.length === 0) {
            extensionsNeeded.push('Nessuna WPQR compatibile con i parametri richiesti');
        }
        const unique = [...new Set(extensionsNeeded)];
        return {
            status: 'not_possible',
            wpqr_used: null,
            candidates: [],
            wps_draft: null,
            extensions_needed: unique,
            questions: [],
            warnings,
        };
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const draft = buildWpsDraft(best.wpqr, normalizedRequest, groupA, groupB);
    const status = best.thickness.partial || best.warnings.length > 0 ? 'partial' : 'ok';
    if (best.thickness.partial) {
        warnings.push(
            `Range spessore su WPQR ${best.wpqr.wpqr_code || best.wpqr.id} calcolato (non dichiarato): verificare sul verbale`
        );
    }

    return {
        status,
        wpqr_used: best.wpqr,
        candidates: candidates.map((c) => ({
            id: c.wpqr.id,
            wpqr_code: c.wpqr.wpqr_code,
            base_material_group: c.wpqr.base_material_group,
            joint_type: c.wpqr.joint_type,
            thickness_min: c.wpqr.thickness_min,
            thickness_max: c.wpqr.thickness_max,
            material_reason: c.material.reason,
            thickness_reason: c.thickness.reason,
        })),
        wps_draft: draft,
        extensions_needed: [],
        questions: [],
        warnings,
    };
}

module.exports = {
    generateWpsFromWpqr,
    assessJointCoverageInputs,
    loadWpqrRecords,
    checkThicknessCoverage,
    jointTypeCompatible,
    buildWpsDraft,
};
