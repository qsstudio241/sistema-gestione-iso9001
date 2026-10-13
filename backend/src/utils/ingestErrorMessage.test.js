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

describe('redactEmailForLog / redactEmailsForLog', () => {
    const { redactEmailForLog, redactEmailsForLog } = require('./ingestErrorMessage');
    const EMAIL = 'mario.rossi@example.test';

    it('nessuna parte dell\'email (parte locale, dominio, TLD) compare nell\'output', () => {
        const out = redactEmailForLog(EMAIL);
        expect(out).toMatch(/^email#[0-9a-f]{8}$/);
        for (const leak of ['mario', 'rossi', 'example', 'test', '@', '.']) {
            expect(out.replace('email#', '')).not.toContain(leak);
        }
        expect(out).not.toMatch(/mario|rossi|example/i);
    });

    it('deterministico e insensibile a maiuscole e spazi ai bordi', () => {
        expect(redactEmailForLog(EMAIL)).toBe(redactEmailForLog(EMAIL));
        expect(redactEmailForLog(`  ${EMAIL.toUpperCase()}\n`)).toBe(redactEmailForLog(EMAIL));
        expect(redactEmailForLog('altra.persona@example.test')).not.toBe(redactEmailForLog(EMAIL));
    });

    it('plus-addressing: indirizzi diversi restano distinti e senza parti in chiaro', () => {
        const plus = redactEmailForLog('mario.rossi+sgq@example.test');
        expect(plus).not.toBe(redactEmailForLog(EMAIL));
        expect(plus).not.toMatch(/mario|sgq|\+/i);
    });

    it('Unicode: NFC e NFD dello stesso indirizzo danno lo stesso hash, nessun carattere in chiaro', () => {
        const nfc = 'jos\u00e9.nu\u00f1ez@esempio.test';
        const nfd = nfc.normalize('NFD');
        expect(redactEmailForLog(nfd)).toBe(redactEmailForLog(nfc));
        expect(redactEmailForLog(nfc)).not.toMatch(/jos|nu|esempio/i);
    });

    it('vuoto, null, undefined, non stringa => email#none', () => {
        for (const v of ['', '   ', null, undefined, 42, {}, [], true]) {
            expect(redactEmailForLog(v)).toBe('email#none');
        }
    });

    it('elenco destinatari: stringa con virgole/punto e virgola o array, ogni indirizzo hashato', () => {
        const a = redactEmailForLog('a.uno@example.test');
        const b = redactEmailForLog('b.due@example.test');
        expect(redactEmailsForLog('a.uno@example.test, B.Due@example.test')).toBe(`${a}, ${b}`);
        expect(redactEmailsForLog('a.uno@example.test;b.due@example.test')).toBe(`${a}, ${b}`);
        expect(redactEmailsForLog(['a.uno@example.test', ' ', null, 'b.due@example.test'])).toBe(`${a}, ${b}`);
        expect(redactEmailsForLog('a.uno@example.test, b.due@example.test')).not.toMatch(/uno|due|example/i);
        for (const v of ['', null, undefined, 5, [], ' , ']) expect(redactEmailsForLog(v)).toBe('email#none');
    });
});
