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
const { listRulePacks } = require('../services/qualificationVerify');
require('../services/qualificationVerify/registerDefaultPacks');
const { REPROCESSABLE_FIELDS: QUALIFICATION_WRITE_FIELDS } = require('../services/qualificationIngest.service');
const { WPQR_REPROCESSABLE_FIELDS } = require('../services/wpqrIngest.service');

const WRITE_WHITELISTS_BY_TABLE = {
    qualifications: QUALIFICATION_WRITE_FIELDS,
    wpqr_records: WPQR_REPROCESSABLE_FIELDS,
};

const isVerify = (def) => def.kind === 'verify';
const BACKFILL_REGISTRY = Object.fromEntries(
    Object.entries(REPROCESSABLE_FIELD_REGISTRY).filter(([, def]) => !isVerify(def))
);
const VERIFY_REGISTRY = Object.fromEntries(
    Object.entries(REPROCESSABLE_FIELD_REGISTRY).filter(([, def]) => isVerify(def))
);

describe('Registro campi rielaborabili — sincronia con le whitelist di scrittura (per tabella, voci backfill)', () => {
    it('ogni voce del registro esiste nella whitelist di scrittura della PROPRIA tabella', () => {
        const missing = [];
        for (const [key, def] of Object.entries(BACKFILL_REGISTRY)) {
            const whitelist = WRITE_WHITELISTS_BY_TABLE[def.table];
            if (!whitelist || !whitelist[key]) missing.push(`${key} (tabella: ${def.table})`);
        }
        expect(missing).toEqual([]);
    });

    it('ogni campo della whitelist qualifications esiste anche nel registro candidati', () => {
        const registryKeysForQualifications = new Set(
            Object.entries(BACKFILL_REGISTRY)
                .filter(([, def]) => def.table === 'qualifications')
                .map(([key]) => key)
        );
        const missing = Object.keys(QUALIFICATION_WRITE_FIELDS).filter((k) => !registryKeysForQualifications.has(k));
        expect(missing).toEqual([]);
    });

    it('ogni campo della whitelist wpqr_records esiste anche nel registro candidati', () => {
        const registryKeysForWpqr = new Set(
            Object.entries(BACKFILL_REGISTRY)
                .filter(([, def]) => def.table === 'wpqr_records')
                .map(([key]) => key)
        );
        const missing = Object.keys(WPQR_REPROCESSABLE_FIELDS).filter((k) => !registryKeysForWpqr.has(k));
        expect(missing).toEqual([]);
    });

    it('la colonna reale (column, o key se assente) coincide tra registro e whitelist di scrittura', () => {
        const mismatches = [];
        for (const [key, def] of Object.entries(BACKFILL_REGISTRY)) {
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

describe('Registro — voci kind:verify (sola lettura, nessuna scrittura)', () => {
    const allWhitelistKeys = () => [
        ...Object.keys(QUALIFICATION_WRITE_FIELDS),
        ...Object.keys(WPQR_REPROCESSABLE_FIELDS),
    ];

    it('esistono le voci verify_9606_1 e verify_9606_2 e ogni voce senza kind è un backfill', () => {
        expect(VERIFY_REGISTRY.verify_9606_1).toBeDefined();
        expect(VERIFY_REGISTRY.verify_9606_2).toMatchObject({ kind: 'verify', verifyFamily: '9606-2', table: 'qualifications' });
        for (const [key, def] of Object.entries(BACKFILL_REGISTRY)) {
            expect(def.kind === undefined || def.kind === 'backfill').toBe(true);
            expect(key).not.toMatch(/^verify_/);
        }
    });

    it('(b) ogni voce verify ha una verifyFamily presente nel registry di verifica', () => {
        const families = new Set(listRulePacks().map((p) => p.standardFamily));
        const unknown = Object.values(VERIFY_REGISTRY)
            .filter((def) => !families.has(def.verifyFamily))
            .map((def) => `${def.key} (verifyFamily: ${def.verifyFamily})`);
        expect(unknown).toEqual([]);
    });

    it('(sync per tipo) una voce verify per ogni famiglia di pack con qualificazione saldatori, senza duplicare la famiglia', () => {
        const families = Object.values(VERIFY_REGISTRY).map((def) => def.verifyFamily);
        expect(new Set(families).size).toBe(families.length);
        expect(families).toEqual(expect.arrayContaining(['9606-1', '9606-2']));
    });

    it('nessuna chiave verify compare in una whitelist di scrittura (né come chiave né come colonna)', () => {
        const writeKeys = new Set(allWhitelistKeys());
        const writeColumns = new Set([
            ...Object.values(QUALIFICATION_WRITE_FIELDS),
            ...Object.values(WPQR_REPROCESSABLE_FIELDS),
        ].map((d) => d && d.column).filter(Boolean));
        for (const key of Object.keys(VERIFY_REGISTRY)) {
            expect(writeKeys.has(key)).toBe(false);
            expect(writeColumns.has(key)).toBe(false);
        }
    });

    it('ogni chiave "verify_*" del registro è kind:verify e viceversa', () => {
        for (const [key, def] of Object.entries(REPROCESSABLE_FIELD_REGISTRY)) {
            expect(key.startsWith('verify_')).toBe(isVerify(def));
            expect(def.key).toBe(key);
        }
        for (const key of allWhitelistKeys()) expect(key.startsWith('verify_')).toBe(false);
    });

    it('le voci verify non portano attributi da backfill (column, candidateWhere, bundleColumns, filtri AI)', () => {
        for (const def of Object.values(VERIFY_REGISTRY)) {
            for (const forbidden of ['column', 'candidateWhere', 'bundleColumns', 'processWhitelist', 'jointTypeWhitelist', 'productTypeWhitelist']) {
                expect(def[forbidden]).toBeUndefined();
            }
            expect(def.table).toBe('qualifications');
            expect(def.module).toBe('qualifiche');
            expect(typeof def.qualTypeLike).toBe('string');
        }
    });

    it('(c) nessuna chiave duplicata tra i kind (una sola voce per chiave, nessuna collisione con le colonne backfill)', () => {
        const keys = Object.values(REPROCESSABLE_FIELD_REGISTRY).map((d) => d.key);
        expect(new Set(keys).size).toBe(keys.length);
        const backfillColumns = new Set(Object.entries(BACKFILL_REGISTRY).map(([k, d]) => d.column || k));
        for (const key of Object.keys(VERIFY_REGISTRY)) expect(backfillColumns.has(key)).toBe(false);
    });
});
