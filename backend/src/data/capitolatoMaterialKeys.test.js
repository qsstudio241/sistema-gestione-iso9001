/**
 * @jest-environment node
 */

/* eslint-env jest */

const {
    canonicalizeFieldKey,
    detectCapitolatoMaterialStandards,
    mergeIdentifiedStandards,
    formatFieldKeysForPrompt,
    CAPITOLATO_MATERIAL_FIELD_KEYS,
} = require('./capitolatoMaterialKeys');

describe('capitolatoMaterialKeys', () => {
    describe('canonicalizeFieldKey', () => {
        test('lascia invariate le chiavi canoniche', () => {
            expect(canonicalizeFieldKey('inspection_document_type')).toBe('inspection_document_type');
            expect(canonicalizeFieldKey('filler_designation')).toBe('filler_designation');
        });

        test('normalizza alias certificato e apporto', () => {
            expect(canonicalizeFieldKey('MTC')).toBe('inspection_document_type');
            expect(canonicalizeFieldKey('tipo certificato')).toBe('inspection_document_type');
            expect(canonicalizeFieldKey('materiale d\'apporto')).toBe('material_role');
            expect(canonicalizeFieldKey('filler_material')).toBe('filler_designation');
            expect(canonicalizeFieldKey('filo')).toBe('material_role');
            expect(canonicalizeFieldKey('elettrodo')).toBe('material_role');
            expect(canonicalizeFieldKey('designazione_filo')).toBe('filler_designation');
        });

        test('chiave sconosciuta resta (troncata)', () => {
            expect(canonicalizeFieldKey('delivery_date')).toBe('delivery_date');
        });

        test('vuoto → null', () => {
            expect(canonicalizeFieldKey('')).toBeNull();
            expect(canonicalizeFieldKey(null)).toBeNull();
        });
    });

    describe('detectCapitolatoMaterialStandards', () => {
        test('riconosce EN 10204, EN 10025-2 e ISO 14341', () => {
            const text = 'Certificato 3.1 UNI EN 10204 su lamiera EN 10025-2; filo ISO 14341 G 42 4 M21 3Si1';
            expect(detectCapitolatoMaterialStandards(text)).toEqual([
                'EN 10204',
                'EN 10025-2',
                'ISO 14341',
            ]);
        });

        test('ISO 404 non matcha ISO 4043', () => {
            expect(detectCapitolatoMaterialStandards('ISO 4043 welding')).toEqual([]);
            expect(detectCapitolatoMaterialStandards('ordine secondo ISO 404')).toEqual(['ISO 404']);
        });

        test('testo senza norme → []', () => {
            expect(detectCapitolatoMaterialStandards('solo consegna 30 giorni')).toEqual([]);
        });
    });

    describe('mergeIdentifiedStandards', () => {
        test('aggiunge norme dal testo senza duplicare ISO 3834 già presente', () => {
            const merged = mergeIdentifiedStandards(
                ['ISO 3834-2', 'en 10204'],
                'EN 10204 e EN 10168 sul 3.1',
            );
            expect(merged).toEqual(['ISO 3834-2', 'en 10204', 'EN 10168']);
        });
    });

    test('formatFieldKeysForPrompt elenca tutte le chiavi ISO-3', () => {
        const block = formatFieldKeysForPrompt();
        for (const row of CAPITOLATO_MATERIAL_FIELD_KEYS) {
            expect(block).toContain(row.key);
        }
        expect(block).toMatch(/material_role/);
        expect(block).toMatch(/filler_designation/);
    });
});
