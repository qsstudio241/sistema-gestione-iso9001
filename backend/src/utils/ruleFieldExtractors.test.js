/**
 * @jest-environment node
 */

const { extractFieldsByRules, extractQualifica14732Fields } = require('./ruleFieldExtractors');

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

describe('extractFieldsByRules — dispatch per docType', () => {
    it('qualifica_14732 usa extractQualifica14732Fields registrato', () => {
        const out = extractFieldsByRules('nome: Anna Bianchi.\nCertificato: QO-1', 'qualifica_14732', 'x.pdf');
        expect(out.operator_name).toBe('Anna Bianchi');
    });

    it('docType non supportato restituisce oggetto vuoto', () => {
        expect(extractFieldsByRules('testo qualsiasi', 'tipo_inesistente', 'x.pdf')).toEqual({});
    });
});
