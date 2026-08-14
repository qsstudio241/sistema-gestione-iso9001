/**
 * L1 — OpenAPI Company lookup mapper (ADR-018 S5)
 */
const {
    normalizeVat,
    mapOpenapiCompanyToProfile,
    lookupCompanyByVat,
    pickAteco,
} = require('./openapiCompanyLookup.service');

describe('normalizeVat', () => {
    it('toglie IT e spazi', () => {
        expect(normalizeVat('IT 01548970357')).toBe('01548970357');
        expect(normalizeVat('01548970357')).toBe('01548970357');
        expect(normalizeVat('')).toBe(null);
    });
});

describe('pickAteco / mapOpenapiCompanyToProfile', () => {
    it('preferisce ateco corrente, poi 2022', () => {
        expect(pickAteco({
            ateco: { code: '25.11.00', description: 'Fabbricazione di strutture' },
            ateco2022: { code: '99', description: 'altro' },
        })).toEqual({
            ateco_primary: '25.11.00',
            ateco_primary_desc: 'Fabbricazione di strutture',
        });
    });

    it('mappa Advanced sui campi profilo', () => {
        const fields = mapOpenapiCompanyToProfile({
            success: true,
            data: {
                companyName: 'TECNOVE S.P.A.',
                vatCode: '01548970357',
                taxCode: '01548970357',
                activityStatus: 'ATTIVA',
                reaCode: '123456',
                cciaa: 'RE',
                pec: 'tecnove@pec.esempio.it',
                detailedLegalForm: { description: 'Societa per azioni' },
                atecoClassification: {
                    ateco: { code: '25.11.00', description: 'Strutture metalliche' },
                },
                address: {
                    registeredOffice: {
                        toponym: 'VIA',
                        street: 'ROMA',
                        streetNumber: '1',
                        zipCode: '42017',
                        town: 'Novellara',
                        province: 'RE',
                    },
                },
                balanceSheets: { last: { employees: 42, shareCapital: 100000 } },
            },
        });
        expect(fields.legal_name).toBe('TECNOVE S.P.A.');
        expect(fields.vat_number).toBe('01548970357');
        expect(fields.ateco_primary).toBe('25.11.00');
        expect(fields.ateco_primary_desc).toBe('Strutture metalliche');
        expect(fields.pec).toBe('tecnove@pec.esempio.it');
        expect(fields.registered_city).toBe('Novellara');
        expect(fields.registered_province).toBe('RE');
        expect(fields.registered_street).toBe('VIA ROMA 1');
        expect(fields.registered_cap).toBe('42017');
        expect(fields.employees_count).toBe(42);
        expect(fields.share_capital).toBe('100000');
        expect(fields.company_status).toBe('ATTIVA');
        expect(fields.legal_form).toBe('Societa per azioni');
    });
});

describe('lookupCompanyByVat', () => {
    it('503 se token assente', async () => {
        const prev = process.env.SGQ_OPENAPI_COMPANY_TOKEN;
        delete process.env.SGQ_OPENAPI_COMPANY_TOKEN;
        const r = await lookupCompanyByVat('01548970357', { token: null });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('LOOKUP_NOT_CONFIGURED');
        if (prev !== undefined) process.env.SGQ_OPENAPI_COMPANY_TOKEN = prev;
    });

    it('usa IT-advanced se risponde 200', async () => {
        const fetchFn = jest.fn(async (path) => {
            expect(path).toContain('/IT-advanced/01548970357');
            return {
                status: 200,
                json: {
                    data: {
                        companyName: 'Acme',
                        vatCode: '01548970357',
                        atecoClassification: { ateco: { code: '25.11.00', description: 'X' } },
                    },
                },
            };
        });
        const r = await lookupCompanyByVat('IT01548970357', { token: 't', fetchFn, baseUrl: 'https://example.test' });
        expect(r.ok).toBe(true);
        expect(r.endpoint).toBe('IT-advanced');
        expect(r.atecoFound).toBe(true);
        expect(r.fields.ateco_primary).toBe('25.11.00');
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('fallback IT-start se advanced 402', async () => {
        const fetchFn = jest.fn(async (path) => {
            if (path.includes('IT-advanced')) return { status: 402, json: {} };
            return {
                status: 200,
                json: { data: { companyName: 'Acme', vatCode: '01548970357', address: { registeredOffice: { town: 'Modena' } } } },
            };
        });
        const r = await lookupCompanyByVat('01548970357', { token: 't', fetchFn, baseUrl: 'https://example.test' });
        expect(r.ok).toBe(true);
        expect(r.endpoint).toBe('IT-start');
        expect(r.atecoFound).toBe(false);
        expect(r.warning).toBeTruthy();
        expect(r.fields.registered_city).toBe('Modena');
    });

    it('402 se advanced e start non coperti dal piano', async () => {
        const fetchFn = jest.fn(async (path) => {
            if (path.includes('IT-advanced')) return { status: 402, json: {} };
            return { status: 204, json: {} };
        });
        const r = await lookupCompanyByVat('01548970357', { token: 't', fetchFn, baseUrl: 'https://example.test' });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('LOOKUP_PAYMENT_REQUIRED');
    });

    it('accetta employees come stringa', () => {
        const fields = mapOpenapiCompanyToProfile({
            data: { companyName: 'A', balanceSheets: { last: { employees: '12' } } },
        });
        expect(fields.employees_count).toBe(12);
    });
});
