/**
 * @jest-environment node
 *
 * Test L1 — conferme periodiche ISO 14732 §6.2 / ISO 9606-1 §9.2 in ingest qualifiche:
 * resolveConfirmationDates, mapPipelineFieldsToReview, stato salvato coerente con la scadenza effettiva,
 * anno a 2 cifre nelle date. Fixture sintetiche (nessun dato reale).
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({
        ok: true, personnelId: 55, personName: 'Mario Rossi',
    }),
}));
jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(() => ({ detected_type: 'qualifica_14732', confidence: 'low' })),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { getPool } = require('../config/database');
const {
    resolveConfirmationDates,
    mapPipelineFieldsToReview,
    commitQualificationFromFields,
} = require('./qualificationIngest.service');
const { deriveQualificationStatus } = require('./weldingCoordinatorAuth.service');
const {
    allDates,
    extractQualifica14732Fields,
    extractPatentinoFields,
    extractCertNdtFields,
} = require('../utils/ruleFieldExtractors');

const OP14732 = 'Operatore ISO 14732';

describe('resolveConfirmationDates', () => {
    const base = { examDate: '2024-01-10', issueDate: '2024-01-15' };

    it('tabella con due conferme: ultima = la piu recente, prossima = ultima + 6 mesi', () => {
        const r = resolveConfirmationDates({
            ...base,
            confirmations: [
                { date: '2024-07-12', outcome: 'OK' },
                { date: '2025-01-14', outcome: 'OK' },
            ],
        });
        expect(r).toEqual({ last_confirmation_date: '2025-01-14', next_confirmation_due: '2025-07-14' });
    });

    it('ordine non cronologico: prende comunque la data piu recente', () => {
        const r = resolveConfirmationDates({
            ...base,
            confirmations: ['2025-01-14', '2024-07-12'],
        });
        expect(r.last_confirmation_date).toBe('2025-01-14');
    });

    it('scarta righe senza data, negative o antecedenti/uguali a esame ed emissione', () => {
        const r = resolveConfirmationDates({
            ...base,
            confirmations: [
                { date: '2024-01-10' },
                { date: '2024-01-15' },
                { date: '2023-12-01' },
                { date: '2024-09-01', outcome: 'Negativo' },
                { date: null },
                { date: '2024-07-12', outcome: 'Positivo' },
            ],
        });
        expect(r.last_confirmation_date).toBe('2024-07-12');
        expect(r.next_confirmation_due).toBe('2025-01-12');
    });

    it('senza tabella usa last_confirmation_date solo se e una conferma reale', () => {
        expect(resolveConfirmationDates({ ...base, lastConfirmation: '2024-07-12' }))
            .toEqual({ last_confirmation_date: '2024-07-12', next_confirmation_due: '2025-01-12' });
        expect(resolveConfirmationDates({ ...base, lastConfirmation: '2024-01-10' }).last_confirmation_date)
            .toBeNull();
    });

    it('nessuna conferma: ultima null, prossima = data esame + 6 mesi (ISO 14732 §6.1/§6.2)', () => {
        expect(resolveConfirmationDates({ ...base, confirmations: [] }))
            .toEqual({ last_confirmation_date: null, next_confirmation_due: '2024-07-10' });
    });

    it('nessuna conferma e data esame assente: ripiega sull emissione', () => {
        expect(resolveConfirmationDates({ issueDate: '2024-01-15' }).next_confirmation_due).toBe('2024-07-15');
    });

    it('prossima esplicita successiva all ultima conferma si mantiene; incoerente si ricalcola', () => {
        expect(resolveConfirmationDates({
            ...base, confirmations: ['2024-07-12'], nextConfirmation: '2025-01-20',
        }).next_confirmation_due).toBe('2025-01-20');
        expect(resolveConfirmationDates({
            ...base, confirmations: ['2024-07-12'], nextConfirmation: '2024-03-01',
        }).next_confirmation_due).toBe('2025-01-12');
    });

    it('senza alcuna data restituisce null', () => {
        expect(resolveConfirmationDates({}))
            .toEqual({ last_confirmation_date: null, next_confirmation_due: null });
    });
});

describe('mapPipelineFieldsToReview — conferme ISO 14732', () => {
    it('usa la tabella conferme restituita dall AI', () => {
        const r = mapPipelineFieldsToReview({
            operator_name: 'ROSSI MARIO',
            certificate_number: 'OP-0001',
            exam_date: '2024-01-10',
            expiry_date: '2030-01-09',
            confirmations: [{ date: '2024-07-12' }, { date: '2025-01-14' }],
        }, '', 'op.pdf');
        expect(r.last_confirmation_date).toBe('2025-01-14');
        expect(r.next_confirmation_due).toBe('2025-07-14');
    });

    it('senza conferme: next = esame + 6 mesi e nessuna ultima conferma', () => {
        const r = mapPipelineFieldsToReview({
            operator_name: 'ROSSI MARIO',
            certificate_number: 'OP-0001',
            exam_date: '2024-01-10',
            expiry_date: '2030-01-09',
        }, '', 'op.pdf');
        expect(r.last_confirmation_date).toBeNull();
        expect(r.next_confirmation_due).toBe('2024-07-10');
    });
});

describe('stato salvato coerente con la scadenza effettiva', () => {
    const today = '2026-10-08';

    it('14732 con conferma scaduta ma expiry lontana -> scaduta (stessa funzione di effective_expiry_date)', () => {
        expect(deriveQualificationStatus({
            status: 'valida', expiry_date: '2030-01-09', next_confirmation_due: '2025-07-14', qualification_type: OP14732,
        }, today)).toBe('scaduta');
    });

    it('14732 con conferma futura -> resta valida', () => {
        expect(deriveQualificationStatus({
            status: 'valida', expiry_date: '2030-01-09', next_confirmation_due: '2027-01-14', qualification_type: OP14732,
        }, today)).toBe('valida');
    });

    it('9606: stessa regola con conferma semestrale', () => {
        expect(deriveQualificationStatus({
            status: 'valida', expiry_date: '2030-01-09', next_confirmation_due: '2025-07-14',
            qualification_type: 'Saldatore ISO 9606-1',
        }, today)).toBe('scaduta');
    });

    it('altri tipi (NDT): la conferma non incide, conta solo expiry_date', () => {
        expect(deriveQualificationStatus({
            status: 'valida', expiry_date: '2030-01-09', next_confirmation_due: '2025-07-14',
            qualification_type: 'Operatore NDT ISO 9712',
        }, today)).toBe('valida');
        expect(deriveQualificationStatus({
            status: 'valida', expiry_date: '2025-01-09', qualification_type: 'Operatore NDT ISO 9712',
        }, today)).toBe('scaduta');
    });

    it('sospesa/revocata non vengono toccate', () => {
        expect(deriveQualificationStatus({
            status: 'sospesa', expiry_date: '2020-01-01', qualification_type: OP14732,
        }, today)).toBe('sospesa');
    });

    it('il commit salva status scaduta quando la conferma effettiva e passata', async () => {
        const dupCheckReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] }) };
        const insertReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 701 }] }) };
        let n = 0;
        getPool.mockResolvedValue({ request: jest.fn(() => (++n === 1 ? dupCheckReq : insertReq)) });

        await commitQualificationFromFields({
            operator_name: 'ROSSI MARIO',
            certificate_number: 'OP-0001',
            exam_date: '2024-01-10',
            expiry_date: '2099-01-09',
            last_confirmation_date: '2024-07-12',
            next_confirmation_due: '2025-01-12',
        }, 10, 20, { qualificationType: OP14732 });

        expect(insertReq.input).toHaveBeenCalledWith('status', 'scaduta');
        expect(insertReq.input).toHaveBeenCalledWith('nextConfDue', '2025-01-12');
    });

    it('il commit salva status valida con conferma futura', async () => {
        const dupCheckReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] }) };
        const insertReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 702 }] }) };
        let n = 0;
        getPool.mockResolvedValue({ request: jest.fn(() => (++n === 1 ? dupCheckReq : insertReq)) });

        await commitQualificationFromFields({
            operator_name: 'ROSSI MARIO',
            certificate_number: 'OP-0002',
            exam_date: '2024-01-10',
            expiry_date: '2099-01-09',
            next_confirmation_due: '2098-01-12',
        }, 10, 20, { qualificationType: OP14732 });

        expect(insertReq.input).toHaveBeenCalledWith('status', 'valida');
    });
});

describe('DATE_PATTERNS — anno a 2 cifre', () => {
    const TWO = { includeTwoDigitYear: true };

    it.each([
        ['15.03.24', '2024-03-15'],
        ['15/03/24', '2024-03-15'],
        ['1.2.69', '2069-02-01'],
        ['01.02.70', '1970-02-01'],
        ['31.12.99', '1999-12-31'],
    ])('%s -> %s', (raw, iso) => {
        expect(allDates(`Data: ${raw}`, TWO)).toContain(iso);
    });

    it('non confonde date a 4 cifre ne produce duplicati spurii', () => {
        expect(allDates('Data 15.03.2024', TWO)).toEqual(['2024-03-15']);
    });

    it('scarta valori implausibili (mese/giorno fuori range, numeri di versione)', () => {
        expect(allDates('rev 45.13.24', TWO)).toEqual([]);
        expect(allDates('rev 12.30.24', TWO)).toEqual([]);
        expect(allDates('cod 1.2.3.45', TWO)).toEqual([]);
        expect(allDates('ref 15.03.24.7', TWO)).toEqual([]);
    });

    it('di default allDates ignora l anno a 2 cifre (tabelle conferme/testo libero)', () => {
        expect(allDates('Data: 15.03.24')).toEqual([]);
        expect(allDates('15.03.24 e 16.03.2025')).toEqual(['2025-03-16']);
    });

    it('le date con etichetta accettano l anno a 2 cifre', () => {
        const out = extractCertNdtFields('Certificate\nData di emissione: 15.03.24\nData di scadenza: 14.03.29', 'x.pdf');
        expect(out.exam_date).toBe('2024-03-15');
        expect(out.expiry_date).toBe('2029-03-14');
    });

    it('esame a 4 cifre + scadenza etichettata a 2 cifre: scadenza letta, non copiata dall esame', () => {
        const text = 'Operator qualification\nDate of test 10.01.2024\nValid until 09.01.30';
        expect(extractQualifica14732Fields(text, 'x.pdf').expiry_date).toBe('2030-01-09');
        expect(extractPatentinoFields(text, 'x.pdf').expiry_date).toBe('2030-01-09');
    });

    it('una sola data: scadenza null (non uguale all esame)', () => {
        const text = 'Operator qualification\nDate of test 10.01.2024';
        expect(extractQualifica14732Fields(text, 'x.pdf').expiry_date).toBeNull();
        expect(extractPatentinoFields(text, 'x.pdf').expiry_date).toBeNull();
    });

    it('conferme a 2 cifre in tabella non sostituiscono la scadenza del fallback 14732/patentino', () => {
        const text = [
            'Operator qualification',
            'Date of test 10.01.2024',
            'Valid until 09.01.2030',
            'Confirmations: 12.07.24 OK  14.01.25 OK  15.07.25 OK',
        ].join('\n');
        const f14732 = extractQualifica14732Fields(text, 'x.pdf');
        expect(f14732.expiry_date).toBe('2030-01-09');
        expect(extractPatentinoFields(text, 'x.pdf').expiry_date).toBe('2030-01-09');
    });
});

describe('prompt AI qualifica_14732', () => {
    it('descrive la tabella conferme di pagina 2 e l array confirmations', () => {
        const { DOCUMENT_TYPE_SCHEMAS } = require('../data/documentTypeSchemas');
        const prompt = DOCUMENT_TYPE_SCHEMAS.qualifica_14732.aiPrompt;
        expect(prompt).toMatch(/CONFERME PERIODICHE/);
        expect(prompt).toMatch(/confirmations/);
        expect(prompt).toMatch(/6\.2/);
    });
});
