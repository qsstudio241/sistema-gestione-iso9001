/**
 * Test strutturale — sincronia dei due registri "campi rielaborabili"
 * (gap analysis 08/08/2026, stesso pattern del "round-trip a sentinella" e
 * della "completezza modifica manuale" introdotti in questa sessione).
 *
 * `reprocessableFields.js` (selezione candidati + pannello superadmin) e
 * `REPROCESSABLE_FIELDS` in `qualificationIngest.service.js` (whitelist di
 * scrittura finale) sono DUE fonti mantenute a mano in due file diversi — per
 * design (documentato in entrambi i file, per non introdurre un secondo punto
 * di verità sulla scrittura), ma questo significa che possono disallinearsi
 * silenziosamente. Questo test lo impedisce.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn(), query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('../services/personnelQualificationLink.service', () => ({ resolvePersonnelForQualification: jest.fn() }));
jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { REPROCESSABLE_FIELD_REGISTRY } = require('./reprocessableFields');
const { REPROCESSABLE_FIELDS } = require('../services/qualificationIngest.service');

describe('Registro campi rielaborabili — sincronia tra le due fonti', () => {
    it('ogni chiave in reprocessableFields.js esiste anche in REPROCESSABLE_FIELDS (qualificationIngest.service.js)', () => {
        const registryKeys = Object.keys(REPROCESSABLE_FIELD_REGISTRY);
        const writeWhitelistKeys = new Set(Object.keys(REPROCESSABLE_FIELDS));

        const missingFromWriteWhitelist = registryKeys.filter((k) => !writeWhitelistKeys.has(k));

        expect(missingFromWriteWhitelist).toEqual([]);
    });

    it('ogni chiave in REPROCESSABLE_FIELDS esiste anche nel registro candidati (nessuna colonna scrivibile senza un modo per trovare i candidati)', () => {
        const writeWhitelistKeys = Object.keys(REPROCESSABLE_FIELDS);
        const registryKeys = new Set(Object.keys(REPROCESSABLE_FIELD_REGISTRY));

        const missingFromRegistry = writeWhitelistKeys.filter((k) => !registryKeys.has(k));

        expect(missingFromRegistry).toEqual([]);
    });
});
