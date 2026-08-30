'use strict';

const {
  parseSourceGapsFromReply,
  SOURCE_GAPS_PROMPT_BLOCK,
  normalizeGap,
} = require('../utils/parseSourceGaps');

describe('parseSourceGaps', () => {
  it('estrae JSON e pulisce la reply', () => {
    const reply = `Manca la ISO 14555 per i range stud.

<<<SGQ_SOURCE_GAPS
[{"code":"ISO 14555:2025","title":"Arc stud welding","reason":"range piega","qualityNotes":"verificare Tabella 2","closurePath":"platform"}]
SGQ_SOURCE_GAPS>>>`;
    const { cleanReply, gaps } = parseSourceGapsFromReply(reply);
    expect(cleanReply).toContain('Manca la ISO 14555');
    expect(cleanReply).not.toContain('SGQ_SOURCE_GAPS');
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual(
      expect.objectContaining({
        code: 'ISO 14555:2025',
        closurePath: 'platform',
        qualityNotes: 'verificare Tabella 2',
      })
    );
  });

  it('senza blocco restituisce gaps vuoti', () => {
    const { cleanReply, gaps } = parseSourceGapsFromReply('Risposta normale');
    expect(cleanReply).toBe('Risposta normale');
    expect(gaps).toEqual([]);
  });

  it('normalizeGap scarta codice vuoto', () => {
    expect(normalizeGap({ code: '  ' })).toBeNull();
    expect(normalizeGap({ code: 'ISO 9001', closurePath: 'tenant' }).closurePath).toBe('tenant');
  });

  it('SOURCE_GAPS_PROMPT_BLOCK menziona il delimitatore', () => {
    expect(SOURCE_GAPS_PROMPT_BLOCK).toContain('SGQ_SOURCE_GAPS');
  });
});
