/**
 * wpqrProcedure.adapter.js — Stub tipizzato dominio WPQR / procedure
 * (ISO 15614, 14555 stud, 15613 pre-produzione).
 *
 * COV-1: registrato nel registry; match completo = COV-2 (riuso wpsGenerator).
 */

'use strict';

const { COVERAGE_DOMAINS, MATCH_STATUS } = require('../coverageTypes');

const REQUIREMENT_FIELDS = [
    {
        key: 'welding_process',
        label: 'Processo',
        type: 'text',
        hint: 'Es. 135 — match pieno in COV-2',
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
        key: 'material_group',
        label: 'Gruppo materiale',
        type: 'text',
    },
];

/**
 * @param {import('../coverageTypes').Requirement} req
 * @returns {Promise<import('../coverageTypes').CapabilityMatch[]>}
 */
async function match(req) {
    return [{
        domain: COVERAGE_DOMAINS.WPQR_PROCEDURE,
        capability_id: null,
        status: MATCH_STATUS.NOT_IMPLEMENTED,
        reasons: [
            'Adapter wpqr_procedure registrato (COV-1). Match pieno ISO 15614/14555/15613 in COV-2.',
        ],
        detail: { stub: 'not_implemented' },
        capability: null,
        _criteria_echo: req?.criteria || {},
    }];
}

const wpqrProcedureAdapter = {
    domain: COVERAGE_DOMAINS.WPQR_PROCEDURE,
    label: 'Processi / WPQR (15614 · 14555 · 15613)',
    standard: 'ISO 15614 / 14555 / 15613',
    implemented: false,
    requirementFields: REQUIREMENT_FIELDS,
    match,
};

module.exports = wpqrProcedureAdapter;
