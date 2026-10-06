/**
 * wpsWelderCoverage.js — Ponte commessa: WPS ↔ qualifiche saldatori sul registry `welder_9606`.
 *
 * Usato da GET /qualifications/coverage (Progetti) e GET /cases/:id/extracted-coverage (Riesame).
 * Il contratto di risposta dei chiamanti resta quello storico: qui si ricostruisce la forma
 * `coverage_detail` legacy ({process, thickness, material_group, position, overall}) a partire
 * da `matchWelderCapability`, senza cambiare l'esito dei semafori.
 *
 * Scelte di parità con `computeQualificationCoverage` (oracolo nel test differenziale):
 *   - processo: `checkProcess` legacy (include-based sull'intera stringa; qualifica senza
 *     `welding_process` = esclusa). Il matcher token-based dell'adapter è più permissivo e la
 *     colonna `welding_processes_validity` non viene selezionata: passare a quella fonte cambia
 *     i semafori ed è una decisione del committente (fuori COV-4).
 *   - tipo giunto / tipo prodotto / Ø tubo: non vincolanti per la WPS → criteri non passati.
 */

'use strict';

const { checkProcess, computeWpsCoverageEsito } = require('../../utils/qualificationCoverage');
const { isQualificationOperationallyActive } = require('../weldingCoordinatorAuth.service');
const { MATCH_STATUS } = require('./coverageTypes');
const { matchWelderCapability } = require('./adapters/welder9606.adapter');

const WELDER_QUALIFICATION_SELECT = `
    SELECT q.id, q.person_name, q.person_code, q.qualification_type,
           q.welding_process, q.material_group, q.position_range,
           q.thickness_min_mm, q.thickness_max_mm, q.thickness_max_unlimited, q.thickness_range, q.joint_type,
           q.expiry_date, q.status, q.approval_status, q.next_confirmation_due,
           c.name AS company_name
    FROM qualifications q
    LEFT JOIN companies c ON c.id = q.company_id
`;

const OVERALL_BY_STATUS = {
    [MATCH_STATUS.MATCH]: 'ok',
    [MATCH_STATUS.PARTIAL]: 'partial',
    [MATCH_STATUS.NO_MATCH]: 'excluded',
};

/**
 * Criteri `welder_9606` equivalenti ai requisiti di una riga WPS (già normalizzata:
 * `base_material_group` e `welding_positions` con fallback sui campi legacy).
 * @param {object} wps
 */
function wpsToWelderCriteria(wps) {
    return {
        welding_process: wps.welding_process,
        thickness_min_mm: wps.thickness_range_min,
        thickness_max_mm: wps.thickness_range_max,
        material_group: wps.base_material_group,
        positions: wps.welding_positions,
    };
}

/**
 * Copertura di una qualifica rispetto a una WPS, nella forma legacy.
 * @returns {{process: string, thickness: string, material_group: string, position: string, overall: 'ok'|'partial'|'excluded'}}
 */
function matchWpsToQualification(qual, wps, opts = {}) {
    const { welding_process: wpsProcess, ...criteria } = wpsToWelderCriteria(wps);
    if (!checkProcess(qual.welding_process, wpsProcess)) {
        return {
            process: 'mismatch',
            thickness: 'skipped',
            material_group: 'skipped',
            position: 'skipped',
            overall: 'excluded',
        };
    }
    const m = matchWelderCapability(qual, criteria, { todayIso: opts.todayIso });
    return {
        process: 'ok',
        thickness: m.detail.thickness,
        material_group: m.detail.material_group,
        position: m.detail.positions,
        overall: OVERALL_BY_STATUS[m.status],
    };
}

/**
 * @param {object} wps
 * @param {object[]} qualRows
 * @param {{ todayIso?: string }} [opts]
 * @returns {{ qualifiers: Array<{ q: object, detail: object }>, esito: 'verde'|'giallo'|'rosso' }}
 */
function computeWpsWelderCoverage(wps, qualRows, opts = {}) {
    const qualifiers = qualRows
        .map((q) => ({ q, detail: matchWpsToQualification(q, wps, opts) }))
        .filter(({ detail }) => detail.overall !== 'excluded');
    const esito = computeWpsCoverageEsito(qualifiers.map(({ detail }) => detail));
    return { qualifiers, esito };
}

/**
 * Loader unico delle qualifiche saldatori operative di una commessa.
 * Nessun filtro su approval_status (gate manuale rimosso): l'esclusione per certificato scaduto
 * o conferma semestrale non superata è automatica, via isQualificationOperationallyActive.
 * @param {object} params
 * @param {(sql: string, params: object) => Promise<{recordset?: object[]}>} params.query
 * @param {number} params.organizationId
 * @param {number|null} [params.companyId]
 * @param {string} [params.todayIso]
 * @returns {Promise<object[]>}
 */
async function loadWelderQualificationsForProject({ query, organizationId, companyId, todayIso }) {
    const params = { organizationId };
    let where = `
        q.organization_id = @organizationId
        AND q.status NOT IN ('revocata','sospesa')
        AND (q.qualification_type LIKE '%9606%' OR q.qualification_type LIKE '%14732%')
    `;
    if (companyId) {
        params.projCompId = Number(companyId);
        where += ' AND q.company_id = @projCompId';
    }
    const res = await query(
        `${WELDER_QUALIFICATION_SELECT} WHERE ${where} ORDER BY q.person_name`,
        params,
    );
    return (res.recordset || []).filter((q) => isQualificationOperationallyActive(q, todayIso));
}

module.exports = {
    wpsToWelderCriteria,
    matchWpsToQualification,
    computeWpsWelderCoverage,
    loadWelderQualificationsForProject,
};
