/**
 * Normalizzazione mojibake OOXML (trattini/apici + accenti italiani UTF-8/Latin-1).
 */
import { describe, it, expect } from 'vitest';
import { fixWordXmlMojibake } from '../utils/wordExport.js';

/** Struttura reale dal template ISO9001 (proofErr spezza Conformit√ + NBSP). */
function splitAccentXml(wordPrefix, suffix) {
    return (
        `<w:r><w:rPr><w:b/></w:rPr><w:t>${wordPrefix}\u00C3</w:t></w:r>` +
        '<w:proofErr w:type="spellEnd"/>' +
        `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>\u00a0 ${suffix}</w:t></w:r>`
    );
}

describe('fixWordXmlMojibake', () => {
    it('corregge accenti italiani spezzati tra run Word (Conformit√ + NBSP)', () => {
        const fixed = fixWordXmlMojibake(splitAccentXml('Non Conformit', '(NC)'));
        expect(fixed).toContain('Non Conformit\u00e0 (NC)');
        expect(fixed).not.toContain('\u00C3');
    });

    it('corregge Opportunit√ spezzato', () => {
        const fixed = fixWordXmlMojibake(splitAccentXml('Opportunit', 'di Miglioramento'));
        expect(fixed).toContain('Opportunit\u00e0 di Miglioramento');
    });

    it('corregge en-dash mojibake ‚Ä"', () => {
        const xml = '<w:t>1 \u00e2\u20ac\u201c DATI</w:t>';
        expect(fixWordXmlMojibake(xml)).toContain('1 \u2013 DATI');
    });
});
