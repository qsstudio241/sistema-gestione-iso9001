const {
    isAllowedCorsOrigin,
    parseStaticCorsOrigins,
} = require('./corsOrigins');

const STATIC = [
    'https://systemgest.netlify.app',
    'https://busato.selfip.com',
];

describe('corsOrigins', () => {
    describe('parseStaticCorsOrigins', () => {
        it('splitta e trimma CORS_ORIGIN', () => {
            expect(
                parseStaticCorsOrigins('https://a.app , https://b.app')
            ).toEqual(['https://a.app', 'https://b.app']);
        });
    });

    describe('isAllowedCorsOrigin', () => {
        it('accetta origini statiche da env', () => {
            expect(isAllowedCorsOrigin('https://systemgest.netlify.app', STATIC)).toBe(true);
            expect(isAllowedCorsOrigin('https://busato.selfip.com', STATIC)).toBe(true);
        });

        it('accetta Deploy Preview Netlify systemgest', () => {
            const origin = 'https://deploy-preview-42--systemgest.netlify.app';
            expect(isAllowedCorsOrigin(origin, STATIC)).toBe(true);
        });

        it('accetta branch deploy Netlify systemgest', () => {
            const origin = 'https://feat-import-pdf-button-ux--systemgest.netlify.app';
            expect(isAllowedCorsOrigin(origin, STATIC)).toBe(true);
        });

        it('rifiuta altri siti Netlify', () => {
            expect(
                isAllowedCorsOrigin('https://deploy-preview-1--other-site.netlify.app', STATIC)
            ).toBe(false);
        });

        it('rifiuta origini non HTTPS o arbitrarie', () => {
            expect(isAllowedCorsOrigin('https://evil.example.com', STATIC)).toBe(false);
            expect(isAllowedCorsOrigin('http://systemgest.netlify.app', STATIC)).toBe(false);
        });

        it('accetta richieste senza Origin (same-origin / curl)', () => {
            expect(isAllowedCorsOrigin(undefined, STATIC)).toBe(true);
            expect(isAllowedCorsOrigin(null, STATIC)).toBe(true);
        });
    });
});
