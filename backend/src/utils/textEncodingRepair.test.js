/**
 * @jest-environment node
 */
/* eslint-env jest */

const {
    repairTextEncoding,
    normalizeWeldingProcessCode,
    normalizeJointTypeCode,
    normalizeIngestSelectFields,
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
        expect(out.issuing_body).toBe('altro');
        expect(out.welder_name).toBe('TOMA IOAN');
    });
});
