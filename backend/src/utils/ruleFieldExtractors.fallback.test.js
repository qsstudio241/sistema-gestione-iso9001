/**
 * @jest-environment node
 *
 * Fallback a regole robusti per patentini / qualifiche 14732 (smoke ingest 08/10/2026):
 * nome senza parole-etichetta, data esame != data di nascita, scadenza != emissione,
 * processo ISO 4063 solo ad alta confidenza, numero certificato da testo o prefisso numerico del file,
 * gruppo materiale solo con etichetta. Fixture sintetiche (nessun dato reale).
 */

const {
    extractFieldsByRules,
    extractPatentinoFields,
    extractQualifica14732Fields,
    extractQualificationDates,
    extractQualificationCertificateNumber,
    extractMaterialGroupLabeled,
} = require('./ruleFieldExtractors');
const { mergeExtractions, pickMergedValue } = require('../services/documentIngestPipeline.service');

jest.mock('../services/aiProviderAdapter', () => ({ getActiveProvider: jest.fn(), chat: jest.fn() }));
jest.mock('../services/importAiExtraction.service', () => ({ extractStructuredByDocType: jest.fn() }));

describe('nome: niente parole-etichetta', () => {
    it.each([
        ['Photograph in testa', 'Name\nPhotograph\nROSSI MARIO\nDate of birth 12.05.1975'],
        ['Photo in testa', 'Name: Photo ROSSI MARIO'],
        ['Fotografia in testa', 'Nome e cognome: Fotografia ROSSI MARIO'],
        ['Surname/Name in testa', 'Name: Surname Name ROSSI MARIO'],
        ['Photograph in coda', 'Nome: ROSSI MARIO Photograph'],
    ])('%s', (_label, text) => {
        expect(extractPatentinoFields(text, 'x.pdf').welder_name).toBe('ROSSI MARIO');
    });

    it('solo parole-etichetta -> null', () => {
        expect(extractPatentinoFields('Name: Photograph Surname', 'x.pdf').welder_name).toBeNull();
    });

    it('non regredisce sul caso base', () => {
        expect(extractPatentinoFields('Nome e cognome: MARIO ROSSI', 'x.pdf').welder_name).toBe('MARIO ROSSI');
    });
});

describe('date: esame non e la nascita, scadenza non e emissione', () => {
    it('data di nascita prima della data della prova: prende la prova', () => {
        const text = 'Date of birth 12.05.1975\nDate of test 03.03.2024\nValid until 02.03.2027';
        expect(extractQualificationDates(text)).toEqual({ exam_date: '2024-03-03', expiry_date: '2027-03-02' });
    });

    it('nascita come prima data senza etichette di prova: scartata', () => {
        const text = 'Born 12.05.1975\n03.03.2024\n02.03.2027';
        expect(extractQualificationDates(text)).toEqual({ exam_date: '2024-03-03', expiry_date: '2027-03-02' });
    });

    it('"Nato a <luogo> il" in italiano', () => {
        const text = 'Nato a Roma il 12.05.1975\nData della prova: 03.03.2024\nScadenza: 02.03.2027';
        expect(extractQualificationDates(text)).toEqual({ exam_date: '2024-03-03', expiry_date: '2027-03-02' });
    });

    it('etichetta di nascita non inghiotte la data di prova che segue', () => {
        const text = 'Date of birth 12.05.1975 Date of test 03.03.2024';
        expect(extractQualificationDates(text).exam_date).toBe('2024-03-03');
    });

    it.each([
        ['Nato a Roma\nData della prova 03.03.2024\nValid until 02.03.2027'],
        ['Born in Rome\n03.03.2024\n02.03.2027'],
        ['Nato a Roma il 12.05.1975\n03.03.2024\n02.03.2027'],
        ['Born in Rome on 12.05.1975\n03.03.2024\n02.03.2027'],
        ['Nato il 12.05.1975\n03.03.2024\n02.03.2027'],
    ])('luogo di nascita senza data non inghiotte la data esame: %j', (text) => {
        expect(extractQualificationDates(text)).toEqual({ exam_date: '2024-03-03', expiry_date: '2027-03-02' });
    });

    it.each([
        'Data di prova 03.03.2024',
        'Data di esame: 03.03.2024',
        'Data dell\'esame 03.03.2024',
    ])('etichette esame con "data di": %j', (text) => {
        expect(extractQualificationDates(`Emesso 01.02.2024\n${text}`).exam_date).toBe('2024-03-03');
    });

    it('titolo "Validity" senza data non oscura il successivo "Valid until"', () => {
        const text = 'Date of test 03.03.2024\nRange of validity\nValidity of qualification\nValid until 02.03.2027\nStampato 05.05.2025';
        expect(extractQualificationDates(text).expiry_date).toBe('2027-03-02');
    });

    it('scarta anni < 1990 quando esistono alternative, anche senza etichetta nascita', () => {
        const text = '01.01.1960\n03.03.2024\n02.03.2027';
        expect(extractQualificationDates(text)).toEqual({ exam_date: '2024-03-03', expiry_date: '2027-03-02' });
    });

    it('con la sola data < 1990 la mantiene (nessuna alternativa)', () => {
        expect(extractQualificationDates('Data prova 05.06.1985').exam_date).toBe('1985-06-05');
    });

    it('una sola data: scadenza null (non uguale alla data esame)', () => {
        expect(extractQualificationDates('Date of test 03.03.2024')).toEqual({ exam_date: '2024-03-03', expiry_date: null });
        expect(extractPatentinoFields('Certificato\n03.03.2024', 'x.pdf').expiry_date).toBeNull();
    });

    it('scadenza etichettata uguale o precedente alla data esame -> null', () => {
        expect(extractQualificationDates('Date of test 03.03.2024\nValid until 03.03.2024').expiry_date).toBeNull();
        expect(extractQualificationDates('Date of test 03.03.2024\nValidity 01.01.2020').expiry_date).toBeNull();
    });

    it('etichette Validity / Valido fino al', () => {
        expect(extractQualificationDates('Date of test 03.03.2024\nValidity: 02.03.2027').expiry_date).toBe('2027-03-02');
        expect(extractQualificationDates('Data prova 03.03.2024\nValido fino al 02.03.2027').expiry_date).toBe('2027-03-02');
    });

    it('scadenza etichettata prima dell esame: vince sulla posizione', () => {
        const text = 'Scadenza: 02.03.2027\nDate of test 03.03.2024';
        expect(extractQualificationDates(text)).toEqual({ exam_date: '2024-03-03', expiry_date: '2027-03-02' });
        expect(extractPatentinoFields(text, 'x.pdf').expiry_date).toBe('2027-03-02');
        expect(extractQualifica14732Fields(text, 'x.pdf').expiry_date).toBe('2027-03-02');
        expect(extractQualificationDates('Scadenza: 02.03.2027\n03.03.2024')).toEqual({
            exam_date: '2024-03-03',
            expiry_date: '2027-03-02',
        });
    });

    it('scadenza ISO YYYY-MM-DD etichettata: non viene scartata (allDates raccoglie ISO per prima)', () => {
        expect(extractQualificationDates('03.03.2024\nExpiry date: 2027-03-02')).toEqual({
            exam_date: '2024-03-03',
            expiry_date: '2027-03-02',
        });
        expect(extractQualificationDates('Valid until 2027-03-02\n03.03.2024')).toEqual({
            exam_date: '2024-03-03',
            expiry_date: '2027-03-02',
        });
        expect(extractQualificationDates('Expiry date: 2027-03-02\nDate of test: 2024-03-03')).toEqual({
            exam_date: '2024-03-03',
            expiry_date: '2027-03-02',
        });
    });

    it('vale anche per la qualifica 14732', () => {
        const out = extractQualifica14732Fields('Date of birth 12.05.1975\nExamination date 03.03.2024', 'x.pdf');
        expect(out.exam_date).toBe('2024-03-03');
        expect(out.expiry_date).toBeNull();
    });
});

describe('welding_process: solo alta confidenza', () => {
    it('piu codici nudi (141 e 145): non sceglie 145', () => {
        const text = 'Certificate\nISO 9606-1: 141 P BW\nRif. 145 interno\nNome: MARIO ROSSI';
        const out = extractPatentinoFields(text, 'x.pdf');
        expect(out.welding_process_test).toBe('141');
        expect(out.welding_process).toBe('141');
    });

    it('codice nudo / alias senza designazione ne etichetta: null', () => {
        expect(extractPatentinoFields('Saldatura TIG rif 145 pagina 2', 'x.pdf').welding_process).toBeNull();
        expect(extractQualifica14732Fields('Operatore elettrodo 145', 'x.pdf').welding_process).toBeNull();
    });

    it('etichetta esplicita ha priorita', () => {
        const out = extractPatentinoFields('ISO 9606-1: 135 P FW FM1 t8 PB ss mb\nWelding process 138', 'x.pdf');
        expect(out.welding_process).toBe('138');
        expect(out.welding_process_test).toBe('135');
    });

    it('non tronca un codice se il numero e piu lungo; accetta anno di edizione ISO 4063', () => {
        expect(extractPatentinoFields('Welding process 1410', 'x.pdf').welding_process).toBeNull();
        expect(extractPatentinoFields('ISO 4063:2017 141', 'x.pdf').welding_process).toBe('141');
    });

    it('precedenza regola/AI: l AI vince; con AI null la regola entra solo se alta confidenza', () => {
        const strong = { welding_process: '141' };
        expect(pickMergedValue('welding_process', strong, { welding_process: '135' }).value).toBe('135');
        expect(pickMergedValue('welding_process', strong, { welding_process: null }).value).toBe('141');
        const weakRules = extractPatentinoFields('Saldatura TIG rif 145', 'x.pdf');
        const merged = mergeExtractions(weakRules, { welding_process: null }, 'patentino_saldatore');
        expect(merged.fields.welding_process).toBeUndefined();
    });
});

describe('numero certificato', () => {
    const ROSSI = 'ROSSI MARIO 24-03390-01.pdf';

    it('non usa il nome file contenente il titolare', () => {
        expect(extractQualificationCertificateNumber('Documento senza numero', ROSSI)).toBeNull();
        expect(extractPatentinoFields('Nome: MARIO ROSSI', 'ROSSI_MARIO_qualifica.pdf').certificate_number).toBeNull();
    });

    it.each([
        ['Certificate No. 24-03390-01', '24-03390-01'],
        ['Qualification certificate no.: 24-03390-01', '24-03390-01'],
        ['N° certificato: 24-03390-01', '24-03390-01'],
        ['Numero del certificato 24-03390-01', '24-03390-01'],
        ['Certificate No\n24-03390-01', '24-03390-01'],
    ])('dal testo vicino all etichetta: %s', (text, expected) => {
        expect(extractQualificationCertificateNumber(text, ROSSI)).toBe(expected);
    });

    it('un valore senza cifre non e un numero (es. "Certificate holder")', () => {
        expect(extractQualificationCertificateNumber('Certificate Photograph\nNome', 'x.pdf')).toBeNull();
    });

    it.each([
        ['24-03390.pdf', '24-03390'],
        ['24-03390-01 ROSSI MARIO.pdf', '24-03390-01'],
        ['24-03390-01-001_ab12.pdf', '24-03390-01-001'],
        ['24-0339.pdf', '24-0339'],
    ])('ultima risorsa: prefisso numerico del file %s', (fileName, expected) => {
        expect(extractQualificationCertificateNumber('Nessun numero', fileName)).toBe(expected);
    });

    it('il testo prevale sul nome file', () => {
        expect(extractQualificationCertificateNumber('Certificate No. 99-11111-02', '24-03390-01.pdf')).toBe('99-11111-02');
    });

    it('vale anche per la qualifica 14732', () => {
        expect(extractQualifica14732Fields('Operatore', 'ROSSI MARIO.pdf').certificate_number).toBeNull();
        expect(extractQualifica14732Fields('Operatore', '24-03390-01 ROSSI.pdf').certificate_number).toBe('24-03390-01');
    });
});

describe('material_group: solo con contesto', () => {
    it.each([
        'Via Garibaldi 12, 20100 Milano\nTel 02 12345678',
        'Indirizzo: Via Roma 8/10\nCAP 10100 Torino',
        'Data 11-12-2024 pagina 1/8',
    ])('non deduce il gruppo da indirizzi/CAP/civici: %j', (text) => {
        expect(extractMaterialGroupLabeled(text)).toBeNull();
        expect(extractPatentinoFields(text, 'x.pdf').material_group).toBeNull();
    });

    it.each([
        ['Material group: 1.1', '1.1'],
        ['Gruppo materiale 8.1', '8.1'],
        ['Parent material group 1', '1'],
        ['Materiale base: 8.1', '8.1'],
        ['Material group ISO/TR 15608: 1.2', '1.2'],
        ['Gruppo materiale ISO/TR 15608 8.1', '8.1'],
        ['ISO/TR 15608: 1.2', '1.2'],
        ['ISO/TR 15608 8.1', '8.1'],
    ])('con etichetta o norma %s', (text, expected) => {
        expect(extractMaterialGroupLabeled(text)).toBe(expected);
        expect(extractPatentinoFields(text, 'x.pdf').material_group).toBe(expected);
    });

    it('mantiene la designazione acciaio come indizio', () => {
        expect(extractMaterialGroupLabeled('Base material S355J2')).toBe('1.2');
    });

    it('ISO/TR 15608 con indirizzo nello stesso testo: prende il gruppo, non il civico', () => {
        const text = 'Via Roma 8/10\nCAP 10100 Torino\nMaterial group ISO/TR 15608: 1.2';
        expect(extractMaterialGroupLabeled(text)).toBe('1.2');
        expect(extractPatentinoFields(text, 'x.pdf').material_group).toBe('1.2');
    });

    it('non tronca numeri materiale o date in un gruppo plausibile', () => {
        expect(extractMaterialGroupLabeled('ISO/TR 15608 1.4301')).not.toBe('1');
        expect(extractMaterialGroupLabeled('ISO/TR 15608 1.4301')).toBe('8.1');
        expect(extractMaterialGroupLabeled('Material group ISO/TR 15608 1.4301')).not.toBe('1');
        expect(extractMaterialGroupLabeled('Material group ISO/TR 15608 1.4301')).toBe('8.1');
        expect(extractPatentinoFields('ISO/TR 15608 1.4301', 'x.pdf').material_group).toBe('8.1');
        expect(extractMaterialGroupLabeled('ISO/TR 15608 01.06.2025')).toBeNull();
        expect(extractMaterialGroupLabeled('Gruppo materiale 10.03.2024')).toBeNull();
        expect(extractPatentinoFields('Gruppo materiale 10.03.2024', 'x.pdf').material_group).toBeNull();
    });

    it('accetta l anno di edizione dopo ISO/TR 15608', () => {
        expect(extractMaterialGroupLabeled('ISO/TR 15608:2017 1.2')).toBe('1.2');
        expect(extractMaterialGroupLabeled('ISO/TR 15608-2017: 1.2')).toBe('1.2');
        expect(extractMaterialGroupLabeled('Material group ISO/TR 15608:2017 1.2')).toBe('1.2');
    });
});

describe('regressione extractFieldsByRules patentino', () => {
    it('caso completo sintetico', () => {
        const text = [
            'CERTIFICATO DI QUALIFICA SALDATORE',
            'Certificate No. 24-03390-01',
            'Nome e cognome: MARIO ROSSI',
            'Date of birth 12.05.1975',
            'ISO 9606-1: 141 P BW FM1 t6 PA ss nb',
            'Material group: 8.1',
            'Date of test 03.03.2024',
            'Valid until 02.03.2027',
        ].join('\n');
        const out = extractFieldsByRules(text, 'patentino_saldatore', 'ROSSI MARIO.pdf');
        expect(out).toMatchObject({
            welder_name: 'MARIO ROSSI',
            certificate_number: '24-03390-01',
            welding_process_test: '141',
            welding_process: '141',
            material_group: '8.1',
            exam_date: '2024-03-03',
            expiry_date: '2027-03-02',
        });
    });
});
