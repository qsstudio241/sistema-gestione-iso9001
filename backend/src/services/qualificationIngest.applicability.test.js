/**
 * @jest-environment node
 *
 * Test L1 — S2 applicabilità campi: al commit dell'ingest i campi N.A. della famiglia+edizione certa
 * (ISO 14732 Annex C) vanno a NULL; 9606-1 invariato. Fixture sintetiche, nessun dato reale.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({
        ok: true, personnelId: 55, personName: 'ROSSI MARIO',
    }),
}));
jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(() => ({ detected_type: 'qualifica_14732', confidence: 'low' })),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { getPool } = require('../config/database');
const { commitQualificationFromFields } = require('./qualificationIngest.service');

async function commit(fields, qualificationType) {
    const dupReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] }) };
    const insertReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 950 }] }) };
    let n = 0;
    getPool.mockResolvedValue({ request: jest.fn(() => { n += 1; return n === 1 ? dupReq : insertReq; }) });
    await commitQualificationFromFields(fields, 10, 20, { qualificationType });
    return Object.fromEntries(insertReq.input.mock.calls.map(([k, v]) => [k, v]));
}

const BASE_14732 = {
    operator_name: 'ROSSI MARIO',
    certificate_number: 'SINT-14732',
    welding_process: '121',
    welding_type: 'mechanized',
    welding_positions: ['PA', 'PB'],
    material_group: '1.1',
    joint_type: 'BW',
    product_type: 'T',
    filler_material_group: 'FM1',
    shielding_gas: 'M21',
    weld_details: 'ss nb',
    transfer_mode: 'spray_arc',
    thickness_min_mm: 3,
    thickness_max_mm: 20,
    thickness_max_unlimited: true,
    thickness_s_test_mm: 12,
    thickness_t_test_mm: 8,
    pipe_diameter_min_mm: 60,
    pipe_diameter_max_mm: 120,
    pipe_diameter_test_mm: 100,
    qualification_designation: 'riga stampata sintetica',
    welding_position_test: 'PA',
    welding_processes_validity: '121',
};

const NA_COLUMN_INPUTS = [
    'matGroup', 'jointType', 'productType', 'filler', 'shieldGas', 'weldDetails', 'transferMode',
    'thickMin', 'thickMax', 'thickSTest', 'thickTTest', 'pipeMin', 'pipeMax', 'pipeTest',
    'thickRange', 'pipeDiam', 'designation', 'posTest', 'weldProcValidity',
];

describe('commit ingest — applicabilità campi ISO 14732 (S2)', () => {
    it('14732:2025: tutti i campi N.A. a NULL (nessuna sentinella), posizione compresa; il resto invariato', async () => {
        const inputs = await commit({ ...BASE_14732, standard_reference: 'ISO 14732:2025' }, 'Operatore ISO 14732');
        for (const k of NA_COLUMN_INPUTS) expect(inputs[k]).toBeNull();
        expect(inputs.posRange).toBeNull();
        expect(inputs.thickMaxUnlimited).toBe(false);
        expect(Object.values(inputs)).not.toContain('NN');
        expect(inputs.weldProc).toBe('121');
        expect(inputs.certNum).toBe('SINT-14732');
        expect(inputs.weldingType).toBe('mechanized');
        expect(inputs.stdRef).toBe('ISO 14732:2025');
    });

    it('14732:2013: la posizione resta, gli altri campi N.A. vanno a NULL', async () => {
        const inputs = await commit({ ...BASE_14732, standard_reference: 'ISO 14732:2013' }, 'Operatore ISO 14732');
        expect(inputs.posRange).toBe('PA, PB');
        for (const k of NA_COLUMN_INPUTS) expect(inputs[k]).toBeNull();
    });

    it.each([[null], ['ISO 14732'], ['ISO 14732:2005']])('edizione ignota (%s): posizione conservata, solo N.A. in entrambe le edizioni a NULL', async (ref) => {
        const inputs = await commit({ ...BASE_14732, standard_reference: ref }, 'Operatore ISO 14732');
        expect(inputs.posRange).toBe('PA, PB');
        expect(inputs.matGroup).toBeNull();
        expect(inputs.thickMin).toBeNull();
    });

    it('tipo 14732 ma riferimento che cita solo ISO 9606-1: famiglia non certa, nessun azzeramento', async () => {
        const inputs = await commit({ ...BASE_14732, standard_reference: 'ISO 9606-1:2017' }, 'Operatore ISO 14732');
        expect(inputs.posRange).toBe('PA, PB');
        expect(inputs.matGroup).toBe('1.1');
        expect(inputs.thickMin).toBe(3);
    });

    it('9606-1 invariato: diametro/spessore/posizione/prodotto P come prima', async () => {
        const inputs = await commit({
            welder_name: 'ROSSI MARIO',
            certificate_number: 'SINT-9606',
            standard_reference: 'ISO 9606-1:2017',
            welding_process: '135',
            product_type: 'P',
            joint_type: 'BW',
            filler_material_group: 'FM1',
            material_group: '1.1',
            welding_positions: ['PA'],
            thickness_min_mm: 3,
            thickness_max_mm: 20,
            thickness_s_test_mm: 12,
            pipe_diameter_min_mm: 60,
            pipe_diameter_max_mm: 120,
            shielding_gas: 'M21',
        }, 'Saldatore ISO 9606-1');
        expect(inputs.posRange).toBe('PA');
        expect(inputs.matGroup).toBe('1.1');
        expect(inputs.jointType).toBe('BW');
        expect(inputs.productType).toBe('P');
        expect(inputs.filler).toBe('FM1');
        expect(inputs.shieldGas).toBe('M21');
        expect(inputs.thickMin).toBe(3);
        expect(inputs.thickMax).toBe(20);
        expect(inputs.thickSTest).toBe(12);
        expect(inputs.pipeMin).toBe(60);
        expect(inputs.pipeMax).toBe(120);
        expect(inputs.designation).toEqual(expect.stringContaining('135'));
    });
});
