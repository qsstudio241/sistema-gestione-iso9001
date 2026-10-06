/**
 * Lo script CLI di backfill (`reprocess-qualifications.js`) deve rifiutare le voci `verify_*`:
 * sono verifiche in sola lettura, non backfill, e non passano dal servizio di scrittura.
 */

jest.mock('../../config/database', () => ({ query: jest.fn(), getPool: jest.fn(), closePool: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('../personnelQualificationLink.service', () => ({ resolvePersonnelForQualification: jest.fn() }));
jest.mock('../../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_FOR_WPQR: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { getPool } = require('../../config/database');
const cli = require('../../../scripts/reprocess-qualifications');

function runCli(args) {
    const argv = process.argv;
    const errors = [];
    const errSpy = jest.spyOn(console, 'error').mockImplementation((m) => errors.push(String(m)));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`);
    });
    process.argv = ['node', 'reprocess-qualifications.js', ...args];
    return cli.main()
        .then(() => ({ exit: null, errors }), (e) => ({ exit: String(e.message), errors }))
        .finally(() => {
            process.argv = argv;
            errSpy.mockRestore();
            logSpy.mockRestore();
            exitSpy.mockRestore();
        });
}

describe('reprocess-qualifications.js — voci verify', () => {
    beforeEach(() => getPool.mockClear());

    test('--field=verify_9606_1 è rifiutato con messaggio chiaro, senza connettersi al DB', async () => {
        const out = await runCli(['--field=verify_9606_1']);
        expect(out.exit).toBe('exit:1');
        expect(out.errors.join('\n')).toMatch(/VERIFICA \(sola lettura\), non un backfill/);
        expect(getPool).not.toHaveBeenCalled();
    });

    test('--field=verify_9606_2 è rifiutato come verify_9606_1, senza connettersi al DB', async () => {
        const out = await runCli(['--field=verify_9606_2']);
        expect(out.exit).toBe('exit:1');
        expect(out.errors.join('\n')).toMatch(/VERIFICA \(sola lettura\), non un backfill/);
        expect(getPool).not.toHaveBeenCalled();
    });

    test('--dry-run non aggira il rifiuto', async () => {
        const out = await runCli(['--field=verify_9606_1', '--dry-run']);
        expect(out.exit).toBe('exit:1');
        expect(getPool).not.toHaveBeenCalled();
    });

    test('l\'elenco dei campi disponibili non propone le voci verify', async () => {
        const out = await runCli([]);
        expect(out.exit).toBe('exit:1');
        const list = out.errors.find((m) => m.startsWith('Campi disponibili'));
        expect(list).toContain('transfer_mode');
        expect(list).not.toContain('verify_');
    });

    test('un campo sconosciuto resta un errore "non configurato"', async () => {
        const out = await runCli(['--field=nope']);
        expect(out.exit).toBe('exit:1');
        expect(out.errors.join('\n')).toMatch(/Campo non configurato: nope/);
    });

    test('isVerifyField distingue verify da backfill', () => {
        expect(cli.isVerifyField(cli.FIELD_CONFIGS.verify_9606_1)).toBe(true);
        expect(cli.isVerifyField(cli.FIELD_CONFIGS.verify_9606_2)).toBe(true);
        expect(cli.isVerifyField(cli.FIELD_CONFIGS.transfer_mode)).toBe(false);
    });
});
