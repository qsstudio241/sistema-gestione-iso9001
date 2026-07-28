/**
 * @jest-environment node
 *
 * Test L1 — reprocess-qualifications.js (backfill campi su qualifiche esistenti)
 * Copre solo la logica pura di selezione candidati e i path helper — nessuna
 * chiamata AI reale (runDocumentIngest è mockato, mai invocato da questi test).
 */
jest.mock('../src/config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
    closePool: jest.fn(),
}));

jest.mock('../src/services/documentIngestPipeline.service', () => ({
    runDocumentIngest: jest.fn(),
}));

jest.mock('../src/services/qualificationIngest.service', () => ({
    mapPipelineFieldsToReview: jest.fn(),
    REPROCESSABLE_FIELDS: {
        transfer_mode: { column: 'transfer_mode' },
        shielding_gas: { column: 'shielding_gas' },
        joint_type: { column: 'joint_type' },
        weld_details: { column: 'weld_details' },
    },
}));

jest.mock('../src/services/ingestStaging.service', () => ({
    createStagingRecord: jest.fn(),
}));

const { query } = require('../src/config/database');
const { runDocumentIngest } = require('../src/services/documentIngestPipeline.service');
const {
    selectReprocessCandidates,
    guessDocType,
    resolveCertificateFilePath,
    FIELD_CONFIGS,
} = require('./reprocess-qualifications');

describe('reprocess-qualifications — selezione candidati', () => {
    afterEach(() => jest.clearAllMocks());

    it('interroga transfer_mode IS NULL + status attivo + certificate_file_url presente', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        await selectReprocessCandidates('transfer_mode', FIELD_CONFIGS.transfer_mode);

        const sql = query.mock.calls[0][0];
        expect(sql).toMatch(/transfer_mode IS NULL/);
        expect(sql).toMatch(/status != 'revocata'/);
        expect(sql).toMatch(/certificate_file_url IS NOT NULL/);
        expect(sql).toMatch(/qualification_type LIKE @qualTypeLike/);
    });

    it('filtra in JS solo i processi a filo continuo pertinenti (131/135/136/138)', async () => {
        query.mockResolvedValueOnce({
            recordset: [
                { id: 1, welding_process: '135', qualification_type: 'Saldatore ISO 9606-1' },
                { id: 2, welding_process: '111', qualification_type: 'Saldatore ISO 9606-1' }, // MMA — non pertinente
                { id: 3, welding_process: '138', qualification_type: 'Saldatore ISO 9606-1' },
                { id: 4, welding_process: null, qualification_type: 'Saldatore ISO 9606-1' },
            ],
        });

        const candidates = await selectReprocessCandidates('transfer_mode', FIELD_CONFIGS.transfer_mode);

        expect(candidates.map((c) => c.id)).toEqual([1, 3]);
    });

    it('non filtra per processo quando processWhitelist è null (es. shielding_gas)', async () => {
        query.mockResolvedValueOnce({
            recordset: [
                { id: 1, welding_process: '111', qualification_type: 'Saldatore ISO 9606-1' },
                { id: 2, welding_process: '141', qualification_type: 'Saldatore ISO 9606-1' },
            ],
        });

        const candidates = await selectReprocessCandidates('shielding_gas', FIELD_CONFIGS.shielding_gas);

        expect(candidates).toHaveLength(2);
    });

    it('applica il filtro organization_id quando richiesto', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        await selectReprocessCandidates('transfer_mode', FIELD_CONFIGS.transfer_mode, { orgId: 1001 });

        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/organization_id = @orgId/);
        expect(params.orgId).toBe(1001);
    });

    it('rifiuta un campo non presente nella whitelist REPROCESSABLE_FIELDS', async () => {
        await expect(selectReprocessCandidates('password_hash', { qualTypeLike: '%9606%' }))
            .rejects.toThrow(/non rielaborabile/);
    });

    it('non chiama mai la pipeline AI durante la sola selezione (nessuna spesa se non ci sono candidati processabili)', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        await selectReprocessCandidates('transfer_mode', FIELD_CONFIGS.transfer_mode);
        expect(runDocumentIngest).not.toHaveBeenCalled();
    });
});

describe('reprocess-qualifications — helper', () => {
    it('guessDocType riconosce ISO 14732 dal testo qualification_type', () => {
        expect(guessDocType('Operatore ISO 14732')).toBe('qualifica_14732');
        expect(guessDocType('Saldatore ISO 9606-1')).toBe('patentino_saldatore');
        expect(guessDocType(null)).toBe('patentino_saldatore');
    });

    it('resolveCertificateFilePath normalizza il prefisso /uploads/', () => {
        const p = resolveCertificateFilePath('/uploads/qualifications/qual_1.pdf');
        expect(p.replace(/\\/g, '/')).toMatch(/uploads\/qualifications\/qual_1\.pdf$/);
    });
});
