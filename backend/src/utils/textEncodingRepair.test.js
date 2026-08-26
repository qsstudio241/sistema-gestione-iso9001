/**
 * @jest-environment node
 */
/* eslint-env jest */

const {
    repairTextEncoding,
    normalizeWeldingProcessCode,
    normalizeJointTypeCode,
    normalizeIngestSelectFields,
    countFontSubstitutionArtifacts,
    detectLikelyFontSubstitutionCorruption,
    repairFontSubstitutionArtifacts,
} = require('./textEncodingRepair');

describe('textEncodingRepair', () => {
    test('rimuove U+FFFD e normalizza separatori', () => {
        expect(repairTextEncoding('135 \uFFFD MAG (GMAW)')).toBe('135 MAG (GMAW)');
        expect(repairTextEncoding('T\uFFFDBV')).toBe('TBV');
    });

    test('normalizeWeldingProcessCode estrae codice ISO 4063', () => {
        expect(normalizeWeldingProcessCode('135 - MAG (GMAW) filo solido')).toBe('135');
    });

    test('normalizeJointTypeCode', () => {
        expect(normalizeJointTypeCode('FW - angolare')).toBe('FW');
        expect(normalizeJointTypeCode('BW+FW')).toBe('BW+FW');
        expect(normalizeJointTypeCode('SW - Stud / prigioniero')).toBe('SW');
        expect(normalizeJointTypeCode('stud welding')).toBe('SW');
        expect(normalizeJointTypeCode('saldatura prigionieri')).toBe('SW');
        expect(normalizeJointTypeCode('butt weld')).toBe('BW');
        expect(normalizeJointTypeCode('fillet weld')).toBe('FW');
    });

    test('normalizeIngestSelectFields su patentino', () => {
        const out = normalizeIngestSelectFields({
            welding_process: '135 - MAG',
            joint_type: 'FW giunto',
            issuing_body: 'TEC Eurolab',
            welder_name: 'TOMA IOAN',
        });
        expect(out.welding_process).toBe('135');
        expect(out.joint_type).toBe('FW');
        expect(out.issuing_body).toBe('tec_eurolab');
        expect(out.welder_name).toBe('TOMA IOAN');
    });
});

describe('repairFontSubstitutionArtifacts (font PDF anti-copia)', () => {
    // Casi reali osservati su UNI EN ISO 9606-1:2017 (sessione ingest luglio 2026,
    // out/norme-prova-ingest/uni en iso 9606-1_2017.md).
    test('corregge i pattern reali osservati sul PDF ISO 9606-1', () => {
        expect(repairFontSubstitutionArtifacts('The qualification test shall be carried out as buii or fillet welding.'))
            .toBe('The qualification test shall be carried out as butt or fillet welding.');
        expect(repairFontSubstitutionArtifacts('Filler materia1 grouping'))
            .toBe('Filler material grouping');
        expect(repairFontSubstitutionArtifacts('docurnented that the welder has produced welds'))
            .toBe('documented that the welder has produced welds');
        expect(repairFontSubstitutionArtifacts('frorn its date of issue'))
            .toBe('from its date of issue');
        expect(repairFontSubstitutionArtifacts('a new qualitication test'))
            .toBe('a new qualification test');
        expect(repairFontSubstitutionArtifacts('shall qualiiy him for other transfer modes'))
            .toBe('shall qualify him for other transfer modes');
    });

    test('preserva il case (maiuscolo iniziale / tutto maiuscolo)', () => {
        expect(repairFontSubstitutionArtifacts('Buii welds cover buii welds in any type of joint'))
            .toBe('Butt welds cover butt welds in any type of joint');
    });

    test('non altera parole reali che contengono le stesse lettere (basso rischio falsi positivi)', () => {
        const clean = 'The welder shall turn the torch and return to the internal corner pattern before the action.';
        expect(repairFontSubstitutionArtifacts(clean)).toBe(clean);
    });

    test('non altera testo pulito/non ambiguo', () => {
        const clean = '135 MAG (GMAW) filo solido, posizione PA, spessore 10 mm, gruppo materiale 8.1.';
        expect(repairFontSubstitutionArtifacts(clean)).toBe(clean);
    });

    test('countFontSubstitutionArtifacts conta le occorrenze note', () => {
        expect(countFontSubstitutionArtifacts('buii buii materia1 docurnent')).toBe(4);
        expect(countFontSubstitutionArtifacts('testo completamente pulito e leggibile')).toBe(0);
    });

    test('detectLikelyFontSubstitutionCorruption applica una soglia (default 3)', () => {
        expect(detectLikelyFontSubstitutionCorruption('buii materia1 docurnent frorn')).toBe(true);
        expect(detectLikelyFontSubstitutionCorruption('buii materia1')).toBe(false);
        expect(detectLikelyFontSubstitutionCorruption('buii materia1', { threshold: 2 })).toBe(true);
    });

    test('input non stringa o vuoto torna invariato', () => {
        expect(repairFontSubstitutionArtifacts(null)).toBe(null);
        expect(repairFontSubstitutionArtifacts('')).toBe('');
        expect(repairFontSubstitutionArtifacts(undefined)).toBe(undefined);
    });
});
