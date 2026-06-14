/**
 * Whitelist CORS: origini statiche da env + pattern Netlify Deploy Preview / branch deploy.
 * Non usare origin: true — solo match espliciti sul sito systemgest.
 */

const NETLIFY_SYSTEMGEST_PATTERNS = [
    // Deploy Preview PR: deploy-preview-12--systemgest.netlify.app
    /^https:\/\/deploy-preview-\d+--systemgest\.netlify\.app$/,
    // Branch deploy: feat-import-pdf--systemgest.netlify.app (copre anche deploy-preview-*)
    /^https:\/\/[a-z0-9][a-z0-9-]*--systemgest\.netlify\.app$/,
];

/**
 * @param {string | undefined | null} origin
 * @param {string[]} staticOrigins - da CORS_ORIGIN (split virgola)
 * @returns {boolean}
 */
function isAllowedCorsOrigin(origin, staticOrigins) {
    if (!origin) {
        return true;
    }
    if (staticOrigins.includes(origin)) {
        return true;
    }
    return NETLIFY_SYSTEMGEST_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Origini statiche per helmet frame-ancestors (solo URL espliciti da env).
 * I preview Netlify non sono elencabili staticamente; l'embedding PDF da preview
 * può richiedere estensione futura se necessario.
 *
 * @param {string} corsOriginEnv
 * @returns {string[]}
 */
function parseStaticCorsOrigins(corsOriginEnv) {
    return (corsOriginEnv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * Callback origin per il middleware cors.
 *
 * @param {string | undefined} origin
 * @param {string[]} staticOrigins
 * @param {(err: Error | null, allow?: boolean) => void} callback
 */
function corsOriginCallback(origin, staticOrigins, callback) {
    if (isAllowedCorsOrigin(origin, staticOrigins)) {
        callback(null, true);
    } else {
        callback(new Error(`CORS blocked: ${origin}`));
    }
}

module.exports = {
    NETLIFY_SYSTEMGEST_PATTERNS,
    isAllowedCorsOrigin,
    parseStaticCorsOrigins,
    corsOriginCallback,
};
