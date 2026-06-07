import { describe, it, expect } from 'vitest';
import {
    documentHasFile,
    formatDocumentFileLabel,
    isReleasedWithoutFile,
} from '../utils/documentRegistryFile';

describe('documentRegistryFile', () => {
    it('documentHasFile legge has_file e fallback nome', () => {
        expect(documentHasFile({ has_file: 1 })).toBe(true);
        expect(documentHasFile({ has_file: 0 })).toBe(false);
        expect(documentHasFile({ current_file_name: 'procedura.pdf' })).toBe(true);
        expect(documentHasFile({})).toBe(false);
    });

    it('formatDocumentFileLabel distingue assente e presente', () => {
        expect(formatDocumentFileLabel({ has_file: 0 }).short).toBe('Manca file');
        const long = 'a'.repeat(40) + '.pdf';
        expect(formatDocumentFileLabel({ has_file: 1, current_file_name: long }).short.endsWith('…')).toBe(true);
    });

    it('isReleasedWithoutFile solo per rilasciato/vigente senza file', () => {
        expect(isReleasedWithoutFile({ status: 'rilasciato', has_file: 0 })).toBe(true);
        expect(isReleasedWithoutFile({ status: 'bozza', has_file: 0 })).toBe(false);
        expect(isReleasedWithoutFile({ status: 'rilasciato', has_file: 1 })).toBe(false);
    });
});
