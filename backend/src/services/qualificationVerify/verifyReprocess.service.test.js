jest.mock('../../config/database', () => ({ query: jest.fn() }));
jest.mock('./registerDefaultPacks', () => ({ ensureDefaultPacks: () => {} }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const { query } = require('../../config/database');
const registry = require('./verifyRegistry');
const { ensureDefaultPacks, DEFAULT_PACKS } = require('./registerDefaultPacks');
const { FAMILY, SEVERITY, STATUS, DIRECTION, TEXT_STATUS, makeFinding, validateFinding } = require('./findingTypes');
const { OPTIONAL_COLUMNS, CORE_COLUMNS, resetColumnsCache } = require('./verifyRecordLoader');
const {
    VERIFY_ITEMS_LIMIT,
    VERIFY_ITEMS_MAX,
    scanVerifyRecords,
    countVerifyCandidates,
    runVerifyReport,
} = require('./verifyReprocess.service');

const COLUMNS_168 = [
    'welding_process_test', 'welding_processes_validity', 'welding_position_test',
    'thickness_s_test_mm', 'thickness_t_test_mm', 'pipe_diameter_test_mm',
];

const FIELD = {
    key: 'verify_9606_1',
    kind: 'verify',
    qualTypeLike: '%9606%',
    verifyFamily: '9606-1',
};

/**
 * Pack di prova (solo per questo file): su 9606-1 BW
 * - spessore massimo dichiarato > 12 mm => warn verificabile (over_claim);
 * - spessore di prova assente => info non verificabile (dato mancante).
 */
const TEST_CODES = ['QVTEST.CORR.THK_MAX', 'QVTEST.CORR.THK_TEST_MISSING'];
const TEST_PACK = {
    id: 'vq8.test.pack',
    standardFamily: '9606-1',
    editions: ['2017'],
    profiles: ['9606-1:BW'],
    rules: [
        {
            id: 'vq8.test.thkMax',
            family: FAMILY.CORRETTEZZA,
            codes: [TEST_CODES[0]],
            run: (view) => (view.thickness_max_mm != null && view.thickness_max_mm > 12
                ? [makeFinding({
                    code: TEST_CODES[0],
                    family: FAMILY.CORRETTEZZA,
                    severity: SEVERITY.WARN,
                    status: STATUS.VERIFICABILE,
                    field: 'thickness_max_mm',
                    direction: DIRECTION.OVER_CLAIM,
                    read_value: view.thickness_max_mm,
                    expected_value: 12,
                    source: { norm: 'ISO 9606-1', edition: '2017', clause: '§5.7 Tab. 6', text_status: TEXT_STATUS.MD_INTEGRALE, ref: 'test' },
                    message_it: 'Spessore massimo oltre la norma (§5.7 Tab. 6).',
                })]
                : []),
        },
        {
            id: 'vq8.test.thkTestMissing',
            family: FAMILY.CORRETTEZZA,
            codes: [TEST_CODES[1]],
            run: (view) => (view.thickness_s_test_mm == null
                ? [makeFinding({
                    code: TEST_CODES[1],
                    family: FAMILY.CORRETTEZZA,
                    severity: SEVERITY.INFO,
                    status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
                    field: 'thickness_s_test_mm',
                    message_it: 'Spessore di prova non presente: ricalcolo non eseguibile.',
                })]
                : []),
        },
    ],
};

/**
 * Isolamento dai pack reali: i pack di default entrano con `rules: []` (stesso id, quindi
 * `ensureDefaultPacks()` dell'engine non li sostituisce) e il solo pack di prova produce finding.
 * I conteggi del test non dipendono dal contenuto di completezza/correttezza 9606-x.
 */
function useIsolatedPacks() {
    registry.clearRulePacks();
    for (const pack of DEFAULT_PACKS) registry.registerRulePack({ ...pack, rules: [] });
    registry.registerRulePack(TEST_PACK);
}

const rec = (id, org, over = {}) => ({
    id,
    organization_id: org,
    person_name: `Persona ${id}`,
    certificate_number: `C-${id}`,
    qualification_type: 'Saldatore ISO 9606-1',
    standard_ref: 'ISO 9606-1:2017',
    joint_type: 'BW',
    status: 'valida',
    thickness_max_mm: 10,
    ...over,
});

function mockDb({ rows, columns = [...CORE_COLUMNS, ...OPTIONAL_COLUMNS] }) {
    query.mockImplementation(async (sqlText) => {
        if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sqlText)) {
            return { recordset: columns.map((COLUMN_NAME) => ({ COLUMN_NAME })) };
        }
        return { recordset: rows };
    });
}

beforeEach(() => {
    useIsolatedPacks();
    query.mockReset();
    resetColumnsCache();
});

afterAll(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('scanVerifyRecords / countVerifyCandidates', () => {
    test('candidato = almeno un warn verificabile; info e non verificabili non sono candidati ma sono contati', async () => {
        mockDb({
            rows: [
                rec(1, 1001, { thickness_max_mm: 20, thickness_s_test_mm: 8 }),
                rec(2, 1001, { thickness_max_mm: 10, thickness_s_test_mm: 8 }),
                rec(3, 1002, { thickness_max_mm: 10 }),
                rec(4, 1002, { thickness_max_mm: 30 }),
            ],
        });
        const scan = await scanVerifyRecords(FIELD);
        expect(scan.recordsChecked).toBe(4);
        expect(scan.candidates.map((c) => c.row.id)).toEqual([1, 4]);
        expect(scan.findingsByCode).toEqual({ [TEST_CODES[0]]: 2 });
        expect(scan.notVerifiable).toEqual({ dato_mancante: 2, fonte_mancante: 0 });

        const counted = await countVerifyCandidates(FIELD);
        expect(counted.total).toBe(2);
        expect(counted.byOrganization).toEqual([
            { organization_id: 1001, count: 1 },
            { organization_id: 1002, count: 1 },
        ]);
    });

    test('record di altre norme (EN 287-1, 9606-2) non sono nella famiglia: non controllati, non candidati', async () => {
        mockDb({
            rows: [
                rec(1, 1001, { standard_ref: 'EN 287-1:2011', qualification_type: 'Saldatore ISO 9606', thickness_max_mm: 40 }),
                rec(2, 1001, { standard_ref: 'ISO 9606-2:2004', qualification_type: 'Saldatore ISO 9606-2', thickness_max_mm: 40 }),
                rec(3, 1001, { thickness_max_mm: 40 }),
            ],
        });
        const scan = await scanVerifyRecords(FIELD);
        expect(scan.recordsChecked).toBe(1);
        expect(scan.candidates.map((c) => c.row.id)).toEqual([3]);
    });

    test('DB senza colonne 168: nessun errore SQL, ricalcoli non verificabili per dato mancante', async () => {
        mockDb({
            columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS.filter((c) => !COLUMNS_168.includes(c))],
            rows: [rec(1, 1001), rec(2, 1001)],
        });
        const report = await runVerifyReport(FIELD);
        expect(report.recordsChecked).toBe(2);
        expect(report.recordsWithWarnings).toBe(0);
        expect(report.notVerifiable.dato_mancante).toBe(2);
        expect(report.missingColumns.sort()).toEqual([...COLUMNS_168].sort());
    });

    test('voce non verify => errore (il ramo non gestisce i backfill)', async () => {
        await expect(scanVerifyRecords({ key: 'transfer_mode', table: 'qualifications' })).rejects.toThrow(/non di tipo verify/);
        await expect(scanVerifyRecords(null)).rejects.toThrow(/non di tipo verify/);
    });

    test('filtro multi-tenant: orgId passato alla SELECT', async () => {
        mockDb({ rows: [] });
        await countVerifyCandidates(FIELD, { orgId: 1001 });
        const select = query.mock.calls.find(([s]) => !/INFORMATION_SCHEMA/i.test(s));
        expect(select[1]).toEqual({ qualTypeLike: '%9606%', orgId: 1001 });
    });
});

describe('runVerifyReport — contratto della risposta', () => {
    test('forma attesa dal frontend (BillingDashboardPage) e finding validi', async () => {
        mockDb({ rows: [rec(1, 1001, { thickness_max_mm: 20 }), rec(2, 1001, { thickness_max_mm: 5, thickness_s_test_mm: 3 })] });
        const report = await runVerifyReport(FIELD);

        expect(Object.keys(report).sort()).toEqual([
            'field', 'findingsByCode', 'hasMore', 'items', 'kind', 'missingColumns', 'notVerifiable',
            'recordsChecked', 'recordsWithWarnings', 'success',
        ]);
        expect(report).toMatchObject({
            success: true,
            kind: 'verify',
            field: 'verify_9606_1',
            recordsChecked: 2,
            recordsWithWarnings: 1,
            findingsByCode: { [TEST_CODES[0]]: 1 },
            notVerifiable: { dato_mancante: 1, fonte_mancante: 0 },
            hasMore: false,
        });
        expect(report.items).toHaveLength(1);
        const [item] = report.items;
        expect(Object.keys(item).sort()).toEqual(['certificate_number', 'findings', 'id', 'organization_id', 'person_name']);
        expect(item).toMatchObject({ id: 1, organization_id: 1001, person_name: 'Persona 1', certificate_number: 'C-1' });
        expect(item.findings).toHaveLength(1);
        const [f] = item.findings;
        expect(f).toMatchObject({ code: TEST_CODES[0], severity: 'warn', status: 'verificabile', read_value: 20, expected_value: 12 });
        expect(f.source.clause).toBe('§5.7 Tab. 6');
        expect(f.message_it).toEqual(expect.any(String));
        expect(validateFinding(f).ok).toBe(true);
    });

    test('items contengono solo i warn: gli info non entrano nella tabella del report', async () => {
        mockDb({ rows: [rec(1, 1001, { thickness_max_mm: 20 })] });
        const { items } = await runVerifyReport(FIELD);
        expect(items[0].findings.every((f) => f.severity === 'warn')).toBe(true);
    });

    test('tetto items: hasMore = true oltre il limite, ma i contatori restano completi', async () => {
        const rows = Array.from({ length: 5 }, (_, i) => rec(i + 1, 1001, { thickness_max_mm: 20 }));
        mockDb({ rows });
        const report = await runVerifyReport(FIELD, { limit: 2 });
        expect(report.items).toHaveLength(2);
        expect(report.recordsWithWarnings).toBe(5);
        expect(report.findingsByCode[TEST_CODES[0]]).toBe(5);
        expect(report.hasMore).toBe(true);
    });

    test('limite di default = tetto di righe del run', async () => {
        expect(VERIFY_ITEMS_LIMIT).toBe(100);
        const rows = Array.from({ length: 101 }, (_, i) => rec(i + 1, 1001, { thickness_max_mm: 20 }));
        mockDb({ rows });
        const report = await runVerifyReport(FIELD, { limit: Infinity });
        expect(report.items).toHaveLength(100);
        expect(report.hasMore).toBe(true);
    });

    test('limite esplicito oltre il massimo => ridotto a VERIFY_ITEMS_MAX', async () => {
        const rows = Array.from({ length: VERIFY_ITEMS_MAX + 1 }, (_, i) => rec(i + 1, 1001, { thickness_max_mm: 20 }));
        mockDb({ rows });
        const report = await runVerifyReport(FIELD, { limit: 99999 });
        expect(report.items).toHaveLength(VERIFY_ITEMS_MAX);
        expect(report.hasMore).toBe(true);
    });

    test('lettura troncata dal tetto di sicurezza => hasMore anche senza eccedenza di items', async () => {
        const rows = Array.from({ length: 5001 }, (_, i) => ({ id: i + 1, organization_id: 1, person_name: 'x', qualification_type: 'Saldatore ISO 9606-1', standard_ref: 'ISO 9606-1:2017', joint_type: 'BW', status: 'valida' }));
        mockDb({ rows });
        const report = await runVerifyReport(FIELD);
        expect(report.recordsWithWarnings).toBe(0);
        expect(report.hasMore).toBe(true);
    });

    test('rieseguire la verifica non cambia l\'esito (non è un backlog che scende)', async () => {
        mockDb({ rows: [rec(1, 1001, { thickness_max_mm: 20 })] });
        const first = await runVerifyReport(FIELD);
        const second = await runVerifyReport(FIELD);
        expect(second).toEqual(first);
        expect((await countVerifyCandidates(FIELD)).total).toBe(1);
    });

    test('solo SELECT verso il DB', async () => {
        mockDb({ rows: [rec(1, 1001, { thickness_max_mm: 20 })] });
        await runVerifyReport(FIELD, { orgId: 1001 });
        await countVerifyCandidates(FIELD);
        for (const [sqlText] of query.mock.calls) expect(sqlText.trim()).toMatch(/^SELECT\b/i);
    });
});
