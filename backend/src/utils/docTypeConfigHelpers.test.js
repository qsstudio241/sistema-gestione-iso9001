'use strict';

const {
  normalizeDocType,
  normalizeDocTypeConfigRows,
  LEGACY_DOC_TYPE_MAP,
} = require('./docTypeConfigHelpers');

describe('docTypeConfigHelpers', () => {
  it('normalizza etichette legacy a snake_case', () => {
    expect(normalizeDocType('Procedura')).toBe('procedura');
    expect(normalizeDocType('Istruzione Operativa')).toBe('istruzione');
    expect(normalizeDocType('wps')).toBe('wps');
  });

  it('unifica righe duplicate legacy + canonico', () => {
    const { rows, migrated } = normalizeDocTypeConfigRows([
      { doc_type: 'Procedura', prefix: 'OLD', auto_number: true },
      { doc_type: 'procedura', prefix: 'PG', auto_number: true, next_number: 5 },
    ]);
    expect(migrated).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].doc_type).toBe('procedura');
    expect(rows[0].prefix).toBe('PG');
    expect(rows[0].next_number).toBe(5);
  });

  it('espone mappa legacy nota', () => {
    expect(LEGACY_DOC_TYPE_MAP['Manuale']).toBe('manuale');
  });
});
