/**
 * Test L1 — ncExportHelpers (NC Hardening H5)
 */
import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildNcCsvContent } from '../utils/ncExportHelpers';

describe('ncExportHelpers', () => {
  it('escapeCsvCell quota campi con virgola', () => {
    expect(escapeCsvCell('NC-1, test')).toBe('"NC-1, test"');
  });

  it('buildNcCsvContent include header e righe', () => {
    const csv = buildNcCsvContent([
      { nc_number: 'NC-001', status: 'open', severity: 'minor', client_name: 'A', audit_number: 'AUD-1', due_date: '', source_type: 'manual', description: 'Desc', responsible_person: '', approved_at: '' },
    ]);
    expect(csv.split('\r\n')[0]).toContain('Numero NC');
    expect(csv).toContain('NC-001');
  });
});
