const {
    isChecklistWrite,
    isAiAssistRequest,
    retryAfterSeconds,
    rateLimitHandler,
} = require('./rateLimitPolicy');

describe('isChecklistWrite', () => {
    it('le letture di aziende, audit e sessione non sono scritture checklist', () => {
        expect(isChecklistWrite({ method: 'GET', path: '/api/v1/companies' })).toBe(false);
        expect(isChecklistWrite({ method: 'GET', path: '/api/v1/audits' })).toBe(false);
        expect(isChecklistWrite({ method: 'GET', path: '/api/v1/auth/me' })).toBe(false);
        expect(isChecklistWrite({ method: 'POST', path: '/api/v1/auth/login' })).toBe(false);
    });

    it('eventi, risposte e sync audit sono scritture checklist', () => {
        expect(isChecklistWrite({
            method: 'POST',
            baseUrl: '/api/v1',
            path: '/audits/982B481F-5658-4CCF-9086-72B36D4F33A5/events',
        })).toBe(true);
        expect(isChecklistWrite({
            method: 'POST',
            path: '/api/v1/audits/35234/responses/bulk',
        })).toBe(true);
        expect(isChecklistWrite({
            method: 'POST',
            path: '/api/v1/audits/sync',
        })).toBe(true);
    });

    it('l\'assistente AI non è una scrittura checklist', () => {
        expect(isChecklistWrite({
            method: 'POST',
            path: '/api/v1/ai/suggest',
        })).toBe(false);
    });
});

describe('isAiAssistRequest', () => {
    it('conclusioni, feedback, domanda e chat hanno il tetto AI', () => {
        expect(isAiAssistRequest({ method: 'POST', path: '/api/v1/ai/suggest' })).toBe(true);
        expect(isAiAssistRequest({ method: 'POST', baseUrl: '/api/v1', path: '/ai/feedback' })).toBe(true);
        expect(isAiAssistRequest({ method: 'POST', path: '/api/v1/ai/question-assistant' })).toBe(true);
        expect(isAiAssistRequest({ method: 'POST', path: '/api/v1/ai/chat' })).toBe(true);
    });

    it('letture, salvataggi checklist e altre API non consumano il tetto AI', () => {
        expect(isAiAssistRequest({ method: 'GET', path: '/api/v1/ai/suggest' })).toBe(false);
        expect(isAiAssistRequest({ method: 'POST', path: '/api/v1/audits/sync' })).toBe(false);
        expect(isAiAssistRequest({ method: 'POST', path: '/api/v1/audits/35234/responses/bulk' })).toBe(false);
        expect(isAiAssistRequest({ method: 'GET', path: '/api/v1/audits' })).toBe(false);
    });
});

describe('rateLimitHandler', () => {
    it('risponde 429 con Retry-After', () => {
        const headers = {};
        const res = {
            setHeader: (k, v) => { headers[k] = v; },
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; },
        };
        const reset = new Date(Date.now() + 12500);
        rateLimitHandler(
            { rateLimit: { resetTime: reset } },
            res,
            () => {},
            {
                windowMs: 60000,
                statusCode: 429,
                message: { error: 'Troppe richieste. Riprova tra qualche minuto.', code: 'RATE_LIMIT_API' },
            },
        );
        expect(res.statusCode).toBe(429);
        expect(res.body.code).toBe('RATE_LIMIT_API');
        expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(12);
        expect(Number(headers['Retry-After'])).toBeLessThanOrEqual(13);
    });

    it('senza resetTime usa la finestra', () => {
        expect(retryAfterSeconds({}, 15000)).toBe(15);
    });
});
