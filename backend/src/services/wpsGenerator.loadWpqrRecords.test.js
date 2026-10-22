/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const { loadWpqrRecords, generateWpsFromWpqr } = require('./wpsGenerator.service');

describe('loadWpqrRecords — cestino', () => {
    beforeEach(() => {
        query.mockReset();
        query.mockResolvedValue({ recordset: [] });
    });

    it('esclude le WPQR nel cestino anche senza filtro azienda', async () => {
        await loadWpqrRecords(1001);
        expect(query).toHaveBeenCalledTimes(1);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/wq\.deleted_at IS NULL/);
        expect(params).toEqual({ organization_id: 1001 });
    });

    it('esclude le WPQR nel cestino anche con filtro azienda', async () => {
        await loadWpqrRecords(1001, 48);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/wq\.deleted_at IS NULL/);
        expect(sql).toMatch(/wq\.company_id = @company_id/);
        expect(sql).not.toMatch(/wq\.wps_id|w\.company_id/);
        expect(params).toEqual({ organization_id: 1001, company_id: 48 });
    });

    it('il suggerimento filtra solo company_id, senza la WPS', async () => {
        await loadWpqrRecords(1005, 49);
        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/wq\.company_id = @company_id/);
        expect(sql).not.toMatch(/JOIN welding_procedures|wq\.wps_id/);
    });

    it('generateWpsFromWpqr senza elenco iniettato non legge WPQR cestinate', async () => {
        await generateWpsFromWpqr({
            organizationId: 1001,
            companyId: 48,
            request: {
                joint_type: 'FW',
                welding_process: '135',
                parent_material_a: 'S355',
                parent_material_b: 'S235',
                thickness_a_mm: 10,
                thickness_b_mm: 5,
            },
        });
        expect(query).toHaveBeenCalled();
        const sql = query.mock.calls[0][0];
        expect(sql).toMatch(/wq\.deleted_at IS NULL/);
    });

    it('attacca le passate WPQR alle record caricate (range² I/U)', async () => {
        query.mockImplementation(async (sql) => {
            if (/FROM wpqr_test_runs/.test(sql)) {
                return { recordset: [{ wpqr_id: 7, current_a: 190, voltage_v: 24 }] };
            }
            return {
                recordset: [{
                    id: 7,
                    organization_id: 1001,
                    wpqr_code: 'WPQR-7',
                    welding_process: '135',
                    joint_type: 'FW',
                    base_material_group: '1.2',
                }],
            };
        });
        const rows = await loadWpqrRecords(1001);
        expect(rows[0].test_runs).toEqual([{ wpqr_id: 7, current_a: 190, voltage_v: 24 }]);
        const runsCall = query.mock.calls.find(([s]) => /FROM wpqr_test_runs/.test(s));
        expect(runsCall).toBeTruthy();
        expect(runsCall[0]).toMatch(/organization_id = @organization_id/);
        expect(runsCall[0]).toMatch(/deleted_at IS NULL/);
        expect(runsCall[0]).toMatch(/wpqr_id IN \(@wid0\)/);
        expect(runsCall[1]).toEqual({ organization_id: 1001, wid0: 7 });
    });

    it('generateWpsFromWpqr da DB usa le passate per current_range', async () => {
        query.mockImplementation(async (sql) => {
            if (/FROM wpqr_test_runs/.test(sql)) {
                return { recordset: [{ wpqr_id: 1, current_a: 190, voltage_v: 24 }] };
            }
            return {
                recordset: [{
                    id: 1,
                    wpqr_code: 'WPQR-MASON-DEMO',
                    welding_process: '135',
                    base_material_group: '1.2',
                    joint_type: 'FW',
                    thickness_tested: 10,
                    thickness_min: 3,
                    thickness_max: 20,
                    filler_material: 'G 42 4 M21 3Si1',
                    shielding_gas: 'M21',
                    welding_positions: 'PA',
                    standard_reference: 'ISO 15614-1',
                }],
            };
        });
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                joint_type: 'FW',
                welding_process: '135',
                parent_material_a: 'S355',
                parent_material_b: 'S235',
                thickness_a_mm: 10,
                thickness_b_mm: 5,
            },
        });
        expect(result.status).toMatch(/ok|partial/);
        expect(result.wps_draft.current_range).toMatch(/171/);
        expect(result.wps_draft.voltage_range).toMatch(/21\.6/);
        expect(result.wpqr_used.test_runs).toHaveLength(1);
    });
});
