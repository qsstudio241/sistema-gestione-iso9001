'use strict';

jest.mock('../../../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
}));

const adapter = require('./welder9606.adapter');

describe('welder9606.adapter match() — dominio 9606', () => {
    function makePool(rows) {
        const calls = [];
        const pool = {
            calls,
            request() {
                const inputs = {};
                const req = {
                    input(name, value) {
                        inputs[name] = value;
                        return req;
                    },
                    async query(sql) {
                        calls.push({ sql, inputs: { ...inputs } });
                        return { recordset: rows };
                    },
                };
                return req;
            },
        };
        return pool;
    }

    it('non include le qualifiche ISO 14732 nel dominio saldatori 9606', async () => {
        const pool = makePool([]);
        await adapter.match(
            { domain: 'welder_9606', criteria: { welding_process: '135' } },
            { organizationId: 5, pool, todayIso: '2026-10-18' }
        );
        expect(pool.calls).toHaveLength(1);
        expect(pool.calls[0].sql).toMatch(/qualification_type LIKE '%9606%'/);
        expect(pool.calls[0].sql).not.toMatch(/14732/);
    });
});
