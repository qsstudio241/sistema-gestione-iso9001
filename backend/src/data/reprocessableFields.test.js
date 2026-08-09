/**
 * Test strutturale — sincronia tra il registro candidati e le whitelist di
 * scrittura per tabella (gap analysis 08/08/2026, stesso pattern del
 * "round-trip a sentinella" e della "completezza modifica manuale" introdotti
 * in questa sessione).
 *
 * `reprocessableFields.js` (selezione candidati + pannello superadmin) e le
 * whitelist di scrittura finale — `REPROCESSABLE_FIELDS` in
 * `qualificationIngest.service.js` per `qualifications`,
 * `WPQR_REPROCESSABLE_FIELDS` in `wpqrIngest.service.js` per `wpqr_records` —
 * sono mantenute a mano in file diversi per design (per non introdurre un
 * secondo punto di verità sulla scrittura), ma questo significa che possono
 * disallinearsi silenziosamente. Questo test lo impedisce, per ciascuna
 * tabella separatamente (una chiave `wpqr_thickness_max_unlimited` nel
 * registro condiviso non deve mai essere cercata nella whitelist sbagliata).
 */

jest.mock('../config/database', () => ({ getPool: jest.fn(), query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('../services/personnelQualificationLink.service', () => ({ resolvePersonnelForQualification: jest.fn() }));
jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_FOR_WPQR: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { REPROCESSABLE_FIELD_REGISTRY } = require('./reprocessableFields');
const { REPROCESSABLE_FIELDS: QUALIFICATION_WRITE_FIELDS } = require('../services/qualificationIngest.service');
const { WPQR_REPROCESSABLE_FIELDS } = require('../services/wpqrIngest.service');

const WRITE_WHITELISTS_BY_TABLE = {
    qualifications: QUALIFICATION_WRITE_FIELDS,
    wpqr_records: WPQR_REPROCESSABLE_FIELDS,
};

describe('Registro campi rielaborabili — sincronia con le whitelist di scrittura (per tabella)', () => {
    it('ogni voce del registro esiste nella whitelist di scrittura della PROPRIA tabella', () => {
        const missing = [];
        for (const [key, def] of Object.entries(REPROCESSABLE_FIELD_REGISTRY)) {
            const whitelist = WRITE_WHITELISTS_BY_TABLE[def.table];
            if (!whitelist || !whitelist[key]) missing.push(`${key} (tabella: ${def.table})`);
        }
        expect(missing).toEqual([]);
    });

    it('ogni campo della whitelist qualifications esiste anche nel registro candidati', () => {
        const registryKeysForQualifications = new Set(
            Object.entries(REPROCESSABLE_FIELD_REGISTRY)
                .filter(([, def]) => def.table === 'qualifications')
                .map(([key]) => key)
        );
        const missing = Object.keys(QUALIFICATION_WRITE_FIELDS).filter((k) => !registryKeysForQualifications.has(k));
        expect(missing).toEqual([]);
    });

    it('ogni campo della whitelist wpqr_records esiste anche nel registro candidati', () => {
        const registryKeysForWpqr = new Set(
            Object.entries(REPROCESSABLE_FIELD_REGISTRY)
                .filter(([, def]) => def.table === 'wpqr_records')
                .map(([key]) => key)
        );
        const missing = Object.keys(WPQR_REPROCESSABLE_FIELDS).filter((k) => !registryKeysForWpqr.has(k));
        expect(missing).toEqual([]);
    });

    it('la colonna reale (column, o key se assente) coincide tra registro e whitelist di scrittura', () => {
        const mismatches = [];
        for (const [key, def] of Object.entries(REPROCESSABLE_FIELD_REGISTRY)) {
            const whitelist = WRITE_WHITELISTS_BY_TABLE[def.table];
            const writeDef = whitelist?.[key];
            if (!writeDef) continue; // già segnalato dal primo test
            const registryColumn = def.column || key;
            if (registryColumn !== writeDef.column) {
                mismatches.push(`${key}: registro="${registryColumn}" whitelist="${writeDef.column}"`);
            }
        }
        expect(mismatches).toEqual([]);
    });
});
