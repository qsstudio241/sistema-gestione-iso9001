/**
 * @jest-environment node
 *
 * redactFileNameForLog: forma non identificante del nome file nei log (fixture sintetiche).
 */

const { redactFileNameForLog } = require('./ingestErrorMessage');

const NOME = '99-00000_ROSSI MARIO_14732_X.pdf';

describe('redactFileNameForLog', () => {
    it('formato file#<hash8>.<ext>, nessuna parte del nome originale', () => {
        const out = redactFileNameForLog(NOME);
        expect(out).toMatch(/^file#[0-9a-f]{8}\.pdf$/);
        for (const part of ['ROSSI', 'MARIO', 'Rossi', '99-00000', '14732', '_X', NOME]) {
            expect(out).not.toContain(part);
        }
    });

    it('deterministico: stesso nome -> stesso output; nomi diversi -> output diversi', () => {
        expect(redactFileNameForLog(NOME)).toBe(redactFileNameForLog(NOME));
        expect(redactFileNameForLog(NOME)).not.toBe(redactFileNameForLog('99-00000_VERDI LUCA_14732_X.pdf'));
        expect(redactFileNameForLog('a.pdf')).not.toBe(redactFileNameForLog('b.pdf'));
    });

    it('path Windows e POSIX: conta solo il nome finale e il path non compare', () => {
        const base = redactFileNameForLog(NOME);
        expect(redactFileNameForLog(`C:\\Users\\mario\\Documenti\\${NOME}`)).toBe(base);
        expect(redactFileNameForLog(`/var/uploads/cliente-acme/${NOME}`)).toBe(base);
        expect(redactFileNameForLog(`/var/uploads/cliente-acme/${NOME}`)).not.toContain('acme');
        expect(redactFileNameForLog('C:\\Users\\mario\\x.pdf')).not.toContain('mario');
    });

    it('null, undefined, vuoto, spazi, non stringhe, path senza nome', () => {
        for (const v of [null, undefined, '', '   ', 42, {}, [], '/', 'C:\\dir\\', '/var/uploads/']) {
            expect(redactFileNameForLog(v)).toBe('file#none');
        }
    });

    it('Unicode: nessun carattere del nome, normalizzazione NFC (accento composto = scomposto)', () => {
        const composto = 'Perché_Nicolò_Müller_14732.pdf';
        const scomposto = composto.normalize('NFD');
        const out = redactFileNameForLog(composto);
        expect(out).toMatch(/^file#[0-9a-f]{8}\.pdf$/);
        expect(redactFileNameForLog(scomposto)).toBe(out);
        expect(out).not.toMatch(/[^\x20-\x7e]/);
        expect(redactFileNameForLog('日本語_山田太郎.pdf')).toMatch(/^file#[0-9a-f]{8}\.pdf$/);
    });

    it('estensione solo se di un tipo noto (mai una parte del nome travestita da estensione)', () => {
        expect(redactFileNameForLog('x.PDF')).toMatch(/\.pdf$/);
        expect(redactFileNameForLog('x.jpeg')).toMatch(/\.jpeg$/);
        const strana = redactFileNameForLog('scansione.ROSSI');
        expect(strana).toMatch(/^file#[0-9a-f]{8}$/);
        expect(strana.toLowerCase()).not.toContain('rossi');
        expect(redactFileNameForLog('.pdf')).toMatch(/^file#[0-9a-f]{8}$/);
        expect(redactFileNameForLog('senzaestensione')).toMatch(/^file#[0-9a-f]{8}$/);
    });
});
