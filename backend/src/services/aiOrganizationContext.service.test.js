jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
}));

const { query } = require('../config/database');
const {
  buildOrganizationContextBlock,
  loadOrganizationProfile,
  enrichSystemPromptWithOrganization,
} = require('./aiOrganizationContext.service');

describe('aiOrganizationContext.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadOrganizationProfile', () => {
    it('returns null when organizationId is falsy', async () => {
      expect(await loadOrganizationProfile(null)).toBeNull();
      expect(await loadOrganizationProfile(0)).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    it('returns null on DB error (es. colonna ai_context_notes assente)', async () => {
      query.mockRejectedValue(new Error('Invalid column name ai_context_notes'));
      expect(await loadOrganizationProfile(1001)).toBeNull();
    });

    it('returns null when org not found or inactive', async () => {
      query.mockResolvedValue({ recordset: [] });
      expect(await loadOrganizationProfile(9999)).toBeNull();
    });

    it('returns profile row when found', async () => {
      query.mockResolvedValue({
        recordset: [{ organization_name: 'Al.project', ai_context_notes: null }],
      });
      const profile = await loadOrganizationProfile(1001);
      expect(profile.organization_name).toBe('Al.project');
    });
  });

  describe('enrichSystemPromptWithOrganization', () => {
    it('returns base prompt unchanged when profile is missing', async () => {
      query.mockResolvedValue({ recordset: [] });
      const result = await enrichSystemPromptWithOrganization('base prompt', 1001);
      expect(result).toBe('base prompt');
    });

    it('appends studio block when profile exists', async () => {
      query.mockResolvedValue({
        recordset: [{
          organization_name: 'QS Studio',
          organization_code: 'QS',
          ai_context_notes: 'Note test',
        }],
      });
      const result = await enrichSystemPromptWithOrganization('base', 1);
      expect(result).toContain('base');
      expect(result).toContain('CONTESTO STUDIO / ORGANIZZAZIONE');
      expect(result).toContain('Note test');
    });
  });

  describe('buildOrganizationContextBlock', () => {
  it('returns empty block when profile is null', () => {
    expect(buildOrganizationContextBlock(null)).toBe('');
  });

  it('includes studio name, code, vat, prefix and notes', () => {
    const block = buildOrganizationContextBlock({
      organization_name: 'QS Studio',
      organization_code: 'QS',
      vat_number: 'IT12345678901',
      audit_report_prefix: 'RAP',
      ai_context_notes: 'Specializzati in metalmeccanica e saldatura.',
    });

    expect(block).toContain('CONTESTO STUDIO / ORGANIZZAZIONE');
    expect(block).toContain('Studio: QS Studio');
    expect(block).toContain('Codice organizzazione: QS');
    expect(block).toContain('P.IVA studio: IT12345678901');
    expect(block).toContain('Prefisso numerazione audit: RAP');
    expect(block).toContain('Specializzati in metalmeccanica e saldatura.');
    expect(block).toContain('FINE CONTESTO STUDIO');
  });

  it('omits empty optional fields', () => {
    const block = buildOrganizationContextBlock({
      organization_name: 'Al.project',
      organization_code: 'ALP',
      vat_number: '',
      audit_report_prefix: null,
      ai_context_notes: null,
    });

    expect(block).toContain('Studio: Al.project');
    expect(block).not.toContain('P.IVA studio');
    expect(block).not.toContain('Prefisso numerazione');
    expect(block).not.toContain('Note operative');
  });

  it('omits whitespace-only ai_context_notes', () => {
    const block = buildOrganizationContextBlock({
      organization_name: 'Test',
      organization_code: 'T',
      ai_context_notes: '   \n  ',
    });
    expect(block).not.toContain('Note operative');
  });
  });
});
