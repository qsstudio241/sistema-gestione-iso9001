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
        expect(params).toEqual({ organization_id: 1001, company_id: 48 });
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
});
