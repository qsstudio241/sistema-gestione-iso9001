/**
 * @jest-environment node
 *
 * Ramo `kind:'verify'` di qualificationReprocess.service.js: sola lettura.
 * Le voci di verifica non devono mai raggiungere la logica di backfill
 * (file su disco, AI, proposte in ingest_staging, whitelist di scrittura).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('./qualificationVerify/registerDefaultPacks', () => {
    const actual = jest.requireActual('./qualificationVerify/registerDefaultPacks');
    return { ensureDefaultPacks: () => {}, DEFAULT_PACKS: actual.DEFAULT_PACKS };
});
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({ resolvePersonnelForQualification: jest.fn() }));
jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_FOR_WPQR: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));
jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        existsSync: jest.fn(actual.existsSync),
        readFileSync: jest.fn(actual.readFileSync),
        writeFileSync: jest.fn(),
        unlinkSync: jest.fn(),
    };
});

const fs = require('fs');
const { query } = require('../config/database');
const { createStagingRecord } = require('./ingestStaging.service');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const {
    countReprocessCandidates,
    runReprocessForField,
    selectReprocessCandidates,
} = require('./qualificationReprocess.service');
const { getReprocessableField } = require('../data/reprocessableFields');
const registry = require('./qualificationVerify/verifyRegistry');
const { ensureDefaultPacks, DEFAULT_PACKS } = require('./qualificationVerify/registerDefaultPacks');
const { FAMILY, SEVERITY, STATUS, DIRECTION, TEXT_STATUS, makeFinding } = require('./qualificationVerify/findingTypes');
const { CORE_COLUMNS, OPTIONAL_COLUMNS, resetColumnsCache } = require('./qualificationVerify/verifyRecordLoader');

/**
 * Isolamento dai pack reali: i pack di default entrano con `rules: []` (stesso id, quindi
 * `ensureDefaultPacks()` dell'engine non li sostituisce). Il pack di prova emette solo un `info`
 * non verificabile (mai un warn): il ramo verify attraversa l'engine ma nessun record e' candidato.
 */
const TEST_PACK = {
    id: 'vq8.reprocess.verify.test.pack',
    standardFamily: '9606-1',
    editions: ['2017'],
    profiles: ['9606-1:BW'],
    rules: [
        {
            id: 'vq8.reprocess.verify.test.info',
            family: FAMILY.CORRETTEZZA,
            codes: ['QVTEST.REPROCESS.INFO'],
            run: () => [makeFinding({
                code: 'QVTEST.REPROCESS.INFO',
                family: FAMILY.CORRETTEZZA,
                severity: SEVERITY.INFO,
                status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
                field: 'thickness_s_test_mm',
                message_it: 'Dato di prova non presente: verifica non eseguibile.',
            })],
        },
    ],
};

const TEST_CODE_9606_2 = 'QVTEST2.CORR.THK_MAX';
const TEST_PACK_9606_2 = {
    id: 'vq10.test.pack',
    standardFamily: '9606-2',
    editions: ['2004'],
    profiles: ['9606-2:BW'],
    rules: [{
        id: 'vq10.test.thkMax',
        family: FAMILY.CORRETTEZZA,
        codes: [TEST_CODE_9606_2],
        run: (view) => (view.thickness_max_mm != null && view.thickness_max_mm > 8
            ? [makeFinding({
                code: TEST_CODE_9606_2,
                family: FAMILY.CORRETTEZZA,
                severity: SEVERITY.WARN,
                status: STATUS.VERIFICABILE,
                field: 'thickness_max_mm',
                direction: DIRECTION.OVER_CLAIM,
                read_value: view.thickness_max_mm,
                expected_value: 8,
                source: { norm: 'ISO 9606-2', edition: '2004', clause: '§5.7 Tab. 3', text_status: TEXT_STATUS.MD_INTEGRALE, ref: 'test' },
                message_it: 'Spessore massimo oltre la norma (§5.7 Tab. 3).',
            })]
            : []),
    }],
};

function useIsolatedPacks() {
    registry.clearRulePacks();
    for (const pack of DEFAULT_PACKS) registry.registerRulePack({ ...pack, rules: [] });
    registry.registerRulePack(TEST_PACK);
    registry.registerRulePack(TEST_PACK_9606_2);
}

const row = (id, org) => ({
    id,
    organization_id: org,
    person_name: `Persona ${id}`,
    certificate_number: `C-${id}`,
    qualification_type: 'Saldatore ISO 9606-1',
    standard_ref: 'ISO 9606-1:2017',
    joint_type: 'BW',
    status: 'valida',
});

function mockDb(rows) {
    query.mockImplementation(async (sqlText) => {
        if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sqlText)) {
            return { recordset: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS].map((COLUMN_NAME) => ({ COLUMN_NAME })) };
        }
        return { recordset: rows };
    });
}

beforeEach(() => {
    useIsolatedPacks();
    jest.clearAllMocks();
    query.mockReset();
    resetColumnsCache();
});

afterAll(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('voce verify_9606_1 nel servizio di rielaborazione', () => {
    it('la voce è registrata come kind:verify', () => {
        expect(getReprocessableField('verify_9606_1')).toMatchObject({ kind: 'verify', table: 'qualifications', verifyFamily: '9606-1' });
    });

    it('la voce verify_9606_2 è registrata come kind:verify sulla famiglia 9606-2', () => {
        expect(getReprocessableField('verify_9606_2')).toMatchObject({ kind: 'verify', table: 'qualifications', verifyFamily: '9606-2' });
    });

    it('verify_9606_2: sola lettura, valuta solo i record 9606-2 (i 9606-1 della stessa query sono scartati)', async () => {
        const row2 = (id, org) => ({
            ...row(id, org),
            qualification_type: 'Saldatore ISO 9606-2',
            standard_ref: 'EN ISO 9606-2:2004',
            thickness_t_test_mm: 4,
            thickness_min_mm: 2,
            thickness_max_mm: 12,
        });
        mockDb([row(1, 1001), row2(2, 1001), row2(3, 1002)]);
        const count = await countReprocessCandidates('verify_9606_2');
        expect(count.total).toBe(2);
        const other = await countReprocessCandidates('verify_9606_1');
        expect(other.total).toBe(0);
        const out = await runReprocessForField('verify_9606_2', { limit: 50 });
        expect(out).toMatchObject({ success: true, kind: 'verify', field: 'verify_9606_2', recordsChecked: 2 });
        expect(runDocumentIngest).not.toHaveBeenCalled();
        expect(createStagingRecord).not.toHaveBeenCalled();
        for (const [sqlText] of query.mock.calls) {
            expect(sqlText.trim()).toMatch(/^SELECT\b/i);
            expect(sqlText).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
        }
    });

    it('selectReprocessCandidates (backfill) rifiuta anche verify_9606_2', async () => {
        await expect(selectReprocessCandidates('verify_9606_2', getReprocessableField('verify_9606_2')))
            .rejects.toThrow(/non rielaborabile/);
        expect(query).not.toHaveBeenCalled();
    });

    it('countReprocessCandidates: ramo verify, forma { total, byOrganization }, solo SELECT', async () => {
        mockDb([row(1, 1001), row(2, 1002)]);
        const out = await countReprocessCandidates('verify_9606_1');
        expect(out).toEqual({ total: 0, byOrganization: [] });
        for (const [sqlText] of query.mock.calls) expect(sqlText.trim()).toMatch(/^SELECT\b/i);
    });

    it('countReprocessCandidates: non consulta ingest_staging né filtra su certificate_file_url (nessun PDF richiesto)', async () => {
        mockDb([row(1, 1001)]);
        await countReprocessCandidates('verify_9606_1', { orgId: 1001 });
        for (const [sqlText] of query.mock.calls) {
            expect(sqlText).not.toMatch(/ingest_staging|certificate_file_url/);
        }
    });

    it('runReprocessForField: report kind:verify; nessuna AI, nessun file, nessuna proposta, nessuna scrittura', async () => {
        mockDb([row(1, 1001), row(2, 1001)]);
        const out = await runReprocessForField('verify_9606_1', { limit: 50 });

        expect(out).toMatchObject({ success: true, kind: 'verify', field: 'verify_9606_1', recordsChecked: 2, items: [], hasMore: false });
        expect(runDocumentIngest).not.toHaveBeenCalled();
        expect(createStagingRecord).not.toHaveBeenCalled();
        expect(fs.existsSync).not.toHaveBeenCalled();
        expect(fs.readFileSync).not.toHaveBeenCalled();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        for (const [sqlText] of query.mock.calls) {
            expect(sqlText.trim()).toMatch(/^SELECT\b/i);
            expect(sqlText).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
        }
    });

    it('dryRun o limit infinito (CLI) non cambiano nulla: resta sola lettura', async () => {
        mockDb([row(1, 1001)]);
        const out = await runReprocessForField('verify_9606_1', { dryRun: false, limit: Infinity });
        expect(out.kind).toBe('verify');
        expect(createStagingRecord).not.toHaveBeenCalled();
    });

    it('selectReprocessCandidates (backfill) rifiuta le chiavi verify: nessuna whitelist di scrittura', async () => {
        await expect(selectReprocessCandidates('verify_9606_1', getReprocessableField('verify_9606_1')))
            .rejects.toThrow(/non rielaborabile/);
        expect(query).not.toHaveBeenCalled();
    });

    it('le voci backfill NON passano dal ramo verify (comportamento invariato)', async () => {
        query.mockResolvedValue({ recordset: [] });
        const out = await countReprocessCandidates('transfer_mode');
        expect(out).toEqual({ total: 0, byOrganization: [] });
        const sqlText = query.mock.calls[0][0];
        expect(sqlText).toMatch(/certificate_file_url IS NOT NULL/);
        expect(sqlText).toMatch(/transfer_mode IS NULL/);
    });
});
