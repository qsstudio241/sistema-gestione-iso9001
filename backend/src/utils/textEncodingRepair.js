'use strict';

/**
 * Ripara testo con U+FFFD, mojibake comuni e normalizza separatori per ingest/UI.
 */
function repairTextEncoding(input) {
    if (input == null) return input;
    if (typeof input !== 'string') return input;

    let s = input
        .replace(/\uFFFD/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/â€"/g, ' - ')
        .replace(/â€“/g, '-')
        .replace(/â€™/g, "'")
        .replace(/â€œ/g, '"')
        .replace(/â€\u009d/g, '"')
        .replace(/Ã¼/g, 'ü')
        .replace(/Ãœ/g, 'Ü')
        .replace(/Ã¨/g, 'è')
        .replace(/Ã©/g, 'é')
        .replace(/Ã¬/g, 'ì')
        .replace(/Ã²/g, 'ò')
        .replace(/Ã¹/g, 'ù')
        .replace(/Ã /g, 'à')
        .replace(/[\u2013\u2014]/g, ' - ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return s;
}

/**
 * Dizionario di parole corrotte da font PDF "anti-copia" o mapping glifo→codice
 * non standard (osservato su UNI EN ISO 9606-1:2017 e norme UNI analoghe).
 *
 * Origine: sessione ingest patentini/WPQR (luglio 2026) — lettura manuale del
 * .md prodotto da backend/scripts/pdf_to_json su "UNI EN ISO 9606-1_2017.pdf".
 * Il font sostituisce sistematicamente alcune sequenze di lettere con glifi
 * visivamente simili ma di codice diverso (es. "m" → "rn", "l" finale → "1",
 * "tt"/"ti" → "ii" a seconda della pagina). La sostituzione NON è uniforme in
 * tutto il documento (dipende dal subset di font incorporato per pagina/blocco),
 * quindi non è affidabile un rimpiazzo a livello di singolo carattere (rischio
 * alto di falsi positivi su parole reali con "rn", "ti", ecc. — es. "turn",
 * "modern", "pattern", "action"). Si usa invece un dizionario di **parole intere**
 * osservate corrotte: nessuna di queste stringhe è una parola inglese valida,
 * quindi il rischio di falso positivo è marginale.
 *
 * @type {Record<string, string>}
 */
const FONT_SUBSTITUTION_WORD_MAP = {
    buii: 'butt',
    materia1: 'material',
    materia1s: 'materials',
    docurnent: 'document',
    docurnents: 'documents',
    docurnented: 'documented',
    docurnentation: 'documentation',
    frorn: 'from',
    rnrn: 'mm',
    specirnen: 'specimen',
    specirnens: 'specimens',
    rninirnurn: 'minimum',
    rnaxirnurn: 'maximum',
    rnaxirnum: 'maximum',
    rnnaximum: 'maximum',
    confirrned: 'confirmed',
    cornply: 'comply',
    cornplies: 'complies',
    cornpletion: 'completion',
    cornplete: 'complete',
    rnetal: 'metal',
    rnetals: 'metals',
    irnperfedion: 'imperfection',
    irnperfedions: 'imperfections',
    penekation: 'penetration',
    peneiration: 'penetration',
    diarneter: 'diameter',
    diarneters: 'diameters',
    circurnferential: 'circumferential',
    circurnference: 'circumference',
    witing: 'writing',
    wioiout: 'without',
    qualiiication: 'qualification',
    qualitication: 'qualification',
    qualilication: 'qualification',
    qualiiy: 'qualify',
    requirernent: 'requirement',
    requirernents: 'requirements',
    rernoved: 'removed',
    rnarked: 'marked',
    exarniner: 'examiner',
    exarnining: 'examining',
    exarnined: 'examined',
    identitication: 'identification',
    manufadurer: 'manufacturer',
    manufadurers: 'manufacturers',
    destmctive: 'destructive',
    destrodive: 'destructive',
    dismntinuity: 'discontinuity',
    dismntinuities: 'discontinuities',
    al1: 'all',
    acmrding: 'according',
    acmrdance: 'accordance',
    amrdance: 'accordance',
    cmrdance: 'accordance',
    eleckode: 'electrode',
    eleckd: 'electrode',
};

const FONT_SUBSTITUTION_REGEX = new RegExp(
    `\\b(${Object.keys(FONT_SUBSTITUTION_WORD_MAP).join('|')})\\b`,
    'gi'
);

/** Applica il "case pattern" della parola originale al rimpiazzo. */
function applyCasePattern(original, replacement) {
    if (original === original.toUpperCase() && original !== original.toLowerCase()) {
        return replacement.toUpperCase();
    }
    if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
}

/**
 * Conta quante occorrenze di parole del dizionario font-corruption compaiono
 * nel testo. Usare come euristica per decidere se applicare la correzione
 * (vedi `detectLikelyFontSubstitutionCorruption`).
 * @param {string} text
 * @returns {number}
 */
function countFontSubstitutionArtifacts(text) {
    if (typeof text !== 'string' || !text) return 0;
    const matches = text.match(FONT_SUBSTITUTION_REGEX);
    return matches ? matches.length : 0;
}

/**
 * Euristica: il testo è probabilmente affetto da corruzione da font
 * "anti-copia"/OCR di bassa qualità se contiene almeno `threshold` occorrenze
 * di parole note del dizionario. Da usare come gate prima di applicare
 * `repairFontSubstitutionArtifacts` in pipeline automatiche (evita di alterare
 * testo già pulito, dove il rischio — per quanto basso — di falso positivo
 * non è comunque giustificato).
 * @param {string} text
 * @param {{ threshold?: number }} [opts]
 * @returns {boolean}
 */
function detectLikelyFontSubstitutionCorruption(text, opts = {}) {
    const { threshold = 3 } = opts;
    return countFontSubstitutionArtifacts(text) >= threshold;
}

/**
 * Corregge le parole del testo note per essere corrotte da font PDF
 * "anti-copia" (sostituzione sistematica di glifi, es. "m"→"rn", "l"→"1").
 *
 * ATTENZIONE (falsi positivi): funziona per confronto di **parola intera**
 * contro un dizionario curato di grafie osservate realmente su documenti
 * norma UNI/ISO — non è una sostituzione generica carattere-per-carattere.
 * Non applicare a testo già pulito/non sospetto: usare prima
 * `detectLikelyFontSubstitutionCorruption` per decidere.
 *
 * @param {string} text
 * @returns {string}
 */
function repairFontSubstitutionArtifacts(text) {
    if (typeof text !== 'string' || !text) return text;
    return text.replace(FONT_SUBSTITUTION_REGEX, (match) => {
        const replacement = FONT_SUBSTITUTION_WORD_MAP[match.toLowerCase()];
        return replacement ? applyCasePattern(match, replacement) : match;
    });
}

function repairDeep(value) {
    if (value == null) return value;
    if (typeof value === 'string') return repairTextEncoding(value);
    if (Array.isArray(value)) return value.map(repairDeep);
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = repairDeep(v);
        }
        return out;
    }
    return value;
}

/** Codice processo ISO 4063 da valore AI/label */
function normalizeWeldingProcessCode(val) {
    const s = repairTextEncoding(String(val || ''));
    const m = s.match(/\b(111|121|131|135|136|138|141|145|311)\b/);
    return m ? m[1] : (s || null);
}

/** BW | FW */
function normalizeJointTypeCode(val) {
    const s = repairTextEncoding(String(val || '')).toUpperCase();
    // STUD-1: SW dedicato (≠ FW). Stud/prigioniero prima di BW/FW per non collassare.
    if (/\bSW\b/.test(s) || /\bSTUD\b/.test(s) || /PRIGIONIERO/.test(s)) return 'SW';
    if (s === 'BW+FW' || /\bBW\s*\+\s*FW\b/.test(s) || (/\bBW\b/.test(s) && /\bFW\b/.test(s))) return 'BW+FW';
    if (/\bBW\b/.test(s)) return 'BW';
    if (/\bFW\b/.test(s)) return 'FW';
    return ['BW', 'FW', 'BW+FW', 'SW'].includes(s) ? s : (s || null);
}

/** Valore select issuing_body */
function normalizeIssuingBodyCode(val) {
    const s = repairTextEncoding(String(val || '')).toLowerCase();
    if (!s) return null;
    if (/tüv|tuv/.test(s)) return 'tuv';
    if (/bureau veritas|\bbv\b/.test(s)) return 'bv';
    if (/\bdnv\b/.test(s)) return 'dnv';
    if (/\brina\b/.test(s)) return 'rina';
    if (/\bimq\b/.test(s)) return 'imq';
    if (/iqnet|\biqn\b/.test(s)) return 'iqn';
    if (/csq|certiquality/.test(s)) return 'csq';
    if (/tec eurolab|eurolab/.test(s)) return 'tec_eurolab';
    if (/sideius|\bvalor\b/.test(s)) return 'sideius';
    const allowed = ['tuv', 'bv', 'dnv', 'rina', 'imq', 'iqn', 'csq', 'tec_eurolab', 'sideius', 'altro'];
    return allowed.includes(s) ? s : 'altro';
}

const {
    normalizeMaterialGroupCode: normalizeMaterialGroupFromCatalog,
} = require('../data/materialGroups15608');

function normalizeMaterialGroupCode(val) {
    const s = repairTextEncoding(String(val || ''));
    return normalizeMaterialGroupFromCatalog(s) || (s || null);
}

function normalizeIngestSelectFields(fields) {
    if (!fields || typeof fields !== 'object') return fields;
    const out = repairDeep({ ...fields });
    if (out.welding_process != null) {
        out.welding_process = normalizeWeldingProcessCode(out.welding_process) || out.welding_process;
    }
    if (out.joint_type != null) {
        out.joint_type = normalizeJointTypeCode(out.joint_type) || out.joint_type;
    }
    if (out.issuing_body != null) {
        out.issuing_body = normalizeIssuingBodyCode(out.issuing_body) || out.issuing_body;
    }
    if (out.material_group != null) {
        out.material_group = normalizeMaterialGroupCode(out.material_group) || out.material_group;
    }
    return out;
}

module.exports = {
    repairTextEncoding,
    repairDeep,
    normalizeWeldingProcessCode,
    normalizeJointTypeCode,
    normalizeIssuingBodyCode,
    normalizeMaterialGroupCode,
    normalizeIngestSelectFields,
    FONT_SUBSTITUTION_WORD_MAP,
    countFontSubstitutionArtifacts,
    detectLikelyFontSubstitutionCorruption,
    repairFontSubstitutionArtifacts,
};
