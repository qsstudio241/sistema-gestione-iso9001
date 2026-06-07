const {
  buildCitationsFromChunks,
  extractCitationLabel,
} = require('./aiCitations');

describe('aiCitations', () => {
  it('deduplicates by entity_type and entity_id keeping highest score', () => {
    const citations = buildCitationsFromChunks([
      { entity_type: 'non_conformity', entity_id: 10, chunk_text: 'NC 2024-01: difetto saldatura', score: 0.5 },
      { entity_type: 'non_conformity', entity_id: 10, chunk_text: 'NC 2024-01: altro estratto', score: 0.9 },
      { entity_type: 'risk', entity_id: 3, chunk_text: 'Rischio: caduta materiali. Contesto: cantiere', score: 0.7 },
    ]);

    expect(citations).toHaveLength(2);
    expect(citations[0]).toMatchObject({
      entityType: 'non_conformity',
      entityId: '10',
      score: 0.9,
      label: 'NC 2024-01: altro estratto',
    });
    expect(citations[1].entityType).toBe('risk');
  });

  it('extractCitationLabel uses first sentence and truncates long text', () => {
    const long = 'A'.repeat(120) + '. resto ignorato';
    expect(extractCitationLabel('document', long)).toHaveLength(100);
    expect(extractCitationLabel('document', 'Documento DOC-1 "Manuale" rev.2 (procedura)')).toBe(
      'Documento DOC-1 "Manuale" rev.2 (procedura)'
    );
  });

  it('returns empty array for invalid input', () => {
    expect(buildCitationsFromChunks(null)).toEqual([]);
    expect(buildCitationsFromChunks([])).toEqual([]);
  });
});
