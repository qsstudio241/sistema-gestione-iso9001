jest.mock('../services/documentTreeProvisioner.service', () => ({
    folderCodeForDocType: (docType) => ({
        capitolato: '2.2',
        procedura: '1.2',
        patentino_saldatore: '4.5',
        altro: null,
    }[docType] || null),
}));

const { screenImportFile } = require('./importScreening');

describe('screenImportFile', () => {
    it('capitolato da path → high e posabile', () => {
        const out = screenImportFile({
            original_name: 'Commesse/Rossi-2024/capitolato.pdf',
            extracted_text: '',
        });
        expect(out.doc_type).toBe('capitolato');
        expect(out.folder_code).toBe('2.2');
        expect(out.confidence).toBe('high');
        expect(out.can_auto_place).toBe(true);
    });

    it('procedura da nome PG- → 1.2', () => {
        const out = screenImportFile({ original_name: 'SGQ/PG-04.pdf', extracted_text: '' });
        expect(out.doc_type).toBe('procedura');
        expect(out.folder_code).toBe('1.2');
        expect(out.can_auto_place).toBe(true);
    });

    it('patentino: classifica ma non auto-posa in registry', () => {
        const out = screenImportFile({
            original_name: 'Qualifiche/patentino-rossi.pdf',
            extracted_text: 'ISO 9606-1 welder qualification',
        });
        expect(out.doc_type).toBe('patentino_saldatore');
        expect(out.can_auto_place).toBe(false);
    });

    it('senza indizi resta altro low', () => {
        const out = screenImportFile({ original_name: 'scan-003.pdf', extracted_text: 'lorem ipsum' });
        expect(out.doc_type).toBe('altro');
        expect(out.confidence).toBe('low');
        expect(out.can_auto_place).toBe(false);
    });

    it('path e testo discordi → medium, vince il path', () => {
        const out = screenImportFile({
            original_name: 'Capitolati/rfq-cliente.pdf',
            extracted_text: 'ISO 9606-1 certificate of qualification welder',
        });
        expect(out.doc_type).toBe('capitolato');
        expect(out.confidence).toBe('medium');
        expect(out.can_auto_place).toBe(false);
    });
});
