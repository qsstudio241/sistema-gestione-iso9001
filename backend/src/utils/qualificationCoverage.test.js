'use strict';

const {
    checkThickness,
    checkMaterialGroup,
    checkPositions,
    checkProcess,
    computeQualificationCoverage,
    computeWpsCoverageEsito,
} = require('./qualificationCoverage');

// ─── checkThickness ───────────────────────────────────────────────────────────

describe('checkThickness', () => {
    it('restituisce ok quando WPS non specifica spessore', () => {
        expect(checkThickness(3, 20, null, null)).toBe('ok');
    });

    it('restituisce ok quando range WPS è contenuto nel range qualificato', () => {
        expect(checkThickness(3, 30, 5, 20)).toBe('ok');
    });

    it('restituisce ok con bounds coincidenti', () => {
        expect(checkThickness(3, 30, 3, 30)).toBe('ok');
    });

    it('restituisce out_of_range quando WPS richiede più del qualificato', () => {
        expect(checkThickness(3, 20, 3, 25)).toBe('out_of_range');
    });

    it('restituisce out_of_range quando min WPS è inferiore al min qualificato', () => {
        expect(checkThickness(5, 30, 3, 20)).toBe('out_of_range');
    });

    it('restituisce unverifiable quando qualifica non ha dati spessore', () => {
        expect(checkThickness(null, null, 5, 20)).toBe('unverifiable');
    });

    it('restituisce ok quando qualifica ha solo max e WPS rientra', () => {
        // qualMin=null → default 0; qualMax=30; reqMin=5; reqMax=20 → ok
        expect(checkThickness(null, 30, 5, 20)).toBe('ok');
    });
});

// ─── checkMaterialGroup ───────────────────────────────────────────────────────

describe('checkMaterialGroup', () => {
    it('restituisce ok quando WPS non specifica gruppo', () => {
        expect(checkMaterialGroup('1', null)).toBe('ok');
        expect(checkMaterialGroup('1', '')).toBe('ok');
    });

    it('restituisce ok su match esatto', () => {
        expect(checkMaterialGroup('1.1', '1.1')).toBe('ok');
    });

    it('restituisce ok quando qualifica copre il gruppo WPS (superset)', () => {
        expect(checkMaterialGroup('1.1, 1.2', '1.1')).toBe('ok');
    });

    it('restituisce ok su match case-insensitive', () => {
        expect(checkMaterialGroup('W01', 'w01')).toBe('ok');
    });

    it('restituisce mismatch su gruppi incompatibili', () => {
        expect(checkMaterialGroup('1.1', '8.1')).toBe('mismatch');
    });

    it('restituisce unverifiable quando qualifica non ha gruppo', () => {
        expect(checkMaterialGroup(null, '1.1')).toBe('unverifiable');
        expect(checkMaterialGroup('', '1.1')).toBe('unverifiable');
    });
});

// ─── checkPositions ───────────────────────────────────────────────────────────

describe('checkPositions', () => {
    it('restituisce ok quando WPS non specifica posizioni', () => {
        expect(checkPositions('PA, PB', null)).toBe('ok');
        expect(checkPositions('PA', '')).toBe('ok');
    });

    it('restituisce ok quando tutte le posizioni WPS sono qualificate', () => {
        expect(checkPositions('PA, PB, PC', 'PA, PB')).toBe('ok');
    });

    it('restituisce ok su match esatto singolo', () => {
        expect(checkPositions('PA', 'PA')).toBe('ok');
    });

    it('restituisce mismatch quando una posizione WPS non è qualificata', () => {
        expect(checkPositions('PA, PB', 'PA, PB, PC')).toBe('mismatch');
    });

    it('restituisce unverifiable quando qualifica non ha posizioni', () => {
        expect(checkPositions(null, 'PA')).toBe('unverifiable');
        expect(checkPositions('', 'PA')).toBe('unverifiable');
    });
});

// ─── checkProcess ─────────────────────────────────────────────────────────────

describe('checkProcess', () => {
    it('restituisce true su match esatto', () => {
        expect(checkProcess('141', '141')).toBe(true);
    });

    it('restituisce true su match case-insensitive', () => {
        expect(checkProcess('MIG', 'mig')).toBe(true);
    });

    it('restituisce true quando WPS non specifica processo', () => {
        expect(checkProcess('141', null)).toBe(true);
    });

    it('restituisce false quando qualifica non ha processo', () => {
        expect(checkProcess(null, '141')).toBe(false);
    });

    it('restituisce false su processi differenti', () => {
        expect(checkProcess('141', '111')).toBe(false);
    });
});

// ─── computeQualificationCoverage ────────────────────────────────────────────

describe('computeQualificationCoverage', () => {
    const baseQual = {
        welding_process: '141',
        material_group:  '1.1',
        position_range:  'PA, PB',
        thickness_min_mm: 3,
        thickness_max_mm: 30,
    };

    const baseWps = {
        welding_process:   '141',
        base_material_group: '1.1',
        welding_positions: 'PA',
        thickness_range_min: 5,
        thickness_range_max: 20,
    };

    it('overall=ok su match completo', () => {
        const result = computeQualificationCoverage(baseQual, baseWps);
        expect(result.overall).toBe('ok');
        expect(result.process).toBe('ok');
        expect(result.thickness).toBe('ok');
        expect(result.material_group).toBe('ok');
        expect(result.position).toBe('ok');
    });

    it('overall=excluded su processo non corrispondente', () => {
        const result = computeQualificationCoverage({ ...baseQual, welding_process: '111' }, baseWps);
        expect(result.overall).toBe('excluded');
        expect(result.process).toBe('mismatch');
    });

    it('overall=excluded quando spessore WPS fuori dal range qualificato', () => {
        const result = computeQualificationCoverage(
            { ...baseQual, thickness_min_mm: 3, thickness_max_mm: 15 },
            { ...baseWps, thickness_range_min: 5, thickness_range_max: 20 },
        );
        expect(result.overall).toBe('excluded');
        expect(result.thickness).toBe('out_of_range');
    });

    it('overall=excluded su gruppo materiale incompatibile', () => {
        const result = computeQualificationCoverage(
            { ...baseQual, material_group: '8.1' },
            baseWps,
        );
        expect(result.overall).toBe('excluded');
        expect(result.material_group).toBe('mismatch');
    });

    it('overall=excluded quando posizione WPS non coperta', () => {
        const result = computeQualificationCoverage(
            { ...baseQual, position_range: 'PA' },
            { ...baseWps, welding_positions: 'PA, PE' },
        );
        expect(result.overall).toBe('excluded');
        expect(result.position).toBe('mismatch');
    });

    it('overall=partial quando spessore qualifica è NULL (non verificabile)', () => {
        const result = computeQualificationCoverage(
            { ...baseQual, thickness_min_mm: null, thickness_max_mm: null },
            baseWps,
        );
        expect(result.overall).toBe('partial');
        expect(result.thickness).toBe('unverifiable');
    });

    it('overall=partial quando gruppo materiale qualifica è NULL', () => {
        const result = computeQualificationCoverage(
            { ...baseQual, material_group: null },
            baseWps,
        );
        expect(result.overall).toBe('partial');
        expect(result.material_group).toBe('unverifiable');
    });

    it('overall=partial quando posizioni qualifica sono NULL', () => {
        const result = computeQualificationCoverage(
            { ...baseQual, position_range: null },
            baseWps,
        );
        expect(result.overall).toBe('partial');
        expect(result.position).toBe('unverifiable');
    });

    it('overall=ok quando WPS non specifica range (tutti i campi NULL nella WPS)', () => {
        const wpsNoRange = {
            welding_process: '141',
            base_material_group: null,
            welding_positions: null,
            thickness_range_min: null,
            thickness_range_max: null,
        };
        const result = computeQualificationCoverage(baseQual, wpsNoRange);
        expect(result.overall).toBe('ok');
    });
});

// ─── computeWpsCoverageEsito ─────────────────────────────────────────────────

describe('computeWpsCoverageEsito', () => {
    it('verde se almeno un saldatore ha overall=ok', () => {
        expect(computeWpsCoverageEsito([
            { overall: 'excluded' },
            { overall: 'ok' },
        ])).toBe('verde');
    });

    it('giallo se nessun ok ma almeno un partial', () => {
        expect(computeWpsCoverageEsito([
            { overall: 'excluded' },
            { overall: 'partial' },
        ])).toBe('giallo');
    });

    it('rosso se nessuna copertura', () => {
        expect(computeWpsCoverageEsito([
            { overall: 'excluded' },
            { overall: 'excluded' },
        ])).toBe('rosso');
    });

    it('rosso su lista vuota', () => {
        expect(computeWpsCoverageEsito([])).toBe('rosso');
    });
});
