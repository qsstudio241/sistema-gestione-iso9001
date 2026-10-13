'use strict';

const {
    extractSupportingWpqrRefs,
    splitRefList,
    normalizeWpqrRef,
    normalizeWpsRef,
} = require('./wpqrSupportRefs');
const { extractFieldsByRules } = require('./ruleFieldExtractors');

// Testi sintetici (nessun dato reale): stesso ordine di lettura del layout IIS, con la data tra etichetta e numero.
const WPS_PAGE = `
EN ISO 15609 - 1 MANUFACTURER'S WELDING
WPS-n./WPS n.
ZZ 01/99 PROCEDURE SPECIFICATION
Supporting WPQR n./ WPQR di supporto n.

10/08/2023 XX0001/99

Manufacturer/Costruttore ZZ SPA - VIA PROVA, 1
Welding process(es)/Processo di saldatura a) 138-S
`;

describe('extractSupportingWpqrRefs', () => {
    it('layout bilingue con la data in mezzo: restituisce il numero e non la data', () => {
        expect(extractSupportingWpqrRefs(WPS_PAGE)).toEqual(['XX0001/99']);
    });

    it('etichetta italiana con più numeri', () => {
        expect(extractSupportingWpqrRefs('WPQR di supporto n.: XX0001/99, YY0202-98 e 24-03390-01'))
            .toEqual(['XX0001/99', 'YY0202-98', '24-03390-01']);
    });

    it('solo etichetta e data, senza numero: nessun riferimento (la data non è un numero)', () => {
        expect(extractSupportingWpqrRefs('Supporting WPQR n./ WPQR di supporto n.\n10/08/2023\nManufacturer')).toEqual([]);
    });

    it('nota «supported by ... related to the WPQR n.» di una WPQR', () => {
        const note = 'This WPQR is supported by NDT and mechanical tests related to the WPQR n. XX0001/99 heading';
        expect(extractSupportingWpqrRefs(note)).toEqual(['XX0001/99']);
    });

    it('esclude il numero del documento stesso (maiuscole/minuscole e «-» vs «/» indifferenti)', () => {
        expect(extractSupportingWpqrRefs(WPS_PAGE, { ownNumber: 'xx0001-99' })).toEqual([]);
        expect(extractSupportingWpqrRefs(WPS_PAGE, { ownNumber: 'ALTRO/12' })).toEqual(['XX0001/99']);
    });

    it('duplicati ripetuti (la pagina WPS compare due volte) → un solo riferimento', () => {
        expect(extractSupportingWpqrRefs(`${WPS_PAGE}\n${WPS_PAGE}`)).toEqual(['XX0001/99']);
    });

    it('un testo senza etichetta non produce riferimenti, nemmeno se contiene numeri simili', () => {
        expect(extractSupportingWpqrRefs('Certificate No. XX0001/99 rev.0 WPS No. ZZ 01/99 rev. 0')).toEqual([]);
        expect(extractSupportingWpqrRefs('')).toEqual([]);
        expect(extractSupportingWpqrRefs(null)).toEqual([]);
    });
});

describe('normalizzazione e liste', () => {
    it('normalizeWpqrRef: maiuscolo, senza spazi, «-» ≡ «/», senza rev', () => {
        expect(normalizeWpqrRef(' xx0001-99 rev.0')).toBe('XX0001/99');
        expect(normalizeWpqrRef('XX0001/99')).toBe('XX0001/99');
        expect(normalizeWpqrRef(null)).toBe('');
        expect(normalizeWpqrRef({})).toBe('');
    });

    it('normalizeWpsRef ignora il suffisso di revisione', () => {
        expect(normalizeWpsRef('ZZ 01/99 rev. 0')).toBe(normalizeWpsRef('zz 01/99'));
        expect(normalizeWpsRef('ZZ 01/99')).not.toBe(normalizeWpsRef('ZZ 02/99'));
    });

    it('splitRefList: separa, deduplica e ignora il testo non numerico', () => {
        expect(splitRefList('XX0001/99; xx0001-99, YY0202/98')).toEqual(['XX0001/99', 'YY0202/98']);
        expect(splitRefList('nessuno')).toEqual([]);
        expect(splitRefList(null)).toEqual([]);
        expect(splitRefList(['AA0001/20', 'BB0002/21'])).toEqual(['AA0001/20', 'BB0002/21']);
    });
});

describe('estrattori a regole', () => {
    it('WPS: wpqr_ref prende la WPQR di supporto, non il numero della WPS', () => {
        const fields = extractFieldsByRules(WPS_PAGE, 'wps', 'x.pdf');
        expect(fields.wpqr_ref).toBe('XX0001/99');
    });

    it('WPS: mantiene il vecchio formato «WPQR 24-03390» quando non c\'è l\'etichetta di supporto', () => {
        const fields = extractFieldsByRules('WPS 12/25 processo 135 riferimento WPQR 24-03390 preheat', 'wps', 'x.pdf');
        expect(fields.wpqr_ref).toBe('24-03390');
    });

    it('WPQR: supporting_wpqr_refs dalla pagina WPS incorporata', () => {
        const text = `WELDING PROCEDURE QUALIFICATION RECORD (WPQR)\n${WPS_PAGE}\nTEST RESULTS tensile bending`;
        const fields = extractFieldsByRules(text, 'wpqr', 'x.pdf');
        expect(fields.supporting_wpqr_refs).toBe('XX0001/99');
    });
});
