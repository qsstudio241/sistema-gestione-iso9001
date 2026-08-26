/**
 * @jest-environment node
 *
 * Test strutturale — completezza modifica manuale WPQR vs schema ingest AI
 * (gap analysis 08/08/2026, segnalazione committente: il form "Modifica WPQR"
 * era rimasto indietro rispetto a tutti i campi che l'ingest AI popola).
 *
 * Rende permanente l'audit fatto a mano quella sessione: se in futuro si
 * aggiunge un campo allo schema ingest WPQR (aiExpectedSchema) dimenticando di
 * aggiungerlo anche a WPQR_MANUAL_EDITABLE_FIELDS (welding.controller.js),
 * questo test fallisce in CI invece di scoprirlo mesi dopo da un utente.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { DOCUMENT_TYPE_SCHEMAS } = require('../data/documentTypeSchemas');
const { WPQR_MANUAL_EDITABLE_FIELDS } = require('./welding.controller');
const { findIngestFieldsMissingFromManualEdit } = require('../utils/manualEditCompletenessCheck');

describe('WPQR — completezza modifica manuale vs schema ingest AI', () => {
    it('ogni campo di aiExpectedSchema(wpqr) è editabile da form/API manuale (updateWPQR)', () => {
        const schema = DOCUMENT_TYPE_SCHEMAS.wpqr.aiExpectedSchema;

        // Alias documentati: la chiave ingest esiste con nome diverso nella
        // whitelist manuale, ma è comunque pienamente editabile.
        const aliases = {
            wpqr_number: 'wpqr_code', // referenceNumber deriva da wpqr_code lato mapping ingest
            material_group: 'base_material_group',
            material_group_2: 'base_material_group_2',
            thickness_test_mm: 'thickness_tested', // stesso concetto, nome colonna DB storico diverso
            approval_date: 'issue_date', // mapPipelineFieldsToReview: approval_date || issue_date
        };

        const missing = findIngestFieldsMissingFromManualEdit(schema, WPQR_MANUAL_EDITABLE_FIELDS, { aliases });

        expect(missing).toEqual([]);
    });
});
