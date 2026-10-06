import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_INTERVAL_MONTHS,
  computeQualifiedPipeDiameterRange,
  computeQualifiedFilletThicknessRange,
  computeQualifiedThicknessRangeButtWeld,
  computeQualifiedWeldingPositions,
  computeQualifiedWeldingProcesses,
  describeWeldingProcessEquivalences,
  WELDING_PROCESS_EQUIVALENCE_GROUPS,
  isWeldingPositionQualified,
  describePlateOnlyRotatingPositionDiameterNote,
  getApplicableWelderFields,
  buildWelderQualificationRulesPromptSection,
} from '../data/weldingQualificationRules9606.js';

describe('weldingQualificationRules9606', () => {
  it('conferma periodica fissa a 6 mesi (ISO 9606-1 §9.2)', () => {
    expect(CONFIRMATION_INTERVAL_MONTHS).toBe(6);
  });

  describe('computeQualifiedPipeDiameterRange (Tabella 7)', () => {
    it('D <= 25 mm -> [D, 2D]', () => {
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 20 })).toEqual({ minMm: 20, maxMm: 40 });
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 25 })).toEqual({ minMm: 25, maxMm: 50 });
    });

    it('D > 25 mm -> [max(0.5D, 25), null]', () => {
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 60 })).toEqual({ minMm: 30, maxMm: null });
      // 0.5*40 = 20 < 25 -> minimo forzato a 25
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 40 })).toEqual({ minMm: 25, maxMm: null });
    });

    it('input non valido -> null', () => {
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: null })).toBeNull();
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 'n/d' })).toBeNull();
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 0 })).toBeNull();
      expect(computeQualifiedPipeDiameterRange({})).toBeNull();
    });
  });

  describe('computeQualifiedFilletThicknessRange (Tabella 8, entrambe le righe verificate)', () => {
    it('t < 3 mm -> [t, max(2t, 3)]', () => {
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 1 })).toEqual({ minMm: 1, maxMm: 3 });
    });

    it('t >= 3 mm -> [3, null] (GAP risolto 26/07/2026, ex t>=3 tornava null)', () => {
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: null });
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 10 })).toEqual({ minMm: 3, maxMm: null });
    });

    it('input non valido -> null', () => {
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: -1 })).toBeNull();
      expect(computeQualifiedFilletThicknessRange({})).toBeNull();
    });
  });

  describe('computeQualifiedThicknessRangeButtWeld (Tabella 6, GAP risolto 26/07/2026)', () => {
    it('s < 3 mm -> [s, max(2s, 3)]', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2 })).toEqual({ minMm: 2, maxMm: 4 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 1 })).toEqual({ minMm: 1, maxMm: 3 });
    });

    it('3 <= s < 12 mm -> [3, 2s]', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: 6 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 8 })).toEqual({ minMm: 3, maxMm: 16 });
    });

    it('s >= 12 mm -> [3, null]', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 12 })).toEqual({ minMm: 3, maxMm: null });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 20 })).toEqual({ minMm: 3, maxMm: null });
    });

    it('processo 311 (ossiacetilenica): moltiplicatore 1,5 invece di 2 (note c/d)', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2, weldingProcessCode: '311' })).toEqual({ minMm: 2, maxMm: 3 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 8, weldingProcessCode: '311' })).toEqual({ minMm: 3, maxMm: 12 });
    });

    it('input non valido -> null', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: -1 })).toBeNull();
      expect(computeQualifiedThicknessRangeButtWeld({})).toBeNull();
    });
  });

  describe('computeQualifiedWeldingPositions / isWeldingPositionQualified (Tabelle 9/10, GAP risolto 26/07/2026)', () => {
    it('Tabella 9 (BW): PA qualifica solo PA', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'PA', jointType: 'BW' })).toEqual(['PA']);
    });

    it('Tabella 9 (BW): H-L045 qualifica PA/PC/PE/PF', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'H-L045', jointType: 'BW' })).toEqual(['PA', 'PC', 'PE', 'PF']);
    });

    it('Tabella 10 (FW): PH qualifica PA-PF (non PG)', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'PH', jointType: 'FW' })).toEqual(['PA', 'PB', 'PC', 'PD', 'PE', 'PF']);
    });

    it('posizione non riconosciuta -> null', () => {
      expect(computeQualifiedWeldingPositions({ testPosition: 'ZZ', jointType: 'BW' })).toBeNull();
      expect(computeQualifiedWeldingPositions({})).toBeNull();
    });

    it('isWeldingPositionQualified: PC (BW) qualifica PA ma non PE', () => {
      expect(isWeldingPositionQualified({ testPosition: 'PC', targetPosition: 'PA', jointType: 'BW' })).toBe(true);
      expect(isWeldingPositionQualified({ testPosition: 'PC', targetPosition: 'PE', jointType: 'BW' })).toBe(false);
    });

    it('isWeldingPositionQualified: posizione testata sconosciuta -> null (nessun giudizio)', () => {
      expect(isWeldingPositionQualified({ testPosition: 'ZZ', targetPosition: 'PA' })).toBeNull();
    });
  });

  it('prompt section contiene le regole chiave', () => {
    const section = buildWelderQualificationRulesPromptSection();
    expect(section).toContain('ISO 9606-1');
    expect(section).toContain('6 mesi');
    expect(section).toContain('135');
  });

  it('prompt section istruisce sul metodo di trasferimento (28/07/2026, richiesta committente)', () => {
    const section = buildWelderQualificationRulesPromptSection();
    expect(section).toMatch(/[Mm]etodo di trasferimento/);
    expect(section).toContain('spray_arc');
    expect(section).toContain('131, 135, 136, 138');
  });

  it('prompt section istruisce a non perdere l\u2019informazione "derivazione/branch/tubo-piastra" (segnalazione Mason, 27/07/2026)', () => {
    const section = buildWelderQualificationRulesPromptSection();
    expect(section).toContain('derivazione');
    expect(section).toContain('branch');
    expect(section).toContain('weld_details');
    expect(section).toMatch(/NON esiste una terza categoria/);
  });

  describe('getApplicableWelderFields (UX campi condizionati, 27/07/2026)', () => {
    it('diametro tubo non applicabile se prodotto = piastra (P)', () => {
      expect(getApplicableWelderFields({ productType: 'P' })).toEqual({ pipeDiameterApplicable: false, transferModeApplicable: false });
      expect(getApplicableWelderFields({ productType: 'p' })).toEqual({ pipeDiameterApplicable: false, transferModeApplicable: false });
    });

    it('diametro tubo applicabile se prodotto = tubo (T)', () => {
      expect(getApplicableWelderFields({ productType: 'T' })).toEqual({ pipeDiameterApplicable: true, transferModeApplicable: false });
    });

    it('diametro tubo applicabile (permissivo) se prodotto non ancora scelto', () => {
      expect(getApplicableWelderFields({ productType: '' })).toEqual({ pipeDiameterApplicable: true, transferModeApplicable: false });
      expect(getApplicableWelderFields({ productType: null })).toEqual({ pipeDiameterApplicable: true, transferModeApplicable: false });
      expect(getApplicableWelderFields()).toEqual({ pipeDiameterApplicable: true, transferModeApplicable: false });
    });
  });

  describe('getApplicableWelderFields — metodo di trasferimento (28/07/2026, richiesta committente)', () => {
    it('applicabile per processi ad arco con filo continuo (131/135/136/138)', () => {
      expect(getApplicableWelderFields({ weldingProcessCode: '131' }).transferModeApplicable).toBe(true);
      expect(getApplicableWelderFields({ weldingProcessCode: '135' }).transferModeApplicable).toBe(true);
      expect(getApplicableWelderFields({ weldingProcessCode: '136' }).transferModeApplicable).toBe(true);
      expect(getApplicableWelderFields({ weldingProcessCode: '138' }).transferModeApplicable).toBe(true);
    });

    it('non applicabile per processi senza transfer mode (111 MMA, 121 SAW, 141 TIG, 311 ossiacetilenica)', () => {
      expect(getApplicableWelderFields({ weldingProcessCode: '111' }).transferModeApplicable).toBe(false);
      expect(getApplicableWelderFields({ weldingProcessCode: '121' }).transferModeApplicable).toBe(false);
      expect(getApplicableWelderFields({ weldingProcessCode: '141' }).transferModeApplicable).toBe(false);
      expect(getApplicableWelderFields({ weldingProcessCode: '311' }).transferModeApplicable).toBe(false);
    });

    it('non applicabile se il processo non e\u2019 ancora scelto', () => {
      expect(getApplicableWelderFields({}).transferModeApplicable).toBe(false);
      expect(getApplicableWelderFields({ weldingProcessCode: '' }).transferModeApplicable).toBe(false);
      expect(getApplicableWelderFields({ weldingProcessCode: null }).transferModeApplicable).toBe(false);
    });
  });

  describe('describePlateOnlyRotatingPositionDiameterNote (feedback cliente Studio Mason, verificato §5.3 il 27/07/2026)', () => {
    it('nessuna nota se il tubo e\u2019 stato testato direttamente', () => {
      expect(describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: true,
        weldingPositions: ['PA'],
      })).toBeNull();
    });

    it('nessuna nota se le posizioni non includono PA/PB/PC/PD', () => {
      expect(describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: false,
        weldingPositions: ['PF', 'PG'],
      })).toBeNull();
    });

    it('\u2265500 mm per piastra in posizione PA/PB/PC/PD non rotante', () => {
      const note = describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: false,
        weldingPositions: ['PA'],
        rotatingPosition: false,
      });
      expect(note).toContain('\u2265500 mm');
      expect(note).toContain('\u00a75.3');
    });

    it('\u226575 mm quando la posizione di prova e\u2019 rotante', () => {
      const note = describePlateOnlyRotatingPositionDiameterNote({
        hasPipeDiameter: false,
        weldingPositions: 'PC, PD',
        rotatingPosition: true,
      });
      expect(note).toContain('\u226575 mm');
    });
  });

  describe('computeQualifiedWeldingProcesses (§5.2 equivalenze di processo, VQ-6)', () => {
    it.each([
      ['135', ['135', '138']],
      ['138', ['135', '138']],
      ['121', ['121', '125']],
      ['125', ['121', '125']],
      ['141', ['141', '142', '143', '145']],
      ['143', ['141', '142', '143', '145']],
      ['145', ['141', '142', '143', '145']],
      ['142', ['142']],
      ['111', ['111']],
      ['311', ['311']],
      [135, ['135', '138']],
      ['135S', ['135', '138']],
    ])('prova %s -> %j', (testProcess, expected) => {
      expect(computeQualifiedWeldingProcesses({ testProcess })).toEqual(expected);
    });

    it('141/143/145 qualificano anche 142 (testo ufficiale §5.2), 142 solo se stesso', () => {
      for (const p of ['141', '143', '145']) {
        expect(computeQualifiedWeldingProcesses({ testProcess: p })).toContain('142');
      }
      expect(computeQualifiedWeldingProcesses({ testProcess: '142' })).toEqual(['142']);
    });

    it.each([[null], [undefined], [''], ['TIG'], ['1'], ['1234']])('codice non leggibile %j -> null', (testProcess) => {
      expect(computeQualifiedWeldingProcesses({ testProcess })).toBeNull();
      expect(computeQualifiedWeldingProcesses()).toBeNull();
    });

    it('il risultato e\' una copia: non altera la tabella delle equivalenze', () => {
      computeQualifiedWeldingProcesses({ testProcess: '135' }).push('999');
      expect(computeQualifiedWeldingProcesses({ testProcess: '135' })).toEqual(['135', '138']);
    });

    it('parita\' prompt <-> funzione: ogni equivalenza calcolata compare nel prompt', () => {
      const section = buildWelderQualificationRulesPromptSection();
      expect(section).toContain(describeWeldingProcessEquivalences());
      for (const { testProcesses } of WELDING_PROCESS_EQUIVALENCE_GROUPS) {
        const qualified = computeQualifiedWeldingProcesses({ testProcess: testProcesses[0] });
        const line = section.split('\n').find((l) => l.includes('equivalenze'));
        expect(line).toContain(testProcesses.join('/'));
        for (const code of qualified) expect(line).toContain(code);
      }
    });

    it('il prompt non omette piu\' 142 tra i processi qualificati da 141/143/145 (correzione VQ-6)', () => {
      const section = buildWelderQualificationRulesPromptSection();
      expect(section).toContain('141/143/145 qualifica 141, 142, 143, 145');
      expect(section).toContain('142 qualifica solo 142');
      expect(section).toContain('135/138 qualifica 135, 138');
      expect(section).toContain('121/125 qualifica 121, 125');
      expect(section).not.toContain('tra loro (142 solo 142)');
    });

    it('il prompt cita Annex A (non §9.3) per il transfer mode', () => {
      const section = buildWelderQualificationRulesPromptSection();
      expect(section).toContain('§5.2/Annex A');
      expect(section).not.toContain('§5.2/§9.3');
    });
  });

  describe('bordi delle tabelle 6/7/8 usati dalla verifica (VQ-6)', () => {
    it('Tab. 6: s = 2,99 / 3 / 11,99 / 12 mm', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2.99 })).toEqual({ minMm: 2.99, maxMm: 5.98 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: 6 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 11.99 })).toEqual({ minMm: 3, maxMm: 23.98 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 12 })).toEqual({ minMm: 3, maxMm: null });
    });

    it('Tab. 6 nota c/d: 311 usa 1,5s (s = 2 -> 2..3; s = 4 -> 3..6)', () => {
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 2, weldingProcessCode: '311' })).toEqual({ minMm: 2, maxMm: 3 });
      expect(computeQualifiedThicknessRangeButtWeld({ testThicknessMm: 4, weldingProcessCode: '311' })).toEqual({ minMm: 3, maxMm: 6 });
    });

    it('Tab. 8: t = 2,99 / 3 mm', () => {
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 2.99 })).toEqual({ minMm: 2.99, maxMm: 5.98 });
      expect(computeQualifiedFilletThicknessRange({ testThicknessMm: 3 })).toEqual({ minMm: 3, maxMm: null });
    });

    it('Tab. 7: D = 25 (D ≤ 25: D..2D) e D = 25,01 (≥ 0,5D, minimo 25, senza limite superiore)', () => {
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 25 })).toEqual({ minMm: 25, maxMm: 50 });
      expect(computeQualifiedPipeDiameterRange({ testDiameterMm: 25.01 })).toEqual({ minMm: 25, maxMm: null });
    });
  });
});
