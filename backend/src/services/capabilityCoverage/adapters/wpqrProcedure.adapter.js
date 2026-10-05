/**
 * wpqrProcedure.adapter.js — Dominio copertura WPQR / procedure
 * (ISO 15614-1/-2, ISO 14555 stud, ISO 15613 solo come etichetta di base).
 *
 * COV-2: match reale per ogni WPQR dell'organizzazione, riusando le funzioni
 * di wpsGenerator.service.js e weldingQualificationRules*.js (nessuna logica
 * di copertura duplicata, nessuna soglia nuova).
 *
 * ISO 15613: non esiste un catalogo JS di soglie. Il record e' etichettato come
 * base 15613 e le dimensioni senza validita' dichiarata restano `partial`
 * (mai `match` silenzioso, mai calcolo con tabelle 15614).
 */

'use strict';

const {
    loadWpqrRecords,
    checkThicknessCoverage,
    checkDiameterCoverage,
    checkThroatCoverage,
    jointTypeCompatible,
} = require('../../wpsGenerator.service');
const {
    isParentMaterialCombinationCovered,
    normalizeMaterialGroupCode,
    resolveSteelGradeToGroup,
} = require('../../../data/weldingQualificationRules15614');
const { isIso15614Part2 } = require('../../../data/weldingQualificationRules15614_2');
const {
    isIso14555,
    isSimilarMaterialsCovered14555,
} = require('../../../data/weldingQualificationRules14555');
const { COVERAGE_DOMAINS, MATCH_STATUS } = require('../coverageTypes');

const NO_WPQR_MESSAGE = 'Nessuna WPQR registrata per l\'ambito selezionato: nulla da confrontare con il requisito.';

const REQUIREMENT_FIELDS = [
    {
        key: 'welding_process',
        label: 'Processo',
        type: 'text',
        hint: 'Es. 135 — confrontato con il processo della WPQR',
    },
    {
        key: 'joint_type',
        label: 'Tipo giunto',
        type: 'select',
        options: [
            { value: 'BW', label: 'BW' },
            { value: 'FW', label: 'FW' },
            { value: 'SW', label: 'SW (stud)' },
        ],
    },
    {
        key: 'thickness_mm',
        label: 'Spessore (mm)',
        type: 'number',
    },
    {
        key: 'thickness_b_mm',
        label: 'Spessore B (mm)',
        type: 'number',
        hint: 'Solo se i due pezzi hanno spessori diversi (t1/t2); altrimenti = spessore',
    },
    {
        key: 'diameter_mm',
        label: 'Diametro tubo (mm)',
        type: 'number',
        hint: 'Solo per giunti su tubo',
    },
    {
        key: 'throat_mm',
        label: 'Gola (mm)',
        type: 'number',
        hint: 'Solo giunti FW',
    },
    {
        key: 'material_group',
        label: 'Gruppo materiale',
        type: 'text',
        hint: 'Gruppo ISO/TR 15608 (es. 1.2) o grado (es. S355)',
    },
    {
        key: 'material_group_b',
        label: 'Gruppo materiale B',
        type: 'text',
        hint: 'Secondo pezzo / stud; se vuoto = gruppo materiale',
    },
];

const CHECK = Object.freeze({
    OK: 'ok',
    PARTIAL: 'partial',
    FAIL: 'fail',
    SKIPPED: 'skipped',
});

const BASIS = Object.freeze({
    ISO_15614_1: 'ISO 15614-1',
    ISO_15614_2: 'ISO 15614-2',
    ISO_14555: 'ISO 14555',
    ISO_15613: 'ISO 15613',
});

function isBlank(v) {
    return v == null || String(v).trim() === '';
}

function isIso15613(standardReference) {
    return /15613\b/i.test(String(standardReference || ''));
}

/**
 * Base di qualifica del record WPQR (etichetta, nessuna colonna nuova).
 * @param {object} wpqr
 */
function resolveQualificationBasis(wpqr) {
    const ref = wpqr.standard_reference;
    if (isIso14555(ref)) return BASIS.ISO_14555;
    if (isIso15613(ref)) return BASIS.ISO_15613;
    if (isIso15614Part2(ref)) return BASIS.ISO_15614_2;
    return BASIS.ISO_15614_1;
}

function wpqrLabel(wpqr) {
    return wpqr.wpqr_code || `#${wpqr.id}`;
}

function tokenizeProcess(value) {
    return String(value || '')
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .filter(Boolean);
}

/** @returns {{ result: string, reason?: string }} */
function checkProcess(wpqr, reqProcess) {
    if (isBlank(reqProcess)) return { result: CHECK.SKIPPED };
    if (isBlank(wpqr.welding_process)) {
        return { result: CHECK.PARTIAL, reason: 'Processo non dichiarato sulla WPQR' };
    }
    const wanted = tokenizeProcess(reqProcess);
    const declared = tokenizeProcess(wpqr.welding_process);
    const hit = wanted.length > 0 && wanted.every((t) => declared.includes(t));
    return hit
        ? { result: CHECK.OK }
        : {
            result: CHECK.FAIL,
            reason: `Processo ${String(wpqr.welding_process).trim()} non copre ${String(reqProcess).trim()}`,
        };
}

/** @returns {{ result: string, reason?: string }} */
function checkJoint(wpqr, reqJoint) {
    if (isBlank(reqJoint)) return { result: CHECK.SKIPPED };
    const warnings = [];
    const compatible = jointTypeCompatible(wpqr, reqJoint, warnings);
    if (!compatible) {
        return {
            result: CHECK.FAIL,
            reason: `Tipo giunto ${wpqr.joint_type} non copre ${String(reqJoint).trim().toUpperCase()}`,
        };
    }
    if (warnings.length > 0) {
        return { result: CHECK.PARTIAL, reason: 'Tipo giunto non dichiarato sulla WPQR' };
    }
    return { result: CHECK.OK };
}

function resolveRequirementGroup(raw) {
    if (isBlank(raw)) return { group: null };
    const r = resolveSteelGradeToGroup(raw);
    return { group: r.group, warning: r.warning };
}

/** @returns {{ result: string, reason?: string, clause?: string }} */
function checkMaterial(wpqr, basis, criteria) {
    if (isBlank(criteria.material_group) && isBlank(criteria.material_group_b)) {
        return { result: CHECK.SKIPPED };
    }
    const rawA = !isBlank(criteria.material_group) ? criteria.material_group : criteria.material_group_b;
    const rawB = !isBlank(criteria.material_group_b) ? criteria.material_group_b : rawA;
    const a = resolveRequirementGroup(rawA);
    const b = resolveRequirementGroup(rawB);
    if (!a.group || !b.group) {
        return {
            result: CHECK.PARTIAL,
            reason: a.warning || b.warning || 'Gruppo materiale richiesto non riconosciuto',
        };
    }

    const tested = wpqr.base_material_group || wpqr.material_group || null;
    if (isBlank(tested) || !normalizeMaterialGroupCode(tested)) {
        return { result: CHECK.PARTIAL, reason: 'Gruppo materiale non dichiarato sulla WPQR' };
    }

    if (basis === BASIS.ISO_15613) {
        return {
            result: CHECK.PARTIAL,
            reason: 'ISO 15613: nessuna soglia materiale codificata — verifica manuale sul verbale',
        };
    }

    if (basis === BASIS.ISO_14555) {
        const cover = [a.group, b.group].map((g) => isSimilarMaterialsCovered14555({
            parentGroup: g,
            studGroup: tested,
        }));
        if (cover.every((c) => c.covered)) {
            return { result: CHECK.OK, clause: cover[0].clause };
        }
        return {
            result: CHECK.PARTIAL,
            reason: `Gruppi ${a.group}/${b.group} diversi dalla prova ${tested}: verifica manuale ISO 14555 §10.2.8.4/§10.2.8.5`,
        };
    }

    const parsed = [a.group, b.group, tested].map((g) => normalizeMaterialGroupCode(g));
    if (basis === BASIS.ISO_15614_2) {
        const sameGroup = parsed.every((p) => p && p.group === parsed[2].group
            && (p.subgroup || null) === (parsed[2].subgroup || null));
        return sameGroup
            ? { result: CHECK.OK }
            : {
                result: CHECK.PARTIAL,
                reason: `ISO 15614-2: combinazione gruppi ${a.group}/${b.group} vs prova ${tested} non codificata — verifica manuale`,
            };
    }

    if (parsed.some((p) => p && p.group > 11)) {
        return {
            result: CHECK.PARTIAL,
            reason: 'Gruppo fuori Tabella 5 acciai (1-11): verifica manuale',
        };
    }
    const mat = isParentMaterialCombinationCovered({
        materialGroupTested: tested,
        parentGroupA: a.group,
        parentGroupB: b.group,
    });
    return mat.covered
        ? { result: CHECK.OK, clause: mat.reason }
        : { result: CHECK.FAIL, reason: mat.reason };
}

const OUT_OF_RANGE_RE = /fuori range/i;

function positiveNumberOrNull(v) {
    if (isBlank(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : NaN;
}

/**
 * Per ISO 15613 e 14555 le funzioni riusate non devono ricadere nelle tabelle
 * 15614 (Tabella 7 da thickness_tested, regola piastra→tubo): valgono solo i
 * range dichiarati sul record (14555 ha il proprio ramo spessore §10.2.8.6).
 */
function declaredOnlyRecord(wpqr) {
    return {
        ...wpqr,
        thickness_tested: null,
        product_type: null,
        qualification_level: '2',
    };
}

/** @returns {{ result: string, reason?: string }} */
function checkThickness(wpqr, criteria) {
    const tA = positiveNumberOrNull(criteria.thickness_mm);
    const tBraw = positiveNumberOrNull(criteria.thickness_b_mm);
    if (tA == null && tBraw == null) return { result: CHECK.SKIPPED };
    const a = tA != null ? tA : tBraw;
    const b = tBraw != null ? tBraw : a;
    if (Number.isNaN(a) || Number.isNaN(b)) {
        return { result: CHECK.FAIL, reason: 'Spessore richiesto non valido' };
    }
    const th = checkThicknessCoverage(wpqr, a, b);
    if (th.ok) {
        return th.partial
            ? { result: CHECK.PARTIAL, reason: th.reason }
            : { result: CHECK.OK, reason: th.reason };
    }
    // `partial` + range puo' essere sia fuori range calcolato (Tabella 7) sia il solo
    // hint gola senza range materiale: il primo e' un fallimento, il secondo no.
    if (OUT_OF_RANGE_RE.test(th.reason || '')) {
        return { result: CHECK.FAIL, reason: th.reason };
    }
    return { result: CHECK.PARTIAL, reason: th.reason };
}

/** @returns {{ result: string, reason?: string }} */
function checkDiameter(wpqr, criteria) {
    const d = positiveNumberOrNull(criteria.diameter_mm);
    if (d == null) return { result: CHECK.SKIPPED };
    if (Number.isNaN(d)) return { result: CHECK.FAIL, reason: 'Diametro richiesto non valido' };
    const dia = checkDiameterCoverage(wpqr, d);
    if (dia.ok) return { result: CHECK.OK, reason: dia.reason };
    return dia.range
        ? { result: CHECK.FAIL, reason: dia.reason }
        : { result: CHECK.PARTIAL, reason: dia.reason };
}

/** @returns {{ result: string, reason?: string }} */
function checkThroat(wpqr, basis, criteria) {
    const a = positiveNumberOrNull(criteria.throat_mm);
    if (a == null) return { result: CHECK.SKIPPED };
    if (Number.isNaN(a)) return { result: CHECK.FAIL, reason: 'Gola richiesta non valida' };
    if (basis === BASIS.ISO_15613) {
        return {
            result: CHECK.PARTIAL,
            reason: 'ISO 15613: nessuna soglia gola codificata — verifica manuale sul verbale',
        };
    }
    if (basis === BASIS.ISO_14555) {
        return { result: CHECK.FAIL, reason: 'Gola non applicabile a WPQR stud ISO 14555' };
    }
    const jointDeclared = !isBlank(wpqr.joint_type);
    const thr = checkThroatCoverage(wpqr, a);
    if (thr.ok) return { result: CHECK.OK, reason: thr.reason };
    if (thr.range) return { result: CHECK.FAIL, reason: thr.reason };
    if (!jointDeclared) {
        return { result: CHECK.PARTIAL, reason: 'Tipo giunto non dichiarato: gola non verificabile' };
    }
    const isFillet = String(wpqr.joint_type).toUpperCase().includes('FW');
    return isFillet
        ? { result: CHECK.PARTIAL, reason: thr.reason }
        : { result: CHECK.FAIL, reason: thr.reason };
}

function aggregateStatus(results) {
    const applicable = results.filter((r) => r !== CHECK.SKIPPED);
    if (applicable.some((r) => r === CHECK.FAIL)) return MATCH_STATUS.NO_MATCH;
    if (applicable.some((r) => r === CHECK.PARTIAL)) return MATCH_STATUS.PARTIAL;
    return MATCH_STATUS.MATCH;
}

function summarizeWpqr(wpqr, basis) {
    return {
        id: wpqr.id,
        wpqr_code: wpqr.wpqr_code || null,
        standard_reference: wpqr.standard_reference || null,
        qualification_basis: basis,
        welding_process: wpqr.welding_process || null,
        joint_type: wpqr.joint_type || null,
        base_material_group: wpqr.base_material_group || wpqr.material_group || null,
        thickness_min: wpqr.thickness_min ?? null,
        thickness_max: wpqr.thickness_max ?? null,
        diameter_min: wpqr.diameter_min ?? null,
        diameter_max: wpqr.diameter_max ?? null,
        company_id: wpqr.company_id ?? null,
    };
}

/**
 * Match puro WPQR ↔ criteri requisito (no DB).
 * @param {object} wpqr
 * @param {object} criteria
 * @returns {import('../coverageTypes').CapabilityMatch}
 */
function matchWpqrCapability(wpqr, criteria = {}) {
    const basis = resolveQualificationBasis(wpqr);
    const declaredOnly = basis === BASIS.ISO_15613 || basis === BASIS.ISO_14555;
    const checked = declaredOnly ? declaredOnlyRecord(wpqr) : wpqr;

    const checks = {
        process: checkProcess(wpqr, criteria.welding_process),
        joint_type: checkJoint(wpqr, criteria.joint_type),
        material: checkMaterial(wpqr, basis, criteria),
        thickness: checkThickness(checked, criteria),
        diameter: checkDiameter(checked, criteria),
        throat: checkThroat(checked, basis, criteria),
    };

    const detail = { qualification_basis: basis };
    const reasons = [];
    Object.entries(checks).forEach(([key, c]) => {
        detail[key] = c.result;
        if (c.result === CHECK.FAIL || c.result === CHECK.PARTIAL) {
            if (c.reason) reasons.push(c.reason);
        }
    });

    const status = aggregateStatus(Object.values(checks).map((c) => c.result));

    if (basis === BASIS.ISO_14555) {
        detail.stud_scope = 'sezione, posizione e atmosfera stud non verificate (dati non presenti sulla WPQR)';
    }
    if (basis === BASIS.ISO_15613) {
        detail.thresholds = 'ISO 15613: base di qualifica; nessuna soglia di validita\u00e0 codificata';
    }
    if (status === MATCH_STATUS.MATCH && reasons.length === 0) {
        reasons.push(`Requisito coperto dalla WPQR ${wpqrLabel(wpqr)} (${basis})`);
    }

    return {
        domain: COVERAGE_DOMAINS.WPQR_PROCEDURE,
        capability_id: wpqr.id ?? null,
        status,
        reasons,
        detail,
        capability: summarizeWpqr(wpqr, basis),
    };
}

const STATUS_ORDER = {
    [MATCH_STATUS.MATCH]: 0,
    [MATCH_STATUS.PARTIAL]: 1,
    [MATCH_STATUS.NO_MATCH]: 2,
};

/**
 * @param {import('../coverageTypes').Requirement} req
 * @param {import('../coverageTypes').MatchContext} ctx
 * @returns {Promise<import('../coverageTypes').CapabilityMatch[]>}
 */
async function match(req, ctx) {
    const companyId = req.company_id != null ? req.company_id : ctx.companyId;
    const records = await loadWpqrRecords(ctx.organizationId, companyId ?? null);
    const criteria = req.criteria || {};
    return records
        .map((wpqr) => matchWpqrCapability(wpqr, criteria))
        .map((m, idx) => ({ m, idx }))
        .sort((x, y) => (STATUS_ORDER[x.m.status] - STATUS_ORDER[y.m.status]) || (x.idx - y.idx))
        .map(({ m }) => m);
}

const wpqrProcedureAdapter = {
    domain: COVERAGE_DOMAINS.WPQR_PROCEDURE,
    label: 'Processi / WPQR (15614 \u00b7 14555 \u00b7 15613)',
    standard: 'ISO 15614 / 14555 / 15613',
    implemented: true,
    maturity: 'full',
    requirementFields: REQUIREMENT_FIELDS,
    emptyMessage: NO_WPQR_MESSAGE,
    match,
    matchWpqrCapability,
    resolveQualificationBasis,
};

module.exports = wpqrProcedureAdapter;
