/**
 * L1 — pesi completezza + sync anagrafica (ADR-018 S4)
 */
const {
    computeProfileCompleteness,
    completenessLevel,
    composeRegisteredAddress,
    parseSyncAnagrafica,
} = require('./companyProfileFields');

describe('computeProfileCompleteness', () => {
    it('0 se profilo vuoto', () => {
        expect(computeProfileCompleteness({})).toBe(0);
        expect(completenessLevel(0)).toBe('incompleto');
    });

    it('Identità A: 3 campi = 30', () => {
        expect(computeProfileCompleteness({
            vat_number: '01234567890',
            legal_name: 'Acme Srl',
            ateco_primary: '25.11.00',
        })).toBe(30);
    });

    it('Sede A: città + via = 15; solo città = 8', () => {
        expect(computeProfileCompleteness({
            registered_city: 'Modena',
            registered_street: 'Via Roma 1',
        })).toBe(15);
        expect(computeProfileCompleteness({
            registered_city: 'Modena',
        })).toBe(8);
        expect(computeProfileCompleteness(
            { registered_city: 'Modena' },
            { addressFallback: 'Via Roma 1, Modena' }
        )).toBe(15);
    });

    it('BIT true/false da SQL Server contano come compilati', () => {
        expect(computeProfileCompleteness({
            has_dvr: true,
            rspp_name: 'Mario Rossi',
            produces_waste: false,
            has_air_emissions: true,
        })).toBe(35);
    });

    it('BIT 0 conta come compilato (DVR assente)', () => {
        const score = computeProfileCompleteness({
            has_dvr: 0,
            rspp_name: 'Mario Rossi',
        });
        expect(score).toBe(15);
    });

    it('Ambiente: 2 flag = 20', () => {
        expect(computeProfileCompleteness({
            produces_waste: 1,
            has_air_emissions: 0,
        })).toBe(20);
    });

    it('soglie badge', () => {
        expect(completenessLevel(49)).toBe('incompleto');
        expect(completenessLevel(50)).toBe('parziale');
        expect(completenessLevel(79)).toBe('parziale');
        expect(completenessLevel(80)).toBe('pronto');
    });

    it('profilo pieno >= 80 (pronto)', () => {
        const score = computeProfileCompleteness({
            vat_number: '1',
            legal_name: 'A',
            ateco_primary: '25',
            registered_city: 'Modena',
            registered_street: 'Via 1',
            employees_count: 3,
            sites_count: 1,
            has_dvr: 1,
            rspp_name: 'RSPP',
            produces_waste: 1,
            has_water_discharge: 0,
        });
        expect(score).toBe(100);
        expect(completenessLevel(score)).toBe('pronto');
    });
});

describe('composeRegisteredAddress / parseSyncAnagrafica', () => {
    it('compone via + CAP comune (prov)', () => {
        expect(composeRegisteredAddress({
            registered_street: 'Via Roma 1',
            registered_cap: '41121',
            registered_city: 'Modena',
            registered_province: 'MO',
        })).toBe('Via Roma 1, 41121 Modena (MO)');
    });

    it('sync spento di default', () => {
        expect(parseSyncAnagrafica({})).toEqual({
            name: false, vat_number: false, address: false,
        });
        expect(parseSyncAnagrafica({
            sync_anagrafica: { name: true, vat_number: 0, address: 'si' },
        })).toEqual({ name: true, vat_number: false, address: true });
    });
});
