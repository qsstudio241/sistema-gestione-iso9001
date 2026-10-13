/**
 * @jest-environment node
 *
 * Check mirato (PR #781): nei file nuovi/toccati dal riconoscimento tipo del batch qualifiche
 * non devono comparire apostrofi al posto delle lettere accentate (testi UI e messaggi).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILES = [
    'backend/src/services/qualificationDocTypeClassifier.service.js',
    'backend/src/services/qualificationDocTypeClassifier.service.test.js',
    'backend/src/services/qualificationIngest.autoDetect.test.js',
    'backend/src/services/documentIngestPipeline.preExtracted.test.js',
    'app/src/components/QualificationUploadButton.jsx',
    'app/src/tests/qualificationUploadButton.test.jsx',
];

// Parole italiane accentate scritte con apostrofo (es. «piu'» al posto di «più»), con o senza escape.
const WORDS = ['piu', 'gia', 'qualita', 'puo', 'perche', 'cosi', 'pero', 'ne', 'e', 'funzionalita', 'validita'];
const APOSTROPHE_ACCENT = new RegExp(`(?<![A-Za-z])(?:${WORDS.join('|')})\\\\?'(?![A-Za-z])`, 'g');

describe('qualifiche batch: niente apostrofo al posto dell\'accento nei file toccati', () => {
    it.each(FILES)('%s', (rel) => {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const hits = [];
        src.split('\n').forEach((line, i) => {
            const m = line.match(APOSTROPHE_ACCENT);
            if (m) hits.push(`${rel}:${i + 1}: ${m.join(', ')}`);
        });
        expect(hits).toEqual([]);
    });

    it('le motivazioni del classificatore mostrate in UI non contengono apostrofi al posto degli accenti', () => {
        const { classifyByRules } = require('./qualificationDocTypeClassifier.service');
        const reasons = [
            ...classifyByRules('Patentino saldatore e welding operator', 'a.pdf').reasons,
            ...classifyByRules('', 'ZZ_14732.pdf').reasons,
            ...classifyByRules('ISO 9606-1 welder; ISO 9712', 'a.pdf').reasons,
            ...classifyByRules('Fattura 12', 'a.pdf').reasons,
        ].join(' | ');
        expect(reasons).not.toMatch(APOSTROPHE_ACCENT);
        expect(reasons).toMatch(/più/);
    });
});
