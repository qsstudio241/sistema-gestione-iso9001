/**
 * @jest-environment node
 */

jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

const { query } = require('../../config/database');
const {
  getClauseText,
  getFullNorm,
  searchClauses,
  listAvailableStandards,
} = require('./localStoreConnector');

describe('localStoreConnector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getClauseText', () => {
    it('returns { text, title, fullRef } when a row exists', async () => {
      query.mockResolvedValue({
        recordset: [
          {
            requirement_text: 'Org shall determine risks.',
            clause_title: 'Risk',
            clause_ref: '6.1',
          },
        ],
      });

      const out = await getClauseText('ISO_9001_2015', '6.1');

      expect(out).toEqual({
        text: 'Org shall determine risks.',
        title: 'Risk',
        fullRef: 'ISO_9001_2015 6.1',
      });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('FROM norm_requirements'),
        expect.objectContaining({
          standardCode: 'ISO_9001_2015',
          clauseRef: '6.1',
        })
      );
    });

    it('returns null when no row exists', async () => {
      query.mockResolvedValue({ recordset: [] });

      const out = await getClauseText('ISO_9001_2015', '99.99');

      expect(out).toBeNull();
    });
  });

  describe('getFullNorm', () => {
    it('returns clauses ordered by clause_ref via SQL ORDER BY', async () => {
      query.mockResolvedValue({
        recordset: [
          { clause_ref: '4.1', clause_title: 'A', requirement_text: 'ta' },
          { clause_ref: '5.1', clause_title: 'B', requirement_text: 'tb' },
        ],
      });

      const rows = await getFullNorm('ISO_9001_2015');

      expect(rows).toHaveLength(2);
      expect(rows[0].clause_ref).toBe('4.1');
      expect(rows[1].clause_ref).toBe('5.1');
      const [sql] = query.mock.calls[0];
      expect(sql).toMatch(/ORDER BY\s+clause_ref\s+ASC/i);
    });
  });

  describe('searchClauses', () => {
    it('searches all standards when standardCode is omitted', async () => {
      query.mockResolvedValue({
        recordset: [
          {
            standard_code: 'ISO_9001_2015',
            clause_ref: '8.4',
            clause_title: 'X',
            requirement_text: 'supply chain',
          },
        ],
      });

      const rows = await searchClauses('supply');

      expect(rows).toHaveLength(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('TOP (50)'),
        expect.objectContaining({
          pattern: '%supply%',
          filterStandard: null,
        })
      );
    });

    it('filters by standard_code when standardCode is provided', async () => {
      query.mockResolvedValue({ recordset: [] });

      await searchClauses('risk', 'ISO_45001_2018');

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          pattern: '%risk%',
          filterStandard: 'ISO_45001_2018',
        })
      );
    });

    it('returns empty array when keyword is blank', async () => {
      const rows = await searchClauses('   ');
      expect(rows).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('escapes LIKE wildcards in keyword', async () => {
      query.mockResolvedValue({ recordset: [] });

      await searchClauses('100%');

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          pattern: '%100[%]%',
        })
      );
    });
  });

  describe('listAvailableStandards', () => {
    it('returns aggregated clause counts per standard_code', async () => {
      query.mockResolvedValue({
        recordset: [
          { standard_code: 'ISO_9001_2015', clause_count: 100 },
          { standard_code: 'ISO_14001_2015', clause_count: 80 },
        ],
      });

      const rows = await listAvailableStandards();

      expect(rows).toEqual([
        { standard_code: 'ISO_9001_2015', clause_count: 100 },
        { standard_code: 'ISO_14001_2015', clause_count: 80 },
      ]);
      expect(query.mock.calls[0][0]).toMatch(/GROUP BY\s+standard_code/i);
    });
  });
});
