/**
 * @jest-environment node
 *
 * Test strutturale — completezza modifica manuale Qualifiche vs schemi ingest AI
 * (gap analysis 08/08/2026, stesso pattern applicato a WPQR). Copre tutti gli
 * schemi ingest che scrivono sulla tabella `qualifications`: patentino_saldatore
 * (ISO 9606-1), qualifica_14732 (operatori automatica/meccanizzata), cert_ndt
 * (ISO 9712), qualifica_14731 (coordinatori saldatura).
 *
 * Rende permanente l'audit fatto a mano quella sessione: se in futuro si
 * aggiunge un campo a uno di questi schemi ingest dimenticando di aggiungerlo
 * anche a QUALIFICATION_MANUAL_EDITABLE_FIELDS (qualifications.controller.js —
 * E alla query UPDATE reale, che questo test NON verifica direttamente, vedi
 * nota nella costante), questo test fallisce in CI.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn(), query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn(),
    companyAccessSqlFilter: jest.fn(),
    assertMutatingAllowed: jest.fn(),
    assertCompanyRead: jest.fn(),
    hasCompanyAccessRows: jest.fn(),
    sendAccessDenied: jest.fn(),
}));

const { DOCUMENT_TYPE_SCHEMAS } = require('../data/documentTypeSchemas');
const { QUALIFICATION_MANUAL_EDITABLE_FIELDS } = require('./qualifications.controller');
const { findIngestFieldsMissingFromManualEdit } = require('../utils/manualEditCompletenessCheck');

describe('Qualifiche — completezza modifica manuale vs schemi ingest AI', () => {
    it('patentino_saldatore (ISO 9606-1): ogni campo è editabile a mano', () => {
        const schema = DOCUMENT_TYPE_SCHEMAS.patentino_saldatore.aiExpectedSchema;
        const aliases = {
            welder_name: 'person_name',
            filler_material_group: 'filler_material',
            welding_positions: 'position_range',
            pipe_diameter_mm: 'pipe_diameter_min_mm',
            standard_reference: 'standard_ref',
        };
        const missing = findIngestFieldsMissingFromManualEdit(schema, QUALIFICATION_MANUAL_EDITABLE_FIELDS, { aliases });
        expect(missing).toEqual([]);
    });

    it('qualifica_14732 (operatori automatica/meccanizzata): ogni campo è editabile a mano', () => {
        const schema = DOCUMENT_TYPE_SCHEMAS.qualifica_14732.aiExpectedSchema;
        const aliases = {
            operator_name: 'person_name',
            welding_positions: 'position_range',
        };
        const missing = findIngestFieldsMissingFromManualEdit(schema, QUALIFICATION_MANUAL_EDITABLE_FIELDS, { aliases });
        expect(missing).toEqual([]);
    });

    it('cert_ndt (ISO 9712): ogni campo è editabile a mano', () => {
        const schema = DOCUMENT_TYPE_SCHEMAS.cert_ndt.aiExpectedSchema;
        const aliases = {
            operator_name: 'person_name',
            certification_level: 'ndt_level',
        };
        const missing = findIngestFieldsMissingFromManualEdit(schema, QUALIFICATION_MANUAL_EDITABLE_FIELDS, { aliases });
        expect(missing).toEqual([]);
    });

    it('qualifica_14731 (coordinatori saldatura): ogni campo è editabile a mano', () => {
        const schema = DOCUMENT_TYPE_SCHEMAS.qualifica_14731.aiExpectedSchema;
        const missing = findIngestFieldsMissingFromManualEdit(schema, QUALIFICATION_MANUAL_EDITABLE_FIELDS, {});
        expect(missing).toEqual([]);
    });
});
