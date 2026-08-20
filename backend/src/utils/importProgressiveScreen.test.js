jest.mock('../services/documentTreeProvisioner.service', () => ({
    folderCodeForDocType: (docType) => ({
        capitolato: '2.2',
        procedura: '1.2',
        patentino_saldatore: '4.5',
        altro: null,
    }[docType] || null),
}));

const {
    takeHead,
    progressiveScreenImportFile,
    LINE_STEPS,
    MAX_SCREEN_CHARS,
} = require('./importProgressiveScreen');

describe('takeHead', () => {
    it('prende le prime N righe', () => {
        expect(takeHead('a\nb\nc\nd', 2)).toBe('a\nb');
    });

    it('taglia al tetto caratteri', () => {
        const long = 'x'.repeat(MAX_SCREEN_CHARS + 50);
        expect(takeHead(long, 1).length).toBe(MAX_SCREEN_CHARS);
    });

    it('testo vuoto → stringa vuota', () => {
        expect(takeHead('', 30)).toBe('');
        expect(takeHead(null, 30)).toBe('');
    });
});

describe('progressiveScreenImportFile', () => {
    it('si ferma al primo passo se path+30 righe bastano', () => {
        const out = progressiveScreenImportFile({
            original_name: 'Commesse/Rossi/capitolato.docx',
            extracted_text: 'Capitolato tecnico\n' + 'filler\n'.repeat(80),
        });
        expect(out.doc_type).toBe('capitolato');
        expect(out.confidence).toBe('high');
        expect(out.lines_used).toBeLessThanOrEqual(LINE_STEPS[0]);
    });

    it('aumenta le righe se le prime 30 non bastano', () => {
        const filler = Array.from({ length: 40 }, (_, i) => `riga ${i + 1} lorem`).join('\n');
        const out = progressiveScreenImportFile({
            original_name: 'scan-003.docx',
            extracted_text: `${filler}\nQuesto documento è un capitolato tecnico RFQ per richiesta di offerta`,
        });
        expect(out.doc_type).toBe('capitolato');
        expect(out.lines_used).toBeGreaterThan(30);
        expect(out.lines_used).toBeLessThanOrEqual(90);
    });

    it('senza testo usa solo path (0 righe)', () => {
        const out = progressiveScreenImportFile({
            original_name: 'Disegni/pezzo.dwg',
            extracted_text: '',
        });
        expect(out.doc_type).toBe('altro');
        expect(out.lines_used).toBe(0);
        expect(out.chars_used).toBe(0);
    });

    it('non chiama lo screener oltre il necessario (high al primo passo)', () => {
        const calls = [];
        const screenFn = (input) => {
            calls.push(String(input.extracted_text || '').split('\n').length);
            return {
                doc_type: 'capitolato',
                confidence: 'high',
                folder_code: '2.2',
                reason: 'mock',
                can_auto_place: true,
                basename: 'x',
            };
        };
        progressiveScreenImportFile({
            original_name: 'x.docx',
            extracted_text: Array.from({ length: 200 }, (_, i) => `L${i}`).join('\n'),
        }, screenFn);
        expect(calls.length).toBe(1);
        expect(calls[0]).toBe(30);
    });
});
