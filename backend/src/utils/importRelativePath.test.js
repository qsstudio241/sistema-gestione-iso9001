const {
    sanitizeImportRelativePath,
    basenameImportRelativePath,
    resolveImportOriginalName,
    relativePathsFromBody,
} = require('./importRelativePath');

describe('sanitizeImportRelativePath', () => {
    it('accetta path relativo Windows e Unix', () => {
        expect(sanitizeImportRelativePath('Commesse\\Rossi-2024\\capitolato.pdf'))
            .toBe('Commesse/Rossi-2024/capitolato.pdf');
        expect(sanitizeImportRelativePath('Commesse/Rossi-2024/capitolato.pdf'))
            .toBe('Commesse/Rossi-2024/capitolato.pdf');
    });

    it('rifiuta path assoluti, parent e non-PDF', () => {
        expect(sanitizeImportRelativePath('C:\\Users\\x\\file.pdf')).toBeNull();
        expect(sanitizeImportRelativePath('/var/data/file.pdf')).toBeNull();
        expect(sanitizeImportRelativePath('../segreto.pdf')).toBeNull();
        expect(sanitizeImportRelativePath('a/../../etc/passwd.pdf')).toBeNull();
        expect(sanitizeImportRelativePath('')).toBeNull();
        expect(sanitizeImportRelativePath(null)).toBeNull();
    });

    it('accetta docx, xlsx, dwg e immagini', () => {
        expect(sanitizeImportRelativePath('Commesse/Rossi/capitolato.docx'))
            .toBe('Commesse/Rossi/capitolato.docx');
        expect(sanitizeImportRelativePath('disegni/pianta.dwg')).toBe('disegni/pianta.dwg');
        expect(sanitizeImportRelativePath('foto.jpg')).toBe('foto.jpg');
    });
});

describe('basenameImportRelativePath', () => {
    it('prende solo il nome file', () => {
        expect(basenameImportRelativePath('Commesse/Rossi-2024/capitolato.pdf'))
            .toBe('capitolato.pdf');
        expect(basenameImportRelativePath('solo.pdf')).toBe('solo.pdf');
    });
});

describe('resolveImportOriginalName', () => {
    it('preferisce il path relativo sanitizzato', () => {
        expect(resolveImportOriginalName('capitolato.pdf', 'Commesse/Rossi/capitolato.pdf'))
            .toBe('Commesse/Rossi/capitolato.pdf');
    });

    it('torna al nome multer se il path e invalido', () => {
        expect(resolveImportOriginalName('capitolato.pdf', '../../x.pdf'))
            .toBe('capitolato.pdf');
    });
});

describe('relativePathsFromBody', () => {
    it('normalizza stringa e array', () => {
        expect(relativePathsFromBody({ relative_paths: 'a/b.pdf' })).toEqual(['a/b.pdf']);
        expect(relativePathsFromBody({ relative_paths: ['a/b.pdf', 'c.pdf'] }))
            .toEqual(['a/b.pdf', 'c.pdf']);
        expect(relativePathsFromBody({})).toEqual([]);
    });
});
