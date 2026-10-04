import { describe, expect, it } from 'vitest';
import {
  inferWeldingProcessFromText,
  normalizeWeldingProcessCode,
  buildWeldingProcessPromptSection,
} from '../data/weldingProcesses4063.js';

describe('weldingProcesses4063', () => {
  it('normalizza codice numerico', () => {
    expect(normalizeWeldingProcessCode('141')).toBe('141');
  });

  it('inferisce TIG da testo', () => {
    expect(inferWeldingProcessFromText('Qualifica TIG su acciaio')).toBe('141');
  });

  it('inferisce MAG da alias', () => {
    expect(inferWeldingProcessFromText('Processo MAG filo solido ISO 4063')).toBe('135');
  });

  it('prompt section contiene 783 e vieta 781/787 obsoleti', () => {
    const section = buildWeldingProcessPromptSection({ maxLines: 30 });
    expect(section).toContain('783');
    expect(section).toMatch(/non usare 781/i);
  });
});
