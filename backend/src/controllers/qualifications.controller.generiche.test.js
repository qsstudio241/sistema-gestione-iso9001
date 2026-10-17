/**
 * @jest-environment node
 */

/**
 * Tab Generiche = complemento delle altre: un tipo generico che contiene per caso le lettere di una sigla
 * NDT (PT, ET, UT, RT...) dentro una parola resta in Generiche; le sigle vere (parola intera) vanno in NDT.
 * Vale anche per le chiavi non-tab (iso9712_xx, pes, pav). SQL reale su SQLite in memoria.
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

const { getPool } = require('../config/database');
const { listQualifications, getStats, QUALIFICATION_TAB_FAMILY_SQL } = require('./qualifications.controller');
const harness = require('../tests/helpers/qualificationsSqliteHarness');

const maybe = harness.available ? describe : describe.skip;
const TABS = ['iso9606_1', 'iso9606_2', 'iso14732', 'ndt', 'iso14731', 'pes_pav', 'salute_mansione', 'generico'];

// Generici con le lettere di una sigla NDT dentro una parola (o in minuscolo come parola comune).
const GENERICI = [
  'Corso Captazione',            // pt
  'Responsabile Reparto',        // rt
  'Segretaria di cantiere',      // et
  'Istruttore carrelli',         // ut
  'Corso Gestione Amtrak',       // mt
  'Corso Avvertimenti',          // vt
  'Formazione et aggiornamento', // "et" minuscolo come parola
  'Corso pt base',               // "pt" minuscolo come parola
  'Dirigente sicurezza',
  'Preposto di cantiere',
  'Addetto antincendio',
  'Certificato di formazione',
];
// Sigle vere (parola intera, maiuscolo) -> NDT.
const NDT = [
  'Controllo PT livello 2', 'Controllo ET livello 1', 'Controllo UT livello 2', 'Controllo RT livello 1',
  'Controllo VT livello 2', 'Controllo MT livello 2', 'Controllo PT2', 'Controllo PT-2', 'Operatore (ET)',
  'Operatore NDT livello 2', 'Operatore ISO 9712 livello 3',
];

const CATALOGO = [
  ...GENERICI.map((t) => [t, 'generico']),
  ...NDT.map((t) => [t, 'ndt']),
  ['Saldatore ISO 9606-1', 'iso9606_1'],
  ['Saldatore ISO 9606-2', 'iso9606_2'],
  ['Operatore ISO 14732', 'iso14732'],
  ['Coordinatore ISO 14731', 'iso14731'],
  ['Abilitazione PES', 'pes_pav'],
  ['Abilitazione PAV', 'pes_pav'],
  ['Idoneità medica alla mansione', 'salute_mansione'],
  ['Sorveglianza sanitaria periodica', 'salute_mansione'],
];
const idOf = (type) => CATALOGO.findIndex(([t]) => t === type) + 1;

function run(handler, query) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return handler({ query, user: { organization_id: 1 } }, res).then(() => res);
}
const idsFor = async (qualification_type) => {
  const res = await run(listQualifications, { limit: '500', ...(qualification_type ? { qualification_type } : {}) });
  expect(res.status).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0].qualifications.map((q) => q.id).sort((a, b) => a - b);
};
const statsTotal = async (qualification_type) =>
  (await run(getStats, qualification_type ? { qualification_type } : {})).json.mock.calls[0][0].total;

describe('Generiche: nessuna esclusione per sottostringa', () => {
  it('il complemento "generico" non contiene LIKE %XX% a 2 lettere, solo parole intere', () => {
    expect(QUALIFICATION_TAB_FAMILY_SQL).toContain("ELSE 'generico'");
    expect(QUALIFICATION_TAB_FAMILY_SQL).not.toMatch(/NOT LIKE/);
    expect(QUALIFICATION_TAB_FAMILY_SQL).not.toMatch(/LIKE '%(VT|PT|MT|UT|RT|ET)%'/);
    expect(QUALIFICATION_TAB_FAMILY_SQL).toContain("[^A-Za-z][VMPUER]T[^A-Za-z]");
  });
});

maybe('Generiche e NDT: confronto per parola intera (SQL reale su SQLite)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPool.mockResolvedValue(harness.makePool(harness.createDb(CATALOGO.map(([qualification_type], i) => ({ id: i + 1, qualification_type })))));
  });

  it.each(GENERICI)('"%s" resta in Generiche e non finisce in NDT', async (type) => {
    expect(await idsFor('generico')).toContain(idOf(type));
    expect(await idsFor('ndt')).not.toContain(idOf(type));
  });

  it.each(NDT)('"%s" va in NDT e non in Generiche', async (type) => {
    expect(await idsFor('ndt')).toContain(idOf(type));
    expect(await idsFor('generico')).not.toContain(idOf(type));
  });

  it('partizione: nessuna riga in piu\' schede o in zero schede, somma schede = Tutti (lista e card)', async () => {
    const count = {};
    let sumStats = 0;
    for (const t of TABS) {
      for (const id of await idsFor(t)) count[id] = (count[id] || 0) + 1;
      sumStats += await statsTotal(t);
    }
    expect(Object.keys(count)).toHaveLength(CATALOGO.length);
    expect(Object.values(count).every((n) => n === 1)).toBe(true);
    expect((await idsFor('')).length).toBe(CATALOGO.length);
    expect(sumStats).toBe(CATALOGO.length);
    expect(await statsTotal('')).toBe(CATALOGO.length);
  });

  it('per ogni tab specifico stats = righe della lista', async () => {
    for (const t of TABS) expect(await statsTotal(t)).toBe((await idsFor(t)).length);
  });

  it('i tipi gia assegnati ad altre schede non si spostano (9606-1/-2, 14732, 14731, salute mansione, PES/PAV)', async () => {
    expect(await idsFor('iso9606_1')).toEqual([idOf('Saldatore ISO 9606-1')]);
    expect(await idsFor('iso9606_2')).toEqual([idOf('Saldatore ISO 9606-2')]);
    expect(await idsFor('iso14732')).toEqual([idOf('Operatore ISO 14732')]);
    expect(await idsFor('iso14731')).toEqual([idOf('Coordinatore ISO 14731')]);
    expect(await idsFor('pes_pav')).toEqual([idOf('Abilitazione PES'), idOf('Abilitazione PAV')]);
    expect(await idsFor('salute_mansione')).toEqual([idOf('Idoneità medica alla mansione'), idOf('Sorveglianza sanitaria periodica')]);
  });

  it('chiavi non-tab per metodo: solo la sigla come parola intera, mai Istruttore/Reparto/Captazione', async () => {
    expect(await idsFor('iso9712_pt')).toEqual([idOf('Controllo PT livello 2'), idOf('Controllo PT2'), idOf('Controllo PT-2')]);
    expect(await idsFor('iso9712_ut')).toEqual([idOf('Controllo UT livello 2')]);
    expect(await idsFor('iso9712_rt')).toEqual([idOf('Controllo RT livello 1')]);
    expect(await idsFor('iso9712_et')).toEqual([idOf('Controllo ET livello 1'), idOf('Operatore (ET)')]);
    expect(await idsFor('iso9712_vt')).toEqual([idOf('Controllo VT livello 2')]);
    expect(await idsFor('iso9712_mt')).toEqual([idOf('Controllo MT livello 2')]);
  });

  it('chiavi non-tab pes / pav: parola intera senza distinzione di maiuscole', async () => {
    expect(await idsFor('pes')).toEqual([idOf('Abilitazione PES')]);
    expect(await idsFor('pav')).toEqual([idOf('Abilitazione PAV')]);
  });
});
