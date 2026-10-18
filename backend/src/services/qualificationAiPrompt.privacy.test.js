/**
 * @jest-environment node
 *
 * A2 privacy: nel prompt di CONTORNO verso l'AI (nome file, retry, few-shot per organizzazione,
 * pattern di riferimento) non compaiono nome file, nomi di persona, numeri certificato, datore.
 * Il testo del documento resta inviato (residuo A3). Fixture sintetiche: nomi/numeri fittizi.
 */

jest.mock('./aiProviderAdapter', () => ({ chat: jest.fn(), getActiveProvider: jest.fn(), embed: jest.fn() }));
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/importPdfText', () => ({
    extractPdfText: jest.fn(),
    confidenceFromTextLength: jest.fn(() => 70),
}));
jest.mock('../utils/ocrExtractor', () => ({
    extractTextWithOCR: jest.fn(() => Promise.reject(new Error('OCR non disponibile nei test'))),
    extractHeaderTextWithOCR: jest.fn(() => Promise.resolve('')),
}));

const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { query } = require('../config/database');
const { extractPdfText } = require('../utils/importPdfText');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const { PLACEHOLDERS } = require('../utils/aiPromptPrivacy');

const FILE_NAME = '77-12345_ZZBIANCHI ZZLUCA_14732_Officine-ZZ.pdf';
const DOC_TEXT = 'Welder qualification certificate ISO 9606-1 135 P BW FM1 S t10 PA\n'
    + 'Name: ZZNUOVOTITOLARE Certificate No: 25-00000-00-001 Date of test 10.01.2025\n'.repeat(2);

const LEAKS = [
    'ZZBIANCHI', 'ZZLUCA', '77-12345', 'Officine-ZZ', FILE_NAME,
    'ZZ-STORICO/2024', 'Officine Storiche ZZ Srl', 'zzluca.bianchi@example.test',
    'ZZBNCL80A01H501U', 'W-ZZ-CLIENTE-9',
];

const FEEDBACK_ROW = {
    file_name: FILE_NAME,
    action: 'corrected',
    ai_payload_json: JSON.stringify({
        welder_name: 'ZZBIANCHI',
        certificate_number: 'ZZ-STORICO/2024',
        welding_process: '141',
        thickness_min_mm: 3,
        standard_reference: 'ISO 9606-1:2017',
    }),
    human_payload_json: JSON.stringify({
        welder_name: 'ZZBIANCHI ZZLUCA',
        operator_name: 'ZZBIANCHI ZZLUCA',
        person_name: 'ZZBIANCHI ZZLUCA',
        certificate_number: 'ZZ-STORICO/2024',
        employer: 'Officine Storiche ZZ Srl',
        wps_number: 'W-ZZ-CLIENTE-9',
        welding_process: '135',
        thickness_min_mm: 3,
        standard_reference: 'ISO 9606-1:2017',
        weld_details: 'Prova di ZZLUCA ZZBIANCHI (zzluca.bianchi@example.test, CF ZZBNCL80A01H501U)',
    }),
    field_diffs_json: JSON.stringify({
        welder_name: { ai: 'ZZBIANCHI', human: 'ZZBIANCHI ZZLUCA' },
        certificate_number: { ai: null, human: 'ZZ-STORICO/2024' },
        welding_process: { ai: '141', human: '135' },
    }),
};

const PATTERN_ROWS = [
    { field_key: 'reference_number', from_pattern: 'ZZ-STORICO/2024', to_pattern: 'W-ZZ-CLIENTE-9', hit_count: 9 },
    { field_key: 'welding_process', from_pattern: '141', to_pattern: '135', hit_count: 7 },
];

function mockDb() {
    query.mockImplementation(async (sql) => {
        if (String(sql).includes('ingest_reference_patterns')) return { recordset: PATTERN_ROWS };
        if (String(sql).includes('import_extraction_feedback')) return { recordset: [FEEDBACK_ROW] };
        return { recordset: [] };
    });
}

const sentPrompts = () => chat.mock.calls.map((c) => c[0].map((m) => m.content).join('\n---\n'));
const allSent = () => sentPrompts().join('\n=====\n');

async function ingest(docType) {
    extractPdfText.mockResolvedValue(DOC_TEXT);
    return runDocumentIngest({
        pdfBuffer: Buffer.from('%PDF'), docType, fileName: FILE_NAME, organizationId: 1001,
    });
}

describe('prompt AI qualifiche: nessuna PII nel contorno', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.INGEST_HEADER_OCR;
        getActiveProvider.mockReturnValue('gemini');
        mockDb();
    });

    it.each(['patentino_saldatore', 'qualifica_14732'])('%s: primo tentativo + retry JSON senza nome file/PII, con segnaposto', async (docType) => {
        chat
            .mockResolvedValueOnce({ content: 'non e JSON', model: 'm' })
            .mockResolvedValueOnce({ content: '{"welding_process":"135"}', model: 'm' });

        await ingest(docType);

        expect(chat).toHaveBeenCalledTimes(2);
        const sent = allSent();
        for (const leak of LEAKS) expect(sent).not.toContain(leak);

        const [primary, retry] = sentPrompts();
        expect(primary).toContain('Esempi dalla tua organizzazione');
        expect(primary).toContain(PLACEHOLDERS.FILE);
        expect(primary).toContain(PLACEHOLDERS.NOME);
        expect(primary).toContain(PLACEHOLDERS.NUMERO_CERTIFICATO);
        expect(primary).toContain(PLACEHOLDERS.DATORE);
        expect(primary).toContain(PLACEHOLDERS.NUMERO_WPS_WPQR);
        expect(primary).toContain(PLACEHOLDERS.EMAIL);
        expect(primary).toContain(PLACEHOLDERS.CODICE_FISCALE);
        // Campi non personali degli esempi restano.
        expect(primary).toContain('"welding_process":"135"');
        expect(primary).toContain('ISO 9606-1:2017');
        expect(primary).toContain('"thickness_min_mm":3');
        expect(retry).toContain(`(file ${PLACEHOLDERS.FILE})`);
        // Pattern per numeri riferimento scartato, pattern tecnico mantenuto.
        expect(primary).toContain('Campo "welding_process"');
        expect(primary).not.toContain('Campo "reference_number"');
    });

    it('formato del prompt e dello schema invariato: istruzioni, JSON richiesto, chiavi retry', async () => {
        chat
            .mockResolvedValueOnce({ content: 'non e JSON', model: 'm' })
            .mockResolvedValueOnce({ content: '{"welding_process":"135"}', model: 'm' });
        await ingest('patentino_saldatore');
        const [primary, retry] = sentPrompts();
        expect(primary).toContain('"type_specific_data": { /* campi specifici del tipo documento');
        expect(primary).toContain('Istruzioni specifiche per il tipo documento');
        expect(primary).toContain('Testo documento:');
        expect(retry).toContain('JSON piatto con chiavi: welder_name, certificate_number, issuing_body');
        // Il documento stesso resta inviato all'AI (residuo A3).
        expect(primary).toContain('ISO 9606-1 135 P BW FM1 S t10 PA');
        expect(retry).toContain('Welder qualification certificate');
        expect(chat.mock.calls[0][1]).toMatchObject({ temperature: 0.2, responseFormat: 'json' });
        expect(chat.mock.calls[1][1]).toMatchObject({ temperature: 0.1, responseFormat: 'json', maxTokens: 2500 });
    });

    it('regressione estrazione: stessi campi con AI mock su testo sintetico, il documento reale e letto per intero', async () => {
        chat.mockResolvedValue({
            content: JSON.stringify({
                title: 'Patentino',
                type_specific_data: {
                    welder_name: 'ZZNUOVOTITOLARE',
                    certificate_number: '25-00000-00-001',
                    welding_process: '135',
                    thickness_min_mm: 3,
                    exam_date: '2025-01-10',
                },
            }),
            model: 'm',
        });
        const out = await ingest('patentino_saldatore');
        expect(out.fields.welder_name).toBe('ZZNUOVOTITOLARE');
        expect(out.fields.certificate_number).toBe('25-00000-00-001');
        expect(out.fields.welding_process).toBe('135');
        expect(out.fields.exam_date).toBe('2025-01-10');
        const user = chat.mock.calls[0][0].find((m) => m.role === 'user').content;
        expect(user).toContain('ZZNUOVOTITOLARE');
        expect(user).toContain('25-00000-00-001');
    });

    it('un segnaposto ricopiato dall\'AI non finisce nei campi estratti', async () => {
        chat.mockResolvedValue({
            content: JSON.stringify({
                type_specific_data: {
                    welder_name: '[NOME]',
                    certificate_number: '25-00000-00-001',
                    welding_process: '135',
                },
            }),
            model: 'm',
        });
        const out = await ingest('patentino_saldatore');
        expect(out.fields.welder_name).not.toBe('[NOME]');
        expect(out.fields.certificate_number).toBe('25-00000-00-001');
    });

    it('i dati salvati non cambiano: la redazione e solo in lettura (nessuna scrittura DB)', async () => {
        chat.mockResolvedValue({ content: '{"type_specific_data":{"welding_process":"135"}}', model: 'm' });
        await ingest('patentino_saldatore');
        const writes = query.mock.calls.filter((c) => /\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(String(c[0])));
        expect(writes).toHaveLength(0);
    });
});
