/**
 * Test L1 - ncCreateHelpers (NC Fase 1 Slice 6)
 */
import { describe, it, expect } from 'vitest';
import {
  buildManualNcNumber,
  buildManualNcPayload,
  NC_MANUAL_SECTIONS,
  NC_SOURCE_TYPE_LABELS,
} from '../utils/ncCreateHelpers';

describe('ncCreateHelpers', () => {
  describe('buildManualNcNumber', () => {
    it('include prefisso M e audit number', () => {
      const num = buildManualNcNumber('AUD-2026-01');
      expect(num).toMatch(/^NC-M-AUD-2026-01-\d{6}$/);
    });

    it('usa fallback AUD se audit number assente', () => {
      const num = buildManualNcNumber('');
      expect(num).toMatch(/^NC-M-AUD-\d{6}$/);
    });
  });

  describe('buildManualNcPayload', () => {
    it('rifiuta form incompleto', () => {
      const result = buildManualNcPayload({ audit_id: '', section_code: '', description: '', severity: '' });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/compilare/i);
    });

    it('costruisce payload valido con source_type manual lato server', () => {
      const result = buildManualNcPayload(
        {
          audit_id: '99',
          section_code: 'clause10',
          description: ' NC di prova ',
          severity: 'major',
          responsible_person: ' Mario ',
          due_date: '2026-06-01',
        },
        'AUD-1'
      );
      expect(result.ok).toBe(true);
      expect(result.payload).toMatchObject({
        audit_id: 99,
        section_code: 'clause10',
        description: 'NC di prova',
        severity: 'major',
        responsible_person: 'Mario',
        due_date: '2026-06-01',
      });
      expect(result.payload.nc_number).toMatch(/^NC-M-AUD-1-/);
    });
  });

  describe('costanti', () => {
    it('NC_MANUAL_SECTIONS copre clausole 4-10', () => {
      expect(NC_MANUAL_SECTIONS.length).toBe(7);
      expect(NC_MANUAL_SECTIONS[0].value).toBe('clause4');
    });

    it('NC_SOURCE_TYPE_LABELS include manual e audit', () => {
      expect(NC_SOURCE_TYPE_LABELS.manual).toBe('Manuale');
      expect(NC_SOURCE_TYPE_LABELS.audit_nc).toBe('Audit NC');
    });
  });

  describe('mapApiSectionsToOptions', () => {
    it('mappa sezioni API in opzioni dropdown', async () => {
      const { mapApiSectionsToOptions } = await import('../utils/ncCreateHelpers');
      const opts = mapApiSectionsToOptions([
        { section_code: 'clause10', section_title: 'Miglioramento' },
      ]);
      expect(opts[0].value).toBe('clause10');
      expect(opts[0].label).toContain('Miglioramento');
    });
  });
});
