/**
 * @jest-environment node
 */

/**
 * Filtro `?status=` / `?expiring_days=` di GET /qualifications sullo stato EFFETTIVO (data), non sulla
 * colonna salvata: stesso risultato di card (GET /qualifications/stats), filtro `?situazione=` e badge
 * menu (GET /alerts/count). Esegue l'SQL reale su SQLite in memoria (vedi helper).
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
const { listQualifications, getStats } = require('./qualifications.controller');
const { getAlertCount } = require('./alert.controller');
const {
  EFFECTIVE_STATUS_FILTER_SQL,
  effectiveStatusFilterSql,
  expiringDaysFilterSql,
  SITUAZIONE_BUCKET_SQL,
} = require('../services/qualificationExpirySql');
const harness = require('../tests/helpers/qualificationsSqliteHarness');

const { isoDay } = harness;
const maybe = harness.available ? describe : describe.skip;

// Una riga per ogni combinazione rilevante stato salvato / data effettiva.
const ROWS = [
  { id: 1, status: 'valida', expiry_date: isoDay(-10) },                 // salvata valida, scaduta
  { id: 2, status: 'valida', expiry_date: isoDay(10) },                  // urgente 30gg
  { id: 3, status: 'valida', expiry_date: isoDay(45) },                  // in scadenza 31-60
  { id: 4, status: 'valida', expiry_date: isoDay(200) },                 // valida
  { id: 5, status: 'scaduta', expiry_date: isoDay(200) },                // salvata scaduta, data futura
  { id: 6, status: 'in_scadenza', expiry_date: isoDay(200) },            // salvata in_scadenza, data lontana
  { id: 7, status: 'sospesa', expiry_date: isoDay(200) },
  { id: 8, status: 'revocata', expiry_date: isoDay(-5) },
  { id: 9, status: 'valida', expiry_date: null },                        // senza scadenza
  { id: 10, status: 'valida', expiry_date: isoDay(300), next_confirmation_due: isoDay(-3) }, // conferma 9606 scaduta
  { id: 11, status: 'in_scadenza', expiry_date: isoDay(5) },             // salvata in_scadenza, urgente
  { id: 12, status: 'scaduta', expiry_date: isoDay(-20) },               // salvata scaduta, scaduta
  { id: 13, status: 'valida', expiry_date: isoDay(25), organization_id: 2 }, // altra organizzazione
];

function run(handler, query, orgId = 1) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return handler({ query, user: { organization_id: orgId } }, res).then(() => res);
}
const listIds = async (query) => {
  const res = await run(listQualifications, { limit: '500', ...query });
  expect(res.status).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0].qualifications.map((q) => q.id).sort((a, b) => a - b);
};

describe('effectiveStatusFilterSql — mappa stati', () => {
  it('valida / in_scadenza / scaduta usano i bucket calcolati, mai la colonna salvata', () => {
    expect(effectiveStatusFilterSql('valida')).toContain(SITUAZIONE_BUCKET_SQL.valide);
    expect(effectiveStatusFilterSql('scaduta')).toContain(SITUAZIONE_BUCKET_SQL.scadute);
    const inScad = effectiveStatusFilterSql('in_scadenza');
    expect(inScad).toContain(SITUAZIONE_BUCKET_SQL.in_scadenza_60);
    expect(inScad).toContain(SITUAZIONE_BUCKET_SQL.urgenti_30);
    for (const k of ['valida', 'in_scadenza', 'scaduta']) {
      expect(effectiveStatusFilterSql(k)).not.toMatch(/q\.status\s*=\s*@status/);
      expect(effectiveStatusFilterSql(k)).not.toMatch(/q\.status\s*=\s*'(valida|in_scadenza|scaduta)'/);
    }
  });

  it('sospesa e revocata restano decisioni manuali sulla colonna', () => {
    expect(effectiveStatusFilterSql('sospesa')).toBe("(q.status = 'sospesa')");
    expect(effectiveStatusFilterSql('revocata')).toBe("(q.status = 'revocata')");
  });

  it('valore sconosciuto o vuoto: nessuna clausola effettiva (fallback sul parametro)', () => {
    expect(effectiveStatusFilterSql('boh')).toBeNull();
    expect(effectiveStatusFilterSql('')).toBeNull();
    expect(effectiveStatusFilterSql(undefined)).toBeNull();
    expect(effectiveStatusFilterSql('constructor')).toBeNull();
    expect(Object.isFrozen(EFFECTIVE_STATUS_FILTER_SQL)).toBe(true);
  });

  it('expiring_days negativo = bucket scadute; positivo = finestra sulla data effettiva', () => {
    expect(expiringDaysFilterSql(-1)).toBe(SITUAZIONE_BUCKET_SQL.scadute);
    const win = expiringDaysFilterSql(30);
    expect(win).toContain('@expDays');
    expect(win).toContain('q.next_confirmation_due');
    expect(win).not.toMatch(/q\.expiry_date\s*<=\s*(DATEADD|@)/);
  });
});

maybe('GET /qualifications?status= su dati reali (SQLite)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPool.mockResolvedValue(harness.makePool(harness.createDb(ROWS)));
  });

  it('status=valida: solo le righe valide per data (la salvata "scaduta" ma futura entra, la salvata "valida" ma passata no)', async () => {
    expect(await listIds({ status: 'valida' })).toEqual([4, 5, 6, 9]);
  });

  it('status=scaduta: salvata "valida" con data passata o conferma semestrale scaduta cade in scadute', async () => {
    expect(await listIds({ status: 'scaduta' })).toEqual([1, 10, 12]);
  });

  it('status=in_scadenza: finestra 0-60 giorni sulla data effettiva, non lo stato salvato', async () => {
    expect(await listIds({ status: 'in_scadenza' })).toEqual([2, 3, 11]);
  });

  it('status=sospesa / revocata: colonna salvata', async () => {
    expect(await listIds({ status: 'sospesa' })).toEqual([7]);
    expect(await listIds({ status: 'revocata' })).toEqual([8]);
  });

  it('status sconosciuto: nessuna riga (e nessun errore SQL)', async () => {
    expect(await listIds({ status: 'boh' })).toEqual([]);
  });

  it('isolamento multi-tenant: la riga di un\'altra organizzazione non compare mai', async () => {
    for (const status of ['valida', 'scaduta', 'in_scadenza']) {
      expect(await listIds({ status })).not.toContain(13);
    }
  });

  it('status si combina con il tab e con l\'azienda (AND)', async () => {
    getPool.mockResolvedValue(harness.makePool(harness.createDb([
      { id: 1, status: 'valida', expiry_date: isoDay(-1), company_id: 5, qualification_type: 'Saldatore ISO 9606-1' },
      { id: 2, status: 'valida', expiry_date: isoDay(-1), company_id: 6, qualification_type: 'Saldatore ISO 9606-1' },
      { id: 3, status: 'valida', expiry_date: isoDay(-1), company_id: 5, qualification_type: 'Operatore ISO 14732' },
    ])));
    expect(await listIds({ status: 'scaduta', company_id: '5', qualification_type: 'iso9606_1' })).toEqual([1]);
  });

  it('expiring_days usa la data effettiva: conferma semestrale imminente su un 9606 con certificato lontano', async () => {
    expect(await listIds({ expiring_days: '30' })).toEqual([2, 11]);
    expect(await listIds({ expiring_days: '-1' })).toEqual([1, 10, 12]);
  });
});

maybe('integrita contatori: lista = card = badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPool.mockResolvedValue(harness.makePool(harness.createDb(ROWS)));
  });

  it('ogni status ?status= coincide con la card e con ?situazione= corrispondente', async () => {
    const stats = (await run(getStats, {})).json.mock.calls[0][0];
    expect((await listIds({ status: 'valida' })).length).toBe(stats.valide);
    expect((await listIds({ status: 'scaduta' })).length).toBe(stats.scadute);
    expect((await listIds({ status: 'in_scadenza' })).length).toBe(stats.in_scadenza_60 + stats.in_scadenza_30);
    expect(await listIds({ status: 'valida' })).toEqual(await listIds({ situazione: 'valide' }));
    expect(await listIds({ status: 'scaduta' })).toEqual(await listIds({ situazione: 'scadute' }));
    expect((await listIds({ status: 'sospesa' })).length + (await listIds({ status: 'revocata' })).length).toBe(stats.non_attive);
  });

  it('totale = somma delle card e = righe della lista senza filtri', async () => {
    const stats = (await run(getStats, {})).json.mock.calls[0][0];
    expect(stats.valide + stats.in_scadenza_60 + stats.in_scadenza_30 + stats.scadute + stats.non_attive).toBe(stats.total);
    expect(stats.total).toBe((await listIds({})).length);
    expect(stats.urgent).toBe(stats.in_scadenza_30 + stats.scadute);
  });

  it('partizione: ogni riga cade in uno e un solo bucket di situazione (nessuna in zero, nessuna in due)', async () => {
    const all = await listIds({});
    const seen = {};
    for (const sit of ['valide', 'in_scadenza_60', 'urgenti_30', 'scadute', 'non_attive']) {
      for (const id of await listIds({ situazione: sit })) seen[id] = (seen[id] || 0) + 1;
    }
    expect(Object.keys(seen).map(Number).sort((a, b) => a - b)).toEqual(all);
    expect(Object.values(seen).every((n) => n === 1)).toBe(true);
  });

  it('badge menu = scadute + urgenti 30gg = righe di status scaduta + urgenti_30', async () => {
    const stats = (await run(getStats, {})).json.mock.calls[0][0];
    const badge = (await run(getAlertCount, {})).json.mock.calls[0][0];
    expect(badge.qualifications).toBe(stats.scadute + stats.in_scadenza_30);
    expect(badge.qualifications).toBe(
      (await listIds({ status: 'scaduta' })).length + (await listIds({ situazione: 'urgenti_30' })).length,
    );
  });
});
