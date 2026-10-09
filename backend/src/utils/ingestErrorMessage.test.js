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

describe('ingestErrorMessage / redactPersonForLog (privacy log titolare)', () => {
    const { redactPersonForLog, redactJsonSnippetForLog } = require('./ingestErrorMessage');
    const FORMAT = /^person#[0-9a-f]{8}$/;

    it('forma person#<hash8>, senza nessuna parte del nome (nemmeno le iniziali)', () => {
        const out = redactPersonForLog('ROSSI MARIO');
        expect(out).toMatch(FORMAT);
        expect(out.toLowerCase()).not.toContain('rossi');
        expect(out.toLowerCase()).not.toContain('mario');
        expect(out).not.toMatch(/\bR\b|\bM\b/);
    });

    it('deterministico: stesso input, stesso hash; nomi diversi, hash diversi', () => {
        expect(redactPersonForLog('ROSSI MARIO')).toBe(redactPersonForLog('ROSSI MARIO'));
        expect(redactPersonForLog('ROSSI MARIO')).not.toBe(redactPersonForLog('BIANCHI ANNA'));
    });

    it('spazi multipli, maiuscole/minuscole e forma Unicode non cambiano l\'hash', () => {
        const base = redactPersonForLog('ROSSI MARIO');
        expect(redactPersonForLog('  rossi   mario ')).toBe(base);
        expect(redactPersonForLog('ROSSI\tMARIO')).toBe(base);
        expect(redactPersonForLog('Nicol\u00F2 D\u2019Angelo')).toBe(redactPersonForLog('Nicolo\u0300 D\u2019Angelo'));
    });

    it('ordine nome-cognome invertito: hash diverso (limite noto, nessun riordino)', () => {
        expect(redactPersonForLog('MARIO ROSSI')).not.toBe(redactPersonForLog('ROSSI MARIO'));
    });

    it('nomi con accenti/Unicode: nessuna parte del nome nell\'output', () => {
        const out = redactPersonForLog('Nicol\u00F2 D\u2019Angelo-\u0106ur\u010Di\u0107');
        expect(out).toMatch(FORMAT);
        expect(out).not.toMatch(/Nicol|Angelo|ur\u010Di/i);
    });

    it('anche per email: nessuna parte dell\'indirizzo', () => {
        const out = redactPersonForLog('mario.rossi@example.test');
        expect(out).toMatch(FORMAT);
        expect(out).not.toMatch(/mario|rossi|example/i);
    });

    it.each([null, undefined, '', '   ', 42, {}, [], true])('input non utilizzabile %j -> person#none', (v) => {
        expect(redactPersonForLog(v)).toBe('person#none');
    });

    it('redactJsonSnippetForLog: toglie l\'estratto del testo dai messaggi di JSON.parse', () => {
        let msg;
        try { JSON.parse('ZZROSSI ZZMARIO'); } catch (e) { msg = e.message; }
        const out = redactJsonSnippetForLog(msg);
        expect(out).not.toContain('ZZROSSI');
        expect(out).toContain('is not valid JSON');
        expect(redactJsonSnippetForLog('Timeout provider')).toBe('Timeout provider');
        expect(redactJsonSnippetForLog(null)).toBe('');
    });
});
