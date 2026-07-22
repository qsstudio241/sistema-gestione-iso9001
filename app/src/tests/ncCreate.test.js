/**
 * Test L1 - ncCreateHelpers (Action Plan multi-fonte — migration 098)
 */
import { describe, it, expect } from 'vitest';
import {
  buildManualNcNumber,
  buildManualNcPayload,
  NC_MANUAL_SECTIONS,
  NC_SOURCE_TYPE_LABELS,
  NC_SOURCE_CATEGORIES,
  NC_SOURCE_CATEGORY_OPTIONS,
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

  describe('buildManualNcPayload — categoria audit', () => {
    it('rifiuta form audit senza audit_id', () => {
      const result = buildManualNcPayload({
        source_category: 'audit',
        audit_id: '',
        section_code: 'clause10',
        description: 'test',
        severity: 'minor',
      });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/audit/i);
    });

    it('rifiuta descrizione vuota', () => {
      const result = buildManualNcPayload({
        source_category: 'audit',
        audit_id: '1',
        section_code: 'clause10',
        description: '',
        severity: 'minor',
      });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/descrizione/i);
    });

    it('costruisce payload valido categoria audit', () => {
      const result = buildManualNcPayload(
        {
          source_category: 'audit',
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
        source_category: 'audit',
        section_code: 'clause10',
        description: 'NC di prova',
        severity: 'major',
        responsible_person: 'Mario',
        due_date: '2026-06-01',
      });
      expect(result.payload.nc_number).toMatch(/^NC-M-AUD-1-/);
    });
  });

  describe('buildManualNcPayload — categorie non-audit', () => {
    it('non richiede audit_id per management_review', () => {
      const result = buildManualNcPayload({
        source_category: 'management_review',
        source_origin_text: 'Riesame giugno 2026',
        section_code: 'clause9',
        description: 'Azione da riesame',
        severity: 'minor',
      });
      expect(result.ok).toBe(true);
      expect(result.payload.audit_id).toBeUndefined();
      expect(result.payload.source_category).toBe('management_review');
      expect(result.payload.source_origin_text).toBe('Riesame giugno 2026');
    });

    it('non richiede audit_id per risk_action', () => {
      const result = buildManualNcPayload({
        source_category: 'risk_action',
        section_code: 'clause6',
        description: 'Azione da analisi rischi',
        severity: 'major',
      });
      expect(result.ok).toBe(true);
      expect(result.payload.source_category).toBe('risk_action');
    });
  });

  describe('costanti Action Plan', () => {
    it('NC_MANUAL_SECTIONS copre clausole 4-10', () => {
      expect(NC_MANUAL_SECTIONS.length).toBe(7);
      expect(NC_MANUAL_SECTIONS[0].value).toBe('clause4');
    });

    it('NC_SOURCE_TYPE_LABELS include manual e audit', () => {
      expect(NC_SOURCE_TYPE_LABELS.manual).toBe('Manuale');
      expect(NC_SOURCE_TYPE_LABELS.audit_nc).toBe('Audit NC');
    });

    it('NC_SOURCE_CATEGORIES contiene tutte le categorie attese', () => {
      const keys = Object.keys(NC_SOURCE_CATEGORIES);
      expect(keys).toContain('audit');
      expect(keys).toContain('management_review');
      expect(keys).toContain('risk_action');
      expect(keys).toContain('improvement');
      expect(keys).toContain('complaint');
      expect(keys).toContain('operational');
      expect(keys).toContain('external_audit');
    });

    it('audit è l\'unica categoria con requiresAudit=true', () => {
      const auditRequired = Object.entries(NC_SOURCE_CATEGORIES)
        .filter(([, cfg]) => cfg.requiresAudit)
        .map(([k]) => k);
      expect(auditRequired).toEqual(['audit']);
    });

    it('NC_SOURCE_CATEGORY_OPTIONS ha un item per ogni categoria', () => {
      expect(NC_SOURCE_CATEGORY_OPTIONS.length).toBe(Object.keys(NC_SOURCE_CATEGORIES).length);
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
