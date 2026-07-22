'use strict';

const { describeIngestFileError } = require('./ingestErrorMessage');

describe('ingestErrorMessage / describeIngestFileError', () => {
    it('usa err.message quando disponibile', () => {
        expect(describeIngestFileError(new Error('PDF corrotto'))).toBe('PDF corrotto');
    });

    it('usa la stringa direttamente se err e\' una stringa', () => {
        expect(describeIngestFileError('Timeout AI provider')).toBe('Timeout AI provider');
    });

    it('usa err.code se non c\'e\' un message utilizzabile', () => {
        expect(describeIngestFileError({ code: 'ETIMEDOUT' })).toBe('Errore (ETIMEDOUT) durante l\'elaborazione del file.');
    });

    it('ricade sul fallback per null/undefined', () => {
        expect(describeIngestFileError(null)).toMatch(/PDF non sia protetto/);
        expect(describeIngestFileError(undefined)).toMatch(/PDF non sia protetto/);
    });

    it('ricade sul fallback per oggetto senza message/code', () => {
        expect(describeIngestFileError({})).toMatch(/PDF non sia protetto/);
    });

    it('ricade sul fallback custom se fornito', () => {
        expect(describeIngestFileError(null, 'Fallback custom')).toBe('Fallback custom');
    });

    it('ignora message vuoto/whitespace e usa fallback', () => {
        expect(describeIngestFileError(new Error('   '))).toMatch(/PDF non sia protetto/);
    });
});
