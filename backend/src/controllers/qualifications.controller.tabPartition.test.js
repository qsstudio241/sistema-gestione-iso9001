/**
 * @jest-environment node
 */

/**
 * Tab della pagina Qualifiche = partizione: ogni tipo sta in una e una sola scheda specifica
 * (oltre a "Tutti"), somma delle schede = Totale. Esegue l'SQL reale (lista e statistiche) su SQLite
 * in memoria con un catalogo di tipi noti.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
  companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
  assertMutatingAllowed: jest.fn().mockResolvedValue(null),
  assertCompanyRead: jest.fn().mockResolvedValue(null),
  hasCompanyAccessRows: jest.fn().mockReturnValue(false),
  sendAccessDenied: jest.fn(),
}));
jest.mock('../services/qualificationIngest.service', () => ({ extractQualificationFromPdf: jest.fn() }));
jest.mock('../services/ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/database');
const { listQualifications, getStats } = require('./qualifications.controller');
const { OCCUPATIONAL_TYPE_SET } = require('../constants/occupationalQualificationTypes');
const harness = require('../tests/helpers/qualificationsSqliteHarness');

const maybe = harness.available ? describe : describe.skip;

const TABS = ['iso9606_1', 'iso9606_2', 'iso14732', 'ndt', 'iso14731', 'pes_pav', 'salute_mansione', 'generico'];

// [tipo, scheda attesa]
const CATALOGO = [
  ['Saldatore ISO 9606-1', 'iso9606_1'],
  ['Saldatore ISO 9606-2', 'iso9606_2'],
  ['Operatore ISO 14732', 'iso14732'],
  ['Coordinatore ISO 14731', 'iso14731'],
  ['Operatore NDT UT Livello 2', 'ndt'],
  ['Operatore ISO 9712 RT', 'ndt'],
  ['Controllo PT livello 2', 'ndt'],
  ['Controllo ET livello 1', 'ndt'],
  ['Abilitazione PES', 'pes_pav'],
  ['Abilitazione PAV', 'pes_pav'],
  ['PES/PAV CEI 11-27', 'pes_pav'],
  ['Idoneità PAV', 'pes_pav'],
  ['Abilitazione Pav', 'pes_pav'],
  ['qualifica_pav', 'pes_pav'],
  ['idoneita pes', 'pes_pav'],
  ['PAV', 'pes_pav'],
  ['Corso lavori elettrici CEI 11-27', 'pes_pav'],
  ['Idoneità medica alla mansione', 'salute_mansione'],
  ['Sorveglianza sanitaria periodica', 'salute_mansione'],
  ['Corso antincendio', 'generico'],
  ['Posa pavimentazioni stradali', 'generico'],
  ['Corso Pavimentazione industriale', 'generico'],
  ['Addetto Pesatura', 'generico'],
  ['Addetto primo soccorso', 'generico'],
  ['Corso preposto sicurezza', 'generico'],
  ['Formazione specifica lavoratori', 'generico'],
  ['Attestato corso carrelli elevatori', 'generico'],
  ['qualifica_operatore', 'generico'],
  ['Test', 'generico'],
];

const rowsFromCatalogo = () => CATALOGO.map(([qualification_type], i) => ({ id: i + 1, qualification_type }));

function run(handler, query) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return handler({ query, user: { organization_id: 1 } }, res).then(() => res);
}
const tabIds = async (tab) => {
  const res = await run(listQualifications, { limit: '500', qualification_type: tab });
  expect(res.status).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0].qualifications.map((q) => q.id).sort((a, b) => a - b);
};
const tabStatsTotal = async (tab) => (await run(getStats, tab ? { qualification_type: tab } : {})).json.mock.calls[0][0].total;

const FE_PAGE = path.resolve(__dirname, '../../../app/src/pages/QualificationsPage.jsx');

describe('schede frontend = famiglie backend', () => {
  (fs.existsSync(FE_PAGE) ? it : it.skip)('le chiavi di TABS in QualificationsPage.jsx sono "tutti" + le 8 famiglie del backend', () => {
    const src = fs.readFileSync(FE_PAGE, 'utf8');
    const block = src.slice(src.indexOf('const TABS = ['), src.indexOf('];', src.indexOf('const TABS = [')));
    const keys = [...block.matchAll(/qualification_type:\s*"([^"]*)"/g)].map((m) => m[1]);
    expect(keys.filter(Boolean).sort()).toEqual([...TABS].sort());
    expect(keys.filter((k) => !k)).toHaveLength(1);
  });
});

describe('catalogo di partizione', () => {
  it('i tipi di salute mansione del codice sono tutti nel catalogo', () => {
    for (const t of OCCUPATIONAL_TYPE_SET) {
      if (['Idoneità medica alla mansione', 'Sorveglianza sanitaria periodica'].includes(t)) {
        expect(CATALOGO.some(([c, tab]) => c === t && tab === 'salute_mansione')).toBe(true);
      }
    }
  });
});

maybe('partizione delle schede Qualifiche (SQL reale su SQLite)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPool.mockResolvedValue(harness.makePool(harness.createDb(rowsFromCatalogo())));
  });

  it.each(CATALOGO.map(([type, tab], i) => [type, tab, i + 1]))('"%s" -> scheda %s (e in nessun\'altra)', async (_type, tab, id) => {
    for (const t of TABS) {
      const ids = await tabIds(t);
      if (t === tab) expect(ids).toContain(id);
      else expect(ids).not.toContain(id);
    }
  });

  it('nessuna riga in piu\' schede, nessuna riga in zero schede', async () => {
    const count = {};
    for (const t of TABS) for (const id of await tabIds(t)) count[id] = (count[id] || 0) + 1;
    expect(Object.keys(count)).toHaveLength(CATALOGO.length);
    expect(Object.values(count).every((n) => n === 1)).toBe(true);
  });

  it('somma delle schede = Tutti, sia nella lista sia nelle card (stats)', async () => {
    const tutti = (await run(listQualifications, { limit: '500' })).json.mock.calls[0][0].total;
    expect(tutti).toBe(CATALOGO.length);
    expect(await tabStatsTotal('')).toBe(CATALOGO.length);
    let sumList = 0;
    let sumStats = 0;
    for (const t of TABS) {
      sumList += (await tabIds(t)).length;
      sumStats += await tabStatsTotal(t);
    }
    expect(sumList).toBe(tutti);
    expect(sumStats).toBe(tutti);
  });

  it('stats del tab = righe della lista del tab', async () => {
    for (const t of TABS) expect(await tabStatsTotal(t)).toBe((await tabIds(t)).length);
  });
});
