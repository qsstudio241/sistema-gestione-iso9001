/**
 * @jest-environment node
 */

const { extractFieldsByRules, extractQualifica14732Fields, extractWpqrFields } = require('./ruleFieldExtractors');

describe('extractQualifica14732Fields (RC-8)', () => {
    it('estrae nome operatore, ente, processo e posizioni da testo qualifica', () => {
        const text = `
            Qualifica operatore saldatura automatica
            nome: Mario Rossi.
            Certificato: QO-2024-0012
            Ente certificatore: Bureau Veritas
            Processo di saldatura: 141 (TIG)
            Posizione: PA
            Data esame: 01.03.2024
            Data scadenza: 01.03.2027
        `;
        const out = extractQualifica14732Fields(text, 'qualifica-14732-rossi.pdf');
        expect(out.operator_name).toBe('Mario Rossi');
        expect(out.certificate_number).toBe('QO-2024-0012');
        expect(out.issuing_body).toBe('Bureau Veritas');
        expect(out.welding_process).toBe('141');
        expect(out.welding_positions).toContain('PA');
        expect(out.exam_date).toBe('2024-03-01');
        expect(out.expiry_date).toBe('2027-03-01');
    });

    it('non lancia errori con testo vuoto/frammentario', () => {
        const out = extractQualifica14732Fields('', 'file.pdf');
        expect(out.operator_name).toBeNull();
        expect(out.welding_positions).toBeNull();
    });
});

describe('extractWpqrFields (DEPUTYTASK1 25/07/2026 — campi copertura pag.1/pag.2)', () => {
    const sample = `
        WELDING PROCEDURE QUALIFICATION RECORD (WPQR)
        Test certificate No: 24-03390-01
        Standard: UNI EN ISO 15614-1:2019
        Level: 2
        Welding process: 135
        Parent material group: 1.2
        Joint type: BW
        Range of qualification thickness (mm): 3 - 24
        Positions qualified: PA
        Filler metal designation: G 42 4 M21 4Si1
        Diametro elettrodo/filo d'apporto: 1.2 mm
        Base material: S355J2+N
        Shielding gas: M20
        Examiner: TEC Eurolab
        Record issued: 15.03.2024
    `;

    it('estrae processo 135 senza farsi confondere dall\'alias "elettrodo"', () => {
        const out = extractWpqrFields(sample, '24-03390-01.pdf');
        expect(out.welding_process).toBe('135');
    });

    it('estrae numero WPQR con suffisso di rivisione', () => {
        const out = extractWpqrFields(sample, '24-03390-01.pdf');
        expect(out.wpqr_number).toBe('24-03390-01');
        expect(out.reference_number).toBe('24-03390-01');
    });

    it('estrae gruppo materiale sensato (1 o 1.2)', () => {
        const out = extractWpqrFields(sample, '24-03390-01.pdf');
        expect(['1', '1.2']).toContain(out.material_group);
    });

    it('estrae campi di copertura pag.1: level, joint_type, range spessore, posizioni', () => {
        const out = extractWpqrFields(sample, '24-03390-01.pdf');
        expect(out.qualification_level).toBe('2');
        expect(out.joint_type).toBe('BW');
        expect(out.thickness_min).toBe(3);
        expect(out.thickness_max).toBe(24);
        expect(out.welding_positions).toContain('PA');
    });

    it('estrae ente TEC Eurolab e data di emissione etichettata', () => {
        const out = extractWpqrFields(sample, '24-03390-01.pdf');
        expect(out.examiner_body).toBe('TEC Eurolab');
        expect(out.issue_date).toBe('2024-03-15');
    });

    it('non assume una scadenza se non etichettata esplicitamente', () => {
        const out = extractWpqrFields(sample, '24-03390-01.pdf');
        expect(out.expiry_date).toBeNull();
    });
});

describe('extractFieldsByRules — dispatch per docType', () => {
    it('qualifica_14732 usa extractQualifica14732Fields registrato', () => {
        const out = extractFieldsByRules('nome: Anna Bianchi.\nCertificato: QO-1', 'qualifica_14732', 'x.pdf');
        expect(out.operator_name).toBe('Anna Bianchi');
    });

    it('docType non supportato restituisce oggetto vuoto', () => {
        expect(extractFieldsByRules('testo qualsiasi', 'tipo_inesistente', 'x.pdf')).toEqual({});
    });
});
