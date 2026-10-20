import { describe, it, expect } from 'vitest';
import {
  rangeFromMeasured,
  formatAnnexRange,
  annexARunCells,
  currentRangeFromRuns,
  isMag135Family,
  IU_WIRE_PCT,
  HEAT_PCT,
} from '../utils/wpsAnnexARanges.js';

describe('wpsAnnexARanges', () => {
  it('deriva ±10 % su corrente e −25/+25 % su heat input', () => {
    expect(IU_WIRE_PCT).toBe(0.1);
    expect(HEAT_PCT).toBe(0.25);
    const i = rangeFromMeasured(190, IU_WIRE_PCT);
    expect(i).toEqual({ min: 171, max: 209 });
    const hi = rangeFromMeasured(0.66, HEAT_PCT);
    expect(hi.min).toBe(0.5);
    expect(hi.max).toBe(0.83);
    expect(formatAnnexRange(i, '')).toBe('171 \u2013 209');
  });

  it('usa min/max già presenti invece del misurato', () => {
    const r = rangeFromMeasured(190, IU_WIRE_PCT, { min: 180, max: 220 });
    expect(r).toEqual({ min: 180, max: 220 });
  });

  it('cella vuota se manca il misurato', () => {
    expect(rangeFromMeasured(null, IU_WIRE_PCT)).toBeNull();
    expect(annexARunCells({}).current).toBe('');
    expect(annexARunCells({}).wire).toBe('');
  });

  it('stampa polarità e range filo nelle 9 celle', () => {
    const c = annexARunCells({
      run_label: '1',
      welding_process: '135',
      filler_diameter_mm: 1.2,
      current_a: 190,
      voltage_v: 24,
      current_polarity: 'DC+',
      wire_feed_speed: 8,
      wire_feed_unit: 'm/min',
      travel_speed: 5,
      travel_speed_unit: 'mm/s',
      heat_input_value: 0.8,
      heat_input_unit: 'kJ/mm',
    });
    expect(c.polarity).toBe('DC+');
    expect(c.wire).toMatch(/7\.2/);
    expect(c.wire).toMatch(/8\.8/);
    expect(c.wire).toMatch(/m\/min/);
    expect(c.current).toMatch(/171/);
    expect(c.current).toMatch(/209/);
    expect(c.speed).toBe('5 mm/s');
    expect(c.speed).not.toMatch(/4\.5/);
  });

  it('travel speed resta il misurato (nota ¹, non ±10 %)', () => {
    const c = annexARunCells({ travel_speed: 5.4, travel_speed_unit: 'mm/s' });
    expect(c.speed).toBe('5.4 mm/s');
    expect(c.speed).not.toContain('4.86');
    expect(c.speed).not.toContain('5.94');
  });

  it('currentRangeFromRuns sul min–max delle passate', () => {
    expect(currentRangeFromRuns([
      { current_a: 190 },
      { current_a: 210 },
    ])).toBe('171 \u2013 231 A');
  });

  it('isMag135Family riconosce 135/136/138', () => {
    expect(isMag135Family('135')).toBe(true);
    expect(isMag135Family('138 MAG')).toBe(true);
    expect(isMag135Family('141')).toBe(false);
  });
});
