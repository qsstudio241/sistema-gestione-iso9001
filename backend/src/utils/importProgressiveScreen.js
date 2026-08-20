/**
 * Screening a campioni crescenti: 30 → 90 → 200 righe di testo già estratto.
 * Si ferma se la confidence è alta o se si tocca il tetto caratteri.
 * Niente LLM. Word/Excel vanno prima convertiti in testo (importExtractText).
 */

const { screenImportFile } = require('./importScreening');

const LINE_STEPS = Object.freeze([30, 90, 200]);
const MAX_SCREEN_CHARS = 8000;

/**
 * Prime N righe, con tetto caratteri (una riga enorme non deve saturare).
 * @param {unknown} text
 * @param {number} maxLines
 * @param {number} [maxChars]
 * @returns {string}
 */
function takeHead(text, maxLines, maxChars = MAX_SCREEN_CHARS) {
    const raw = String(text || '');
    if (!raw) return '';
    const n = Math.max(0, Number(maxLines) || 0);
    return raw.split(/\r?\n/).slice(0, n).join('\n').slice(0, maxChars);
}

/**
 * @param {{ original_name?: string, extracted_text?: string, hint?: string }} input
 * @param {typeof screenImportFile} [screenFn]
 * @returns {ReturnType<typeof screenImportFile> & { lines_used: number, chars_used: number }}
 */
function progressiveScreenImportFile(input, screenFn = screenImportFile) {
    const full = String(input?.extracted_text || '');
    let used = '';
    let last;

    if (!full) {
        last = screenFn({ ...input, extracted_text: '' });
    } else {
        for (const n of LINE_STEPS) {
            used = takeHead(full, n);
            last = screenFn({ ...input, extracted_text: used });
            // high = chiaro; medium = tipo già indovinato. Solo low → altre righe.
            if (last.confidence !== 'low') break;
            if (used.length >= full.length) break;
            if (used.length >= MAX_SCREEN_CHARS) break;
        }
    }

    return {
        ...last,
        lines_used: used ? used.split(/\r?\n/).length : 0,
        chars_used: used.length,
    };
}

module.exports = {
    LINE_STEPS,
    MAX_SCREEN_CHARS,
    takeHead,
    progressiveScreenImportFile,
};
