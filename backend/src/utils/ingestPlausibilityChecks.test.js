/**
 * @jest-environment node
 *
 * Test L1 — ingestPlausibilityChecks
 * Gap analysis WPQR/qualifiche saldatori (26/07/2026): questi controlli
 * intercettano errori plausibili nel documento originale/OCR (date invertite,
 * range invertiti, designazioni fuori pattern) — SOLO warning, mai blocco.
 */

const {
    checkDateOrder,
    checkNumericRangeOrder,
    checkFillerMaterial14341Plausibility,
    checkShieldingGasKnown,
    checkThicknessRangeAgainstIso15614Level2,
} = require('./ingestPlausibilityChecks');

describe('checkDateOrder', () => {
    it('nessun warning se la data successiva è dopo la precedente', () => {
        expect(checkDateOrder({
            laterDate: '2027-04-16', earlierDate: '2024-04-17',
            laterLabel: 'Scadenza', earlierLabel: 'Emissione',
        })).toBeNull();
    });

    it('warning se la scadenza è anteriore o uguale alla data di emissione', () => {
        const w = checkDateOrder({
            laterDate: '2023-01-01', earlierDate: '2024-04-17',
            laterLabel: 'Scadenza', earlierLabel: 'Emissione',
        });
        expect(w).toContain('Scadenza');
        expect(w).toContain('Emissione');
    });

    it('warning se le due date sono identiche (non successiva in senso stretto)', () => {
        const w = checkDateOrder({
            laterDate: '2024-04-17', earlierDate: '2024-04-17',
            laterLabel: 'Scadenza', earlierLabel: 'Emissione',
        });
        expect(w).not.toBeNull();
    });

    it('nessun warning se una delle due date è assente (non vincolante)', () => {
        expect(checkDateOrder({
            laterDate: null, earlierDate: '2024-04-17',
            laterLabel: 'Scadenza', earlierLabel: 'Emissione',
        })).toBeNull();
    });

    it('nessun warning se una data non è in formato ISO valido', () => {
        expect(checkDateOrder({
            laterDate: 'non disponibile', earlierDate: '2024-04-17',
            laterLabel: 'Scadenza', earlierLabel: 'Emissione',
        })).toBeNull();
    });
});

describe('checkNumericRangeOrder', () => {
    it('nessun warning se min <= max', () => {
        expect(checkNumericRangeOrder({ min: 3, max: 12, label: 'spessore' })).toBeNull();
    });

    it('warning se min > max (range invertito)', () => {
        const w = checkNumericRangeOrder({ min: 20, max: 5, label: 'spessore' });
        expect(w).toContain('invertito');
        expect(w).toContain('spessore');
    });

    it('nessun warning se uno dei due valori è assente', () => {
        expect(checkNumericRangeOrder({ min: null, max: 12, label: 'diametro' })).toBeNull();
        expect(checkNumericRangeOrder({ min: 3, max: null, label: 'diametro' })).toBeNull();
    });

    it('min == max non è considerato invertito', () => {
        expect(checkNumericRangeOrder({ min: 10, max: 10, label: 'spessore' })).toBeNull();
    });
});

describe('checkFillerMaterial14341Plausibility', () => {
    it('nessun warning per designazione forma completa valida', () => {
        expect(checkFillerMaterial14341Plausibility('ISO 14341-A-G 46 5 M21 3Si1')).toBeNull();
    });

    it('nessun warning per forma corta tipica su WPS/WPQR', () => {
        expect(checkFillerMaterial14341Plausibility('G 42 4 M21 3Si1')).toBeNull();
    });

    it('nessun warning per solo filo (senza proprietà deposito)', () => {
        expect(checkFillerMaterial14341Plausibility('ISO 14341-B-G S3')).toBeNull();
    });

    it('warning per stringa che non somiglia a una designazione 14341', () => {
        const w = checkFillerMaterial14341Plausibility('XYZ###123');
        expect(w).toContain('non riconosciuta come ISO 14341');
    });

    it('nessun warning se il campo è vuoto/assente (non vincolante)', () => {
        expect(checkFillerMaterial14341Plausibility(null)).toBeNull();
        expect(checkFillerMaterial14341Plausibility('')).toBeNull();
    });
});

describe('checkShieldingGasKnown', () => {
    it('nessun warning per codice noto nel catalogo ISO 14175', () => {
        expect(checkShieldingGasKnown('M21')).toBeNull();
        expect(checkShieldingGasKnown('C1')).toBeNull();
    });

    it('nessun warning per "altro" (opzione esplicita fuori elenco)', () => {
        expect(checkShieldingGasKnown('altro')).toBeNull();
    });

    it('warning per codice non riconosciuto né inferibile', () => {
        const w = checkShieldingGasKnown('GAS-INESISTENTE-999');
        expect(w).toContain('non riconosciuto');
    });

    it('nessun warning se il campo è vuoto/assente', () => {
        expect(checkShieldingGasKnown(null)).toBeNull();
        expect(checkShieldingGasKnown('')).toBeNull();
    });
});

describe('checkThicknessRangeAgainstIso15614Level2', () => {
    it('nessun warning se il range dichiarato rientra nell\'atteso (Level 2, banda 3-40mm)', () => {
        expect(checkThicknessRangeAgainstIso15614Level2({
            thicknessTestMm: 20, thicknessMin: 10, thicknessMax: 22, qualificationLevel: '2',
        })).toBeNull();
    });

    it('warning se il range dichiarato è palesemente fuori dall\'atteso', () => {
        const w = checkThicknessRangeAgainstIso15614Level2({
            thicknessTestMm: 20, thicknessMin: 1, thicknessMax: 100, qualificationLevel: '2',
        });
        expect(w).toContain('ISO 15614-1 Tabella 7 Level 2');
    });

    it('nessun warning per Level 1 (colonna non codificata, GAP)', () => {
        expect(checkThicknessRangeAgainstIso15614Level2({
            thicknessTestMm: 20, thicknessMin: 1, thicknessMax: 100, qualificationLevel: '1',
        })).toBeNull();
    });

    it('nessun warning se lo spessore è fuori dalle bande coperte (es. 50mm)', () => {
        expect(checkThicknessRangeAgainstIso15614Level2({
            thicknessTestMm: 50, thicknessMin: 1, thicknessMax: 100, qualificationLevel: '2',
        })).toBeNull();
    });

    it('nessun warning se livello o range non sono valorizzati', () => {
        expect(checkThicknessRangeAgainstIso15614Level2({
            thicknessTestMm: 20, thicknessMin: null, thicknessMax: null, qualificationLevel: '2',
        })).toBeNull();
        expect(checkThicknessRangeAgainstIso15614Level2({
            thicknessTestMm: null, thicknessMin: 10, thicknessMax: 22, qualificationLevel: '2',
        })).toBeNull();
    });
});
