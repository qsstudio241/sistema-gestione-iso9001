/**
 * Il salvataggio checklist non condivide il tetto delle letture
 * (aziende, audit, sessione). Un audit lungo non deve bloccare la navigazione.
 */

function requestPath(req) {
    return `${req.baseUrl || ''}${req.path || ''}`;
}

function isChecklistWrite(req) {
    const method = String(req?.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
    const path = requestPath(req);
    return /\/audits\/[^/]+\/events\/?$/.test(path)
        || /\/audits\/[^/]+\/responses(\/bulk)?\/?$/.test(path)
        || /\/audits\/sync\/?$/.test(path);
}

function userOrIpKey(req) {
    try {
        const auth = req.headers?.authorization || '';
        if (auth.startsWith('Bearer ')) {
            const payload = JSON.parse(
                Buffer.from(auth.split('.')[1], 'base64url').toString('utf8')
            );
            const uid = payload.user_id || payload.id || payload.sub;
            if (uid) return `user:${uid}`;
        }
    } catch (_) { /* token assente o malformato */ }
    return req.ip;
}

function retryAfterSeconds(req, windowMs) {
    const reset = req.rateLimit?.resetTime;
    if (reset instanceof Date && !Number.isNaN(reset.getTime())) {
        return Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000));
    }
    return Math.max(1, Math.ceil((Number(windowMs) || 60000) / 1000));
}

function rateLimitHandler(req, res, _next, options) {
    const seconds = retryAfterSeconds(req, options.windowMs);
    res.setHeader('Retry-After', String(seconds));
    const body = options.message && typeof options.message === 'object'
        ? options.message
        : { error: 'Troppe richieste. Riprova tra qualche minuto.', code: 'RATE_LIMIT_API' };
    res.status(options.statusCode || 429).json(body);
}

module.exports = {
    isChecklistWrite,
    userOrIpKey,
    retryAfterSeconds,
    rateLimitHandler,
};
