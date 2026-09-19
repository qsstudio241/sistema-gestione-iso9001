/**
 * Con una ISO selezionata i chunk di decreto già importati restano in retrieval.
 * Le altre norme tecniche no.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./aiProviderAdapter', () => ({ embed: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { buildNormChunkScopeClause } = require('./knowledgeIndexer.service');
const { isPublicLawChunkCode } = require('../utils/publicLawStandardCode');

describe('buildNormChunkScopeClause', () => {
  it('tiene i codici ISO e non scarta i decreti già importati', () => {
    const { sql, params } = buildNormChunkScopeClause(['ISO_9001', 'ISO_9001_2015']);

    expect(params).toEqual({ sc0: 'ISO_9001', sc1: 'ISO_9001_2015' });
    expect(sql).toContain('standard_code IN (@sc0, @sc1)');
    expect(sql).toContain("standard_code LIKE 'DLgs[_]%'");
    expect(sql).toContain("standard_code LIKE 'urn[_]nir[_]stato[_]%'");
    expect(sql).toContain("dr.doc_type IN ('decreto', 'legge')");
    expect(sql).not.toMatch(/LIKE 'ISO_%'/);
    expect(sql).not.toMatch(/LIKE 'UNI%/);
  });

  it('senza norma attiva non aggiunge filtro', () => {
    expect(buildNormChunkScopeClause([])).toEqual({ sql: '', params: {} });
    expect(buildNormChunkScopeClause(null)).toEqual({ sql: '', params: {} });
  });

  it('il pattern decreto non copre le norme tecniche', () => {
    expect(isPublicLawChunkCode('DLgs_152_2006')).toBe(true);
    expect(isPublicLawChunkCode('D_Lgs_81_08')).toBe(true);
    expect(isPublicLawChunkCode('ISO_14001_2015')).toBe(false);
    expect(isPublicLawChunkCode('ISO_3834_2_2021')).toBe(false);
  });
});
