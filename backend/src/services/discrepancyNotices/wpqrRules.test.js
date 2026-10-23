'use strict';

const {
    evaluateWpqrNotices, CODES,
} = require('./wpqrRules');
const {
    countsAsVerifiedConformity, effectiveApprovalStatus, applyResolution, STATUS,
} = require('./status');
const { registerDiscrepancyDomain, listDiscrepancyDomains, evaluateDiscrepancy } = require('./index');

function base(over = {}) {
    return {
        wpqr_code: '16VE01735PO2/A',
        certificate_number: '16VE01735PO2/A',
        examiner_body: 'RINA',
        welding_process: '135',
        standard_reference: 'UNI EN ISO 15614-1:2017',
        joint_type: 'BW',
        base_material_group: '1.2',
        filler_material: 'ISO 14341-A',
        ...over,
    };
}

function byCode(record, code, context) {
    return evaluateWpqrNotices(record, context).find((n) => n.code === code) || null;
}

describe('avvisi di discrepanza WPQR', () => {
    test('1. codice con zero e certificato con la lettera O, testo con i valori del record', () => {
        const rec = base({
            wpqr_code: '16VE01735P02/A',
            certificate_number: '16VE01735PO2/A',
            examiner_body: 'RINA',
        });
        const n = byCode(rec, CODES.CODE_CERT);
        expect(n).toBeTruthy();
        expect(n.message_it).toBe(
            '⚠️ Il numero del certificato non coincide con il codice WPQR. Sul certificato RINA c\'è la lettera O (16VE01735PO2/A), nel codice c\'è lo zero (16VE01735P02/A). Controlla sul PDF.',
        );
    });

    test('1b. il testo usa i valori reali, non solo l\'esempio RINA', () => {
        const n = byCode(base({
            wpqr_code: 'ZZ-000',
            certificate_number: 'ZZ-OOO',
            examiner_body: 'TÜV',
        }), CODES.CODE_CERT);
        expect(n.message_it).toContain('TÜV');
        expect(n.message_it).toContain('ZZ-OOO');
        expect(n.message_it).toContain('ZZ-000');
        expect(n.message_it).not.toContain('16VE01735');
    });

    test('2. materiale d\'apporto diverso tra copertina e pagine interne', () => {
        const n = byCode(base({ filler_material: 'ISO 14343-A' }), CODES.FILLER, {
            runs: [{ filler_designation: 'ISO 14341-A' }],
        });
        expect(n).toBeTruthy();
        expect(n.message_it).toContain('14343-A');
        expect(n.message_it).toContain('14341-A');
        expect(n.message_it).toContain('copertina');
    });

    test('3. gruppo del saggio 1.2 incoerente con validità 1-1', () => {
        const n = byCode(base({
            base_material_group: '1.2',
            material_group_range: '1-1',
        }), CODES.MATERIAL);
        expect(n).toBeTruthy();
        expect(n.message_it).toContain('1.2');
        expect(n.message_it).toContain('1-1');
        expect(n.message_it).toContain('non è coerente');
    });

    test('3b. saggio 1.2 dentro il range 1.1-1.2 non è un avviso', () => {
        expect(byCode(base({ material_group_range: '1.1-1.2' }), CODES.MATERIAL)).toBeNull();
    });

    test('4. campo di validità incompleto: manca il range d\'angolo 6-24 mm', () => {
        const n = byCode(base({
            joint_type: 'FW',
            throat_test_mm: 12,
            fillet_throat_range: '',
            certificate_fillet_range: '6-24',
        }), CODES.FILLET);
        expect(n).toBeTruthy();
        expect(n.message_it).toContain('6-24 mm');
        expect(n.message_it).toContain('incompleto');
    });

    test('5. edizione 2012 assente in libreria: non si verifica, nessuna conformità inventata', () => {
        const n = byCode(base({
            standard_reference: 'UNI EN ISO 15614-1:2012',
        }), CODES.EDITION);
        expect(n).toBeTruthy();
        expect(n.message_it).toContain('UNI EN ISO 15614-1:2012');
        expect(n.message_it).toContain('non è in libreria');
        expect(n.message_it).toContain('Non si può verificare la conformità');
        expect(n.message_it.toLowerCase()).not.toMatch(/è conforme|conformità verificata|risulta conforme/);
    });

    test('5b. edizione 2017 in libreria: nessun avviso di edizione', () => {
        expect(byCode(base(), CODES.EDITION)).toBeNull();
    });

    test('6. ente emittente vuoto', () => {
        const n = byCode(base({ examiner_body: '', testing_body: '', issuing_body: '' }), CODES.KEYS);
        expect(n).toBeTruthy();
        expect(n.message_it).toContain('ente emittente');
    });

    test('6b. più campi chiave vuoti in un solo avviso', () => {
        const n = byCode({
            wpqr_code: '',
            certificate_number: '',
            welding_process: '',
            standard_reference: '',
            examiner_body: '',
        }, CODES.KEYS);
        expect(n.message_it).toContain('codice WPQR');
        expect(n.message_it).toContain('numero certificato');
        expect(n.message_it).toContain('ente emittente');
    });

    test('record completo 2017 senza discrepanze: nessun avviso', () => {
        expect(evaluateWpqrNotices(base(), { runs: [{ filler_designation: 'ISO 14341-A' }] })).toEqual([]);
    });
});

describe('approvato con avviso aperto e avviso risolto', () => {
    test('approvato + avviso aperto = da rivedere e non conta', () => {
        const notices = evaluateWpqrNotices(base({ examiner_body: '' }));
        expect(notices.length).toBeGreaterThan(0);
        expect(effectiveApprovalStatus('approvata', notices)).toBe('da_rivedere');
        expect(countsAsVerifiedConformity('approvata', notices)).toBe(false);
    });

    test('avviso confermato: torna a contare come conformità verificata', () => {
        const [open] = evaluateWpqrNotices(base({ examiner_body: '' }));
        const resolved = applyResolution(open, {
            fingerprint: open.fingerprint,
            status: STATUS.CONFERMATO,
        });
        expect(resolved.blocks_conformity).toBe(false);
        expect(effectiveApprovalStatus('approvata', [resolved])).toBe('approvata');
        expect(countsAsVerifiedConformity('approvata', [resolved])).toBe(true);
    });

    test('segnalato resta da rivedere', () => {
        const [open] = evaluateWpqrNotices(base({ examiner_body: '' }));
        const flagged = applyResolution(open, {
            fingerprint: open.fingerprint,
            status: STATUS.SEGNALATO,
        });
        expect(flagged.blocks_conformity).toBe(true);
        expect(effectiveApprovalStatus('approvata', [flagged])).toBe('da_rivedere');
    });

    test('fingerprint diverso non riusa una conferma vecchia', () => {
        const [open] = evaluateWpqrNotices(base({ examiner_body: '' }));
        const again = applyResolution(open, {
            fingerprint: 'altro',
            status: STATUS.CONFERMATO,
        });
        expect(again.status).toBe('aperto');
        expect(again.blocks_conformity).toBe(true);
    });
});

describe('registro estendibile', () => {
    test('la WPQR è registrata e un dominio nuovo si aggiunge senza toccare le regole WPQR', () => {
        expect(listDiscrepancyDomains()).toContain('wpqr');
        registerDiscrepancyDomain('wps', () => [{ code: 'WPS.DEMO', message_it: 'demo' }]);
        expect(evaluateDiscrepancy('wps', {}).map((n) => n.code)).toEqual(['WPS.DEMO']);
        expect(evaluateDiscrepancy('wpqr', base())).toEqual([]);
    });
});
