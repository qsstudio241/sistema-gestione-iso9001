/**
 * @jest-environment node
 *
 * Privacy log: il nome del titolare (saldatore/operatore) non compare nella riga
 * `[QualifIngest] Committed qualifica ...`. Fixture sintetiche: nomi fittizi.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({
        ok: true, personnelId: 55, personName: 'ZZROSSI ZZMARIO',
    }),
}));

const logger = require('../utils/logger');
const { getPool } = require('../config/database');
const { redactPersonForLog } = require('../utils/ingestErrorMessage');
const { commitQualificationFromFields } = require('./qualificationIngest.service');

const allLogged = () => ['info', 'warn', 'error', 'debug']
    .flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n');

function mockPool() {
    const dupReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] }) };
    const insertReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 901 }] }) };
    let n = 0;
    getPool.mockResolvedValue({ request: jest.fn(() => { n += 1; return n === 1 ? dupReq : insertReq; }) });
    return insertReq;
}

describe('commitQualificationFromFields: nessun nome del titolare nei log', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([
        ['welder_name', { welder_name: 'ZZROSSI ZZMARIO' }],
        ['operator_name', { operator_name: 'ZZROSSI ZZMARIO' }],
        ['person_name', { person_name: 'ZZROSSI ZZMARIO' }],
    ])('riga Committed con %s: person#hash, tipo e id invariati, nessun nome', async (_k, nameFields) => {
        const insertReq = mockPool();
        const result = await commitQualificationFromFields({
            ...nameFields,
            certificate_number: 'CERT-LOG-1',
            welding_process: '135',
        }, 10, 20, { qualificationType: 'Saldatore ISO 9606-1' });

        const line = logger.info.mock.calls.map((c) => String(c[0])).find((l) => l.includes('Committed qualifica'));
        expect(line).toBe(`[QualifIngest] Committed qualifica id=901 (${redactPersonForLog('ZZROSSI ZZMARIO')}, Saldatore ISO 9606-1) per org 10`);

        const logged = allLogged();
        for (const leak of ['ZZROSSI', 'ZZMARIO', 'zzrossi', 'zzmario']) expect(logged).not.toContain(leak);

        // Non regressione funzionale: il nome continua a essere salvato e restituito.
        expect(insertReq.input).toHaveBeenCalledWith('personName', 'ZZROSSI ZZMARIO');
        expect(result.person_name).toBe('ZZROSSI ZZMARIO');
        expect(result.qualification_id).toBe(901);
    });
});
