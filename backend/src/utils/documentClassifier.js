'use strict';

/**
 * documentClassifier.js
 * Classificatore tipo documento da testo PDF estratto.
 * Usato da wpqrIngest.service.js e qualificationIngest.service.js
 * per bloccare documenti caricati nel modulo sbagliato.
 */

/**
 * Analizza il testo estratto da un PDF e assegna un tipo documento
 * tramite keyword scoring (case-insensitive).
 *
 * @param {string} text - Testo estratto da pdf-parse
 * @returns {{ detected_type: string, confidence: string, score: number, all_scores: object }}
 */
function classifyDocument(text) {
    const t = (text || '').toLowerCase();

    const scores = {
        wpqr:          0,
        wps:           0,
        welder_qual:   0,
        operator_qual: 0,
        coordinator:   0,
        ndt:           0,
    };

    // --- WPQR signals ---
    if (/\b(wpqr|pqr|procedure qualification record|qualifica(?:tion)? di procedura)\b/.test(t)) scores.wpqr += 3;
    if (/\b(iso\s*15614|en\s*iso\s*15614|15614)\b/.test(t)) scores.wpqr += 3;
    if (/\b(test piece|provino|giunto di prova|coupon)\b/.test(t)) scores.wpqr += 2;
    if (/\b(examiner|esaminatore|esaminatrice|notified body|organismo notificato)\b/.test(t)) scores.wpqr += 1;
    if (/\b(trazione|bending|piega|hardness|durez|macro|impatto|charpy)\b/.test(t)) scores.wpqr += 2;

    // --- WPS signals ---
    if (/\b(welding procedure specification|wps|istruzione operativa di saldatura)\b/.test(t)) scores.wps += 3;
    if (/\b(preheat|preriscaldo|interpass|calore apportato|heat input)\b/.test(t)) scores.wps += 2;

    // --- Welder qualification signals ---
    if (/\b(iso\s*9606|en\s*iso\s*9606|9606)\b/.test(t)) scores.welder_qual += 4;
    if (/\b(welder|saldatore|patentino|certificate of qualification|qualifica(?:tion)? of welder)\b/.test(t)) scores.welder_qual += 2;
    if (/\b(validity|validit|renewal|rinnovo)\b/.test(t)) scores.welder_qual += 1;

    // --- Operator qualification signals ---
    if (/\b(iso\s*14732|en\s*iso\s*14732|14732)\b/.test(t)) scores.operator_qual += 4;
    if (/\b(welding operator|operatore)\b/.test(t)) scores.operator_qual += 2;
    // Titolo tipico certificato TEC-Eurolab / enti: batte i falsi positivi WPQR da §4.1
    if (/\b(certificat[oa]\s+di\s+qualifica\s+(?:di\s+)?operatore|approval\s+test\s+certificate\s+for\s+welding\s+operator|operator\s+according\s+to)\b/.test(t)) {
        scores.operator_qual += 5;
    }

    // --- Coordinator signals ---
    if (/\b(iso\s*14731|en\s*iso\s*14731|14731|iwe|iwt|iws|iwip|ewe|ewt|ews)\b/.test(t)) scores.coordinator += 4;
    if (/\b(coordinatore|coordinator|responsible welding)\b/.test(t)) scores.coordinator += 2;

    // --- NDT signals ---
    if (/\b(iso\s*9712|en\s*iso\s*9712|9712|ndt|vt|pt|mt|ut|rt)\b/.test(t)) scores.ndt += 2;
    if (/\b(non.destructive|non distruttiv|testing personnel|livello\s*[123]|level\s*[123])\b/.test(t)) scores.ndt += 2;

    // ISO 14732 §4.1: i certificati operatore citano WPQR / ISO 15614 / "test pieces"
    // come *base* della qualifica, non perché siano una WPQR. Stesso schema sui
    // patentini 9606 che richiamano procedure. Se la norma personale è esplicita,
    // attutisci i punti WPQR/WPS derivanti da quei riferimenti.
    const hasExplicitOperatorNorm = /\b14732\b/.test(t) && scores.operator_qual >= 4;
    const hasExplicitWelderNorm = /\b9606\b/.test(t) && scores.welder_qual >= 4;
    const citesWpqrAsBasis = /\b(qualificazione\s+basata\s+su|qualification\s+based\s+on)\b/.test(t)
        || /\bwpqr\s+in\s+(?:accordo|accordance)\b/.test(t)
        || /\bin\s+accordo\s+con\s+le\s+parti\s+rilevanti\s+della\s+iso\s*15614\b/.test(t);
    if ((hasExplicitOperatorNorm || hasExplicitWelderNorm) && citesWpqrAsBasis) {
        scores.wpqr = Math.min(scores.wpqr, 2);
        scores.wps = Math.min(scores.wps, 1);
    }
    if (hasExplicitOperatorNorm && scores.operator_qual >= scores.wpqr) {
        // Garanzia: norma 14732 + segnale operatore vincono su WPQR residua
        scores.wpqr = Math.min(scores.wpqr, scores.operator_qual - 1);
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topType, topScore] = sorted[0];
    const confidence = topScore >= 4 ? 'high' : topScore >= 2 ? 'medium' : 'low';

    return {
        detected_type: topScore > 0 ? topType : 'unknown',
        confidence,
        score: topScore,
        all_scores: scores,
    };
}

// Tipi che NON appartengono al modulo WPQR/WPS
const WRONG_MODULE_FOR_WPQR = new Set(['welder_qual', 'operator_qual', 'coordinator', 'ndt']);

// Tipi che NON appartengono al modulo Qualifiche personale
const WRONG_MODULE_FOR_QUALIFICATIONS = new Set(['wpqr', 'wps']);

const WRONG_MODULE_MESSAGES = {
    welder_qual:   'Questo documento sembra una qualifica personale saldatore (ISO 9606). Caricarlo nel modulo Qualifiche.',
    operator_qual: 'Questo documento sembra una qualifica operatore (ISO 14732). Caricarlo nel modulo Qualifiche.',
    coordinator:   'Questo documento sembra una qualifica coordinatore (ISO 14731 / IWE / IWT). Caricarlo nel modulo Qualifiche.',
    ndt:           'Questo documento sembra una qualifica NDT (EN ISO 9712). Caricarlo nel modulo Qualifiche.',
    wpqr:          'Questo documento sembra una WPQR/PQR (ISO 15614). Caricarlo nel modulo Saldatura \u2192 WPQR.',
    wps:           'Questo documento sembra una WPS (Welding Procedure Specification). Caricarlo nel modulo Saldatura \u2192 WPS.',
};

const SUGGESTED_MODULE = {
    welder_qual:   '/qualifiche',
    operator_qual: '/qualifiche',
    coordinator:   '/qualifiche',
    ndt:           '/qualifiche',
    wpqr:          '/saldatura',
    wps:           '/saldatura',
};

module.exports = {
    classifyDocument,
    WRONG_MODULE_FOR_WPQR,
    WRONG_MODULE_FOR_QUALIFICATIONS,
    WRONG_MODULE_MESSAGES,
    SUGGESTED_MODULE,
};
