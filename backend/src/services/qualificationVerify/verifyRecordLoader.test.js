jest.mock('../../config/database', () => ({ query: jest.fn() }));

const { query } = require('../../config/database');
const {
    CORE_COLUMNS,
    OPTIONAL_COLUMNS,
    DEFAULT_MAX_ROWS,
    COLUMNS_CACHE_TTL_MS,
    getQualificationColumns,
    loadQualificationsForVerify,
    resetColumnsCache,
} = require('./verifyRecordLoader');
const { toRecordView } = require('./qualificationRecordView');

const COLUMNS_168 = [
    'welding_process_test', 'welding_processes_validity', 'welding_position_test',
    'thickness_s_test_mm', 'thickness_t_test_mm', 'pipe_diameter_test_mm',
];

const schemaRows = (names) => ({ recordset: names.map((COLUMN_NAME) => ({ COLUMN_NAME })) });

/** Simula INFORMATION_SCHEMA + SELECT; restituisce le chiamate registrate. */
function mockDb({ columns, rows = [] }) {
    query.mockImplementation(async (sqlText) => {
        if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sqlText)) return schemaRows(columns);
        return { recordset: rows };
    });
}

const selectCalls = () => query.mock.calls.filter(([sqlText]) => !/INFORMATION_SCHEMA/i.test(sqlText));

beforeEach(() => {
    query.mockReset();
    resetColumnsCache();
});

describe('verifyRecordLoader — colonne tolleranti (migrazione 168 non assunta)', () => {
    test('con colonne 168 presenti le include nella SELECT, nessuna colonna segnalata come mancante', async () => {
        mockDb({ columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS] });
        const { missingColumns } = await loadQualificationsForVerify({ qualTypeLike: '%9606%' });
        const [sqlText] = selectCalls()[0];
        for (const c of COLUMNS_168) expect(sqlText).toContain(c);
        expect(sqlText).toContain('thickness_range');
        expect(missingColumns).toEqual([]);
    });

    test('senza colonne 168 la SELECT non le nomina (nessun errore SQL) e le segnala in missingColumns', async () => {
        mockDb({
            columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS.filter((c) => !COLUMNS_168.includes(c))],
            rows: [{ id: 1, organization_id: 1001, person_name: 'Mario Rossi', qualification_type: 'Saldatore ISO 9606-1', status: 'valida' }],
        });
        const out = await loadQualificationsForVerify({ qualTypeLike: '%9606%' });
        const [sqlText] = selectCalls()[0];
        for (const c of COLUMNS_168) expect(sqlText).not.toContain(c);
        expect(out.missingColumns.sort()).toEqual([...COLUMNS_168].sort());
        expect(out.rows).toHaveLength(1);
    });

    test('una riga senza colonne di prova produce vista con prova null (=> dato mancante, non errore)', async () => {
        const row = { id: 1, organization_id: 1001, person_name: 'Mario', qualification_type: 'Saldatore ISO 9606-1', status: 'valida', joint_type: 'BW' };
        const view = toRecordView(row, { source: 'db' });
        expect(view.thickness_s_test_mm).toBeNull();
        expect(view.welding_process_test).toBeNull();
        expect(view.pipe_diameter_test_mm).toBeNull();
    });

    test('colonne di base assenti => errore esplicito (tabella non riconosciuta)', async () => {
        mockDb({ columns: ['id', 'organization_id'] });
        await expect(loadQualificationsForVerify()).rejects.toThrow(/Colonne di base assenti/);
    });

    test('INFORMATION_SCHEMA vuoto => errore, e l\'esito non viene messo in cache', async () => {
        mockDb({ columns: [] });
        await expect(getQualificationColumns()).rejects.toThrow(/non leggibile/);
        mockDb({ columns: [...CORE_COLUMNS] });
        await expect(getQualificationColumns()).resolves.toBeInstanceOf(Set);
    });

    test('errore di lettura dello schema: propagato, non messo in cache', async () => {
        query.mockRejectedValueOnce(new Error('timeout'));
        await expect(getQualificationColumns()).rejects.toThrow('timeout');
        mockDb({ columns: [...CORE_COLUMNS] });
        await expect(getQualificationColumns()).resolves.toBeInstanceOf(Set);
    });

    test('le colonne sono lette una volta (cache di processo) e rilette dopo la scadenza', async () => {
        mockDb({ columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS] });
        await loadQualificationsForVerify();
        await loadQualificationsForVerify();
        const schemaCalls = () => query.mock.calls.filter(([s]) => /INFORMATION_SCHEMA/i.test(s)).length;
        expect(schemaCalls()).toBe(1);
        await getQualificationColumns({ now: Date.now() + COLUMNS_CACHE_TTL_MS + 1 });
        expect(schemaCalls()).toBe(2);
    });

    test('il confronto dei nomi colonna è case-insensitive', async () => {
        mockDb({ columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS].map((c) => c.toUpperCase()) });
        const { missingColumns } = await loadQualificationsForVerify();
        expect(missingColumns).toEqual([]);
    });
});

describe('verifyRecordLoader — filtri multi-tenant e sola lettura', () => {
    beforeEach(() => mockDb({ columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS] }));

    test('esclude i revocati, filtra per tipo e per organization_id con parametri bind', async () => {
        await loadQualificationsForVerify({ qualTypeLike: '%9606%', orgId: 1001 });
        const [sqlText, params] = selectCalls()[0];
        expect(sqlText).toMatch(/status != 'revocata'/);
        expect(sqlText).toMatch(/qualification_type LIKE @qualTypeLike/);
        expect(sqlText).toMatch(/organization_id = @orgId/);
        expect(params).toEqual({ qualTypeLike: '%9606%', orgId: 1001 });
    });

    test('senza orgId resta cross-tenant (come le altre voci superadmin) e non filtra per organizzazione', async () => {
        await loadQualificationsForVerify({ qualTypeLike: '%9606%' });
        const [sqlText, params] = selectCalls()[0];
        expect(sqlText).not.toMatch(/organization_id = @orgId/);
        expect(params).toEqual({ qualTypeLike: '%9606%' });
    });

    test('non seleziona certificate_file_url (nessun accesso ai PDF)', async () => {
        await loadQualificationsForVerify();
        expect(selectCalls()[0][0]).not.toMatch(/certificate_file_url|certificate_original_url/);
    });

    test('tetto di sicurezza: troncamento segnalato, righe in eccesso scartate', async () => {
        const rows = Array.from({ length: 4 }, (_, i) => ({ id: i + 1 }));
        mockDb({ columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS], rows });
        const out = await loadQualificationsForVerify({ maxRows: 3 });
        expect(out.rows).toHaveLength(3);
        expect(out.truncated).toBe(true);
        expect(selectCalls()[0][0]).toMatch(/SELECT TOP 4 /);
    });

    test('senza troncamento truncated = false', async () => {
        mockDb({ columns: [...CORE_COLUMNS, ...OPTIONAL_COLUMNS], rows: [{ id: 1 }] });
        const out = await loadQualificationsForVerify();
        expect(out.truncated).toBe(false);
        expect(DEFAULT_MAX_ROWS).toBeGreaterThan(1000);
    });

    test('ogni statement emesso è una SELECT', async () => {
        await loadQualificationsForVerify({ qualTypeLike: '%9606%', orgId: 1 });
        for (const [sqlText] of query.mock.calls) expect(sqlText.trim()).toMatch(/^SELECT\b/i);
    });
});

describe('verifyRecordLoader — copertura delle colonne lette dalla vista', () => {
    test('una riga con tutte le colonne del loader popola i campi DB della vista', () => {
        const row = {};
        for (const c of [...CORE_COLUMNS, ...OPTIONAL_COLUMNS]) row[c] = 1;
        Object.assign(row, {
            standard_ref: 'ISO 9606-1:2017', qualification_type: 'Saldatore ISO 9606-1', position_range: 'PA PB',
            joint_type: 'BW', product_type: 'P', issue_date: '2024-01-01', exam_date: '2024-01-01',
            expiry_date: '2026-01-01', last_confirmation_date: '2025-01-01', next_confirmation_due: '2025-07-01',
            revalidation_date: '2026-01-01', certificate_number: 'C1', welding_process: '135',
            welding_process_test: '135', welding_processes_validity: '135', welding_position_test: 'PA',
            material_group: '1.1', filler_material: 'FM1', shielding_gas: 'M21', weld_details: 'ss nb',
            transfer_mode: 'spray', qualification_designation: 'EN ISO 9606-1 135 P BW', issuing_body: 'IIS',
            examiner_body: 'IIS',
        });
        const view = toRecordView(row, { source: 'db' });
        const keys = [
            'certificate_number', 'welding_process', 'welding_process_test', 'welding_processes_validity',
            'welding_position_test', 'material_group', 'shielding_gas', 'weld_details', 'transfer_mode',
            'qualification_designation', 'examiner_body', 'thickness_min_mm', 'thickness_max_mm',
            'thickness_s_test_mm', 'thickness_t_test_mm', 'pipe_diameter_min_mm', 'pipe_diameter_max_mm',
            'pipe_diameter_test_mm', 'issue_date', 'expiry_date', 'last_confirmation_date',
            'next_confirmation_due', 'revalidation_date', 'standard_reference', 'filler_material_group',
            'issuing_body', 'exam_date', 'joint_type', 'product_type',
        ];
        const empty = keys.filter((k) => view[k] == null || view[k] === '');
        expect(empty).toEqual([]);
        expect(view.positions.length).toBeGreaterThan(0);
        expect(view.thickness_max_unlimited).toBe(true);
    });
});
