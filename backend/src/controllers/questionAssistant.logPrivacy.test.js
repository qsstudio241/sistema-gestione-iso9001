/**
 * Privacy log: il nome dell'allegato (puo' contenere il titolare) non finisce nei log.
 *
 * Il test esistente `questionAssistant.controller.test.js` e' rosso su main per una causa
 * indipendente (le routes importano `authenticate`, il mock di auth.middleware espone solo
 * `verifyToken`). Qui si chiama direttamente `handleQuestionAssistant` senza passare dalle routes.
 */
jest.mock('../config/database', () => ({ query: jest.fn().mockResolvedValue({ recordset: [] }) }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/aiProviderAdapter', () => ({
    chat: jest.fn().mockResolvedValue('**Esito suggerito:** C (Conforme)'),
}));
jest.mock('./aiChat.controller', () => ({
    checkNormSourceAvailability: jest.fn().mockResolvedValue({ has_chunks: false }),
}));
jest.mock('../services/normChunker.service', () => ({ searchSimilar: jest.fn().mockResolvedValue([]) }));
jest.mock('../services/documentTextExtractor.service', () => ({ extractDocumentText: jest.fn() }));
jest.mock('../services/moduleLicense.service', () => ({ hasLicensedModule: jest.fn().mockReturnValue(true) }));

const logger = require('../utils/logger');
const { chat } = require('../services/aiProviderAdapter');
const { redactFileNameForLog } = require('../utils/ingestErrorMessage');
const { handleQuestionAssistant } = require('./questionAssistant.controller');

const ATT_NAME = '99-00000_ROSSI MARIO.pdf';

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function request() {
    return {
        user: { id: 1, organization_id: 1001, role: 'admin' },
        body: {
            mode: 'conformity_assessment',
            question: { text: 'Domanda fittizia', standardCode: 'ISO_9001_2015' },
            attachments: [{ name: ATT_NAME, type: 'application/pdf' }],
        },
    };
}

function allLogs() {
    return ['info', 'warn', 'error', 'debug'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n').toLowerCase();
}

function expectNoAttachmentNameLeak() {
    const logged = allLogs();
    for (const leak of ['rossi', 'mario', '99-00000', ATT_NAME]) expect(logged).not.toContain(leak.toLowerCase());
}

describe('questionAssistant: nome allegato nei log', () => {
    beforeEach(() => jest.clearAllMocks());

    it('riga "text extraction skippato": file#hash.pdf, risposta e prompt con il nome reale', async () => {
        const res = mockRes();
        await handleQuestionAssistant(request(), res);

        expect(logger.info).toHaveBeenCalledWith(
            `[questionAssistant] Allegato ${redactFileNameForLog(ATT_NAME)} \u2014 text extraction skippato (pre-calcolo frontend)`,
        );
        expect(res.json.mock.calls[0][0].success).toBe(true);
        expect(JSON.stringify(chat.mock.calls[0][0])).toContain(ATT_NAME);
        expectNoAttachmentNameLeak();
    });

    it('riga "Errore estrazione": file#hash.pdf (percorso catch forzato con logger.info che lancia)', async () => {
        logger.info.mockImplementation((msg) => {
            if (String(msg).includes('text extraction skippato')) throw new Error('boom');
        });
        const res = mockRes();
        await handleQuestionAssistant(request(), res);

        expect(logger.warn).toHaveBeenCalledWith(`[questionAssistant] Errore estrazione ${redactFileNameForLog(ATT_NAME)}:`, 'boom');
        expect(res.json.mock.calls[0][0].success).toBe(true);
        logger.info.mockReset();
        expectNoAttachmentNameLeak();
    });
});
