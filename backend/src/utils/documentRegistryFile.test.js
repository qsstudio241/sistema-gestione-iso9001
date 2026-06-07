const {
    parseTruthyQueryFlag,
    documentRowHasFile,
    HAS_ANY_FILE_SQL,
    CURRENT_FILE_APPLY_SQL,
} = require('./documentRegistryFile');

describe('documentRegistryFile', () => {
    describe('parseTruthyQueryFlag', () => {
        it('accetta 1, true, yes, on', () => {
            expect(parseTruthyQueryFlag('1')).toBe(true);
            expect(parseTruthyQueryFlag('true')).toBe(true);
            expect(parseTruthyQueryFlag('yes')).toBe(true);
            expect(parseTruthyQueryFlag('on')).toBe(true);
        });

        it('rifiuta valori vuoti o falsi', () => {
            expect(parseTruthyQueryFlag('')).toBe(false);
            expect(parseTruthyQueryFlag('0')).toBe(false);
            expect(parseTruthyQueryFlag('false')).toBe(false);
            expect(parseTruthyQueryFlag(null)).toBe(false);
        });
    });

    describe('documentRowHasFile', () => {
        it('usa has_file numerico quando presente', () => {
            expect(documentRowHasFile({ has_file: 1 })).toBe(true);
            expect(documentRowHasFile({ has_file: 0 })).toBe(false);
        });

        it('fallback su current_file_name', () => {
            expect(documentRowHasFile({ current_file_name: 'manuale.pdf' })).toBe(true);
            expect(documentRowHasFile({ current_file_name: null })).toBe(false);
        });
    });

    it('espone frammenti SQL attesi', () => {
        expect(HAS_ANY_FILE_SQL).toContain('attachments att');
        expect(CURRENT_FILE_APPLY_SQL).toContain('OUTER APPLY');
    });
});
