/**
 * L1 — proposte citate CTX-3 (HITL, no overwrite silenzioso)
 */
'use strict';

const {
    buildPublicSourceUrl,
    buildCitedProposals,
    applySelectedProposals,
    mapCandidateToAnagrafica,
} = require('./aiContextEnrichment');

describe('aiContextEnrichment (CTX-3)', () => {
    it('buildPublicSourceUrl usa P.IVA quando presente', () => {
        const url = buildPublicSourceUrl({ vat_number: 'IT01548970357' });
        expect(url).toContain('registroimprese.it');
        expect(url).toContain('01548970357');
    });

    it('mapCandidateToAnagrafica include settore da ATECO', () => {
        expect(mapCandidateToAnagrafica({
            legal_name: 'TECNOVE S.P.A.',
            vat_number: '01548970357',
            street: 'VIA ROMA 1',
            cap: '42017',
            city: 'NOVELLARA',
            province: 'RE',
            ateco_primary_desc: 'Strutture metalliche',
        })).toEqual({
            name: 'TECNOVE S.P.A.',
            vat_number: '01548970357',
            address: 'VIA ROMA 1, 42017 NOVELLARA, RE',
            sector: 'Strutture metalliche',
        });
    });

    it('campo vuoto → proposta defaultSelected true; conflitto → false', () => {
        const { proposals, source_url } = buildCitedProposals(
            {
                name: 'Vecchio Nome',
                vat_number: '',
                address: '',
                sector: '',
            },
            {
                legal_name: 'TECNOVE S.P.A.',
                vat_number: '01548970357',
                city: 'NOVELLARA',
                sector: 'Saldatura',
                source: 'IT-advanced',
            }
        );
        expect(source_url).toContain('registroimprese.it');
        const byField = Object.fromEntries(proposals.map((p) => [p.field, p]));
        expect(byField.name.conflict).toBe(true);
        expect(byField.name.defaultSelected).toBe(false);
        expect(byField.name.source_url).toBeTruthy();
        expect(byField.vat_number.conflict).toBe(false);
        expect(byField.vat_number.defaultSelected).toBe(true);
        expect(byField.sector.proposed).toBe('Saldatura');
    });

    it('identici non compaiono nelle proposte', () => {
        const { proposals } = buildCitedProposals(
            { name: 'ACME', vat_number: '123', address: 'Via 1', sector: 'X' },
            { legal_name: 'ACME', vat_number: '123', address: 'Via 1', sector: 'X' }
        );
        expect(proposals).toEqual([]);
    });

    it('applySelectedProposals non tocca campi non selezionati (no overwrite silenzioso)', () => {
        const next = applySelectedProposals(
            { name: 'Vecchio', vat_number: '000', address: 'Qui', sector: 'A' },
            [
                { field: 'name', proposed: 'Nuovo' },
                { field: 'vat_number', proposed: '111' },
                { field: 'sector', proposed: 'B' },
            ],
            ['vat_number']
        );
        expect(next).toEqual({
            name: 'Vecchio',
            vat_number: '111',
            address: 'Qui',
            sector: 'A',
        });
    });
});
