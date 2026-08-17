/**
 * @jest-environment node
 *
 * Prefissi NNN in database/migrations/ da 100 in poi devono essere unici.
 * I doppioni storici (010, 052, 056, 073, 074) restano grandfathered.
 * Due file 149_*.sql (MC-1 vs ROO-15) sono passati al merge: Git non confligge
 * se i nomi differiscono. Questo test blocca la collisione da 100 in poi.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../../database/migrations');
const FROM_NUMBER = 100;

function listNumberedSql() {
  return fs.readdirSync(DIR).filter((f) => /^\d+[a-z]?_.*\.sql$/i.test(f));
}

function numericPrefix(filename) {
  const m = filename.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
}

describe('numerazione migrazioni', () => {
  it(`ogni prefisso NNN >= ${FROM_NUMBER} in database/migrations/ è unico`, () => {
    const files = listNumberedSql();
    expect(files.length).toBeGreaterThan(0);
    const byNum = new Map();
    for (const f of files) {
      const n = numericPrefix(f);
      if (!Number.isFinite(n) || n < FROM_NUMBER) continue;
      const key = String(n).padStart(3, '0');
      if (!byNum.has(key)) byNum.set(key, []);
      byNum.get(key).push(f);
    }
    const dupes = [...byNum.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([n, list]) => `${n}: ${list.join(', ')}`);
    expect(dupes).toEqual([]);
  });

  it('149 è solo material_certificates (MC-1); rischi sono 151/152', () => {
    const files = listNumberedSql();
    expect(files.filter((f) => f.startsWith('149_'))).toEqual(['149_material_certificates.sql']);
    expect(files).toContain('151_risks_analysis_method.sql');
    expect(files).toContain('152_risk_reviews.sql');
    expect(files.some((f) => f.startsWith('149_risks') || f.startsWith('150_risk'))).toBe(false);
  });
});
