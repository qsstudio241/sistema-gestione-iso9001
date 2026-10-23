'use strict';

const texts = require('./discrepancyNoticeTexts');

describe('testi avvisi di discrepanza', () => {
    test('le tre frasi sotto i pulsanti sono quelle approvate', () => {
        expect(texts.HELP.conferma).toBe("Il dato è giusto così: l'avviso si chiude e resta nello storico");
        expect(texts.HELP.correggi).toBe('Modifichi il valore: resta traccia di chi, quando e del valore precedente');
        expect(texts.HELP.segnala).toBe('Non puoi o non devi decidere tu: la WPQR resta da rivedere e non conforme finché la segnalazione è aperta');
    });

    test('ogni motivo di Segnala ha un esempio', () => {
        expect(texts.REASONS.map((item) => item.id)).toEqual(['documento_originale', 'lettura_app', 'parere']);
        expect(texts.REASONS[0].example).toContain('lettera O');
        expect(texts.REASONS[1].example).toContain('pezzo di parola');
        expect(texts.REASONS[2].example).toContain('2012');
        expect(texts.REASONS[2].example).toContain('2017');
    });

    test('la pagina del PDF si aggiunge solo se è già un numero sul record', () => {
        expect(texts.knownPdfPage({ pdf_page: 4 })).toBe(4);
        expect(texts.knownPdfPage({ certificate_page: '12' })).toBe(12);
        expect(texts.knownPdfPage({})).toBeNull();
        expect(texts.knownPdfPage({ pdf_page: 0 })).toBeNull();
        expect(texts.knownPdfPage({ pdf_page: 1.5 })).toBeNull();
        expect(texts.withPdfPage('Controlla sul PDF.', null)).toBe('Controlla sul PDF.');
        expect(texts.withPdfPage('Controlla sul PDF.', 4)).toBe('Controlla sul PDF. Pagina del PDF: 4.');
        expect(texts.parereDraft({ note: 'Serve un parere.', page: null })).toContain('non è indicata sul record');
        expect(texts.parereDraft({ note: 'Serve un parere.', page: null })).not.toMatch(/Pagina del PDF: \d/);
        expect(texts.parereDraft({ note: 'Serve un parere.', page: 7 })).toContain('Pagina del PDF: 7.');
    });

    test('Conferma e Segnala esigono la motivazione, Correggi esige il valore nuovo', () => {
        expect(texts.validateNoticeAction('conferma', {}).ok).toBe(false);
        expect(texts.validateNoticeAction('conferma', { note: '  Il PDF ha la O.  ' })).toEqual({
            ok: true,
            note: 'Il PDF ha la O.',
        });
        expect(texts.validateNoticeAction('segnala', { note: 'x' }).ok).toBe(false);
        expect(texts.validateNoticeAction('segnala', { note: 'Il numero è sporco.', reason: 'lettura_app' }).ok).toBe(true);
        expect(texts.validateNoticeAction('correggi', { note: 'x' }).ok).toBe(false);
        expect(texts.validateNoticeAction('correggi', { new_value: '16VE01735PO2/A' }).newValue).toBe('16VE01735PO2/A');
    });

    test("l'esempio di autoapprendimento non tiene il numero del certificato né un PDF", () => {
        const raw = "Letto 16VE01735PO2/A dal file /uploads/cliente/cert.pdf del saldatore Mario Rossi.";
        const out = texts.anonymizeLearningExample(raw, {
            certificate_number: '16VE01735PO2/A',
            welder_name: 'Mario Rossi',
        });
        expect(out).not.toContain('16VE01735');
        expect(out).not.toContain('Mario Rossi');
        expect(out).not.toContain('/uploads/');
        expect(out).not.toMatch(/\.pdf/i);
        expect(out).toContain('[DATO]');
    });

    test('la bozza di richiesta dice che nessuna email è partita', () => {
        const draft = texts.draftRequest({ wpqrCode: 'ZZ-1', note: 'O al posto dello zero', page: null });
        expect(draft).toContain('nessuna email');
        expect(draft).not.toMatch(/Pagina del PDF: \d/);
    });
});
