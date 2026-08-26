/**
 * Test L1 — normBroker.service cascata 2-step (HK-7)
 */

jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../config/database', () => ({ query: jest.fn().mockResolvedValue({ recordset: [] }) }));

// Mock localStoreConnector
jest.mock('./normConnectors/localStoreConnector', () => ({
  getClauseText: jest.fn(),
  getFullNorm: jest.fn().mockResolvedValue([]),
  searchClauses: jest.fn().mockResolvedValue([]),
  listAvailableStandards: jest.fn().mockResolvedValue([]),
}));

// Mock normativaConnector con getClauseText
jest.mock('./normConnectors/normativaConnector', () => ({
  getClauseText: jest.fn(),
  isItalianPublicLaw: jest.fn().mockReturnValue(false),
}));

const localStore = require('./normConnectors/localStoreConnector');
const normativaConn = require('./normConnectors/normativaConnector');
const db = require('../config/database');

// Force fresh require of normBroker after mocks are set
let normBroker;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  // Re-apply mocks after resetModules
  jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
  jest.mock('../config/database', () => ({ query: jest.fn().mockResolvedValue({ recordset: [] }) }));
  jest.mock('./normConnectors/localStoreConnector', () => ({
    getClauseText: jest.fn(),
    getFullNorm: jest.fn().mockResolvedValue([]),
    searchClauses: jest.fn().mockResolvedValue([]),
    listAvailableStandards: jest.fn().mockResolvedValue([]),
  }));
  jest.mock('./normConnectors/normativaConnector', () => ({
    getClauseText: jest.fn(),
    isItalianPublicLaw: jest.fn().mockReturnValue(false),
  }));
  normBroker = require('./normBroker.service');
});

describe('normBroker.service — cascata getClauseText', () => {
  it('restituisce risultato local_db quando il connettore locale trova la clausola', async () => {
    const local = require('./normConnectors/localStoreConnector');
    local.getClauseText.mockResolvedValue({ text: 'Testo ISO', title: 'Pianificazione', fullRef: '8.1' });

    const result = await normBroker.getClauseText('ISO_9001_2015', '8.1', { organizationId: 10 });

    expect(result).toEqual({ text: 'Testo ISO', title: 'Pianificazione', fullRef: '8.1', source: 'local_db' });
    const db = require('../config/database');
    expect(db.query).not.toHaveBeenCalled(); // nessun norm_access_log per hit locale
  });

  it('prova il connettore secondario se locale non trova la clausola', async () => {
    const local = require('./normConnectors/localStoreConnector');
    local.getClauseText.mockResolvedValue(null);

    const plc = require('./normConnectors/normativaConnector');
    plc.getClauseText.mockResolvedValue({ text: 'Testo pubblico', title: 'Norma IT', fullRef: 'art.1' });

    const result = await normBroker.getClauseText('DLGS_231_2001', 'art.1', { organizationId: 7 });

    expect(result).toEqual({ text: 'Testo pubblico', title: 'Norma IT', fullRef: 'art.1', source: 'public_law' });
    const db = require('../config/database');
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO norm_access_log');
    expect(params).toMatchObject({ orgId: 7, stdCode: 'DLGS_231_2001', source: 'public_law' });
  });

  it('restituisce null e logga info se nessun connettore trova la clausola', async () => {
    const local = require('./normConnectors/localStoreConnector');
    local.getClauseText.mockResolvedValue(null);

    const plc = require('./normConnectors/normativaConnector');
    plc.getClauseText.mockResolvedValue(null);

    const result = await normBroker.getClauseText('ISO_9001_2015', '99.99', { organizationId: 5 });

    expect(result).toBeNull();
    const db = require('../config/database');
    expect(db.query).not.toHaveBeenCalled();
    const logger = require('../utils/logger');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('not found in any source'));
  });

  it('resolveClauseText: getClauseText null → textAvailable false e messaggio onesto (niente testo inventato)', async () => {
    const local = require('./normConnectors/localStoreConnector');
    local.getClauseText.mockResolvedValue(null);
    const plc = require('./normConnectors/normativaConnector');
    plc.getClauseText.mockResolvedValue(null);

    const result = await normBroker.resolveClauseText('ISO_9712_2022', '8.2', { organizationId: 3 });

    expect(result.textAvailable).toBe(false);
    expect(result.hit).toBeNull();
    expect(result.code).toBe(normBroker.NORM_ABSENT_CODE);
    expect(result.absentMessage).toMatch(/ISO 9712 2022/);
    expect(result.absentMessage).toMatch(/8\.2/);
    expect(result.absentMessage).toMatch(/archivio locale/);
    expect(result.absentMessage).toMatch(/Non valuto a caso/);
    expect(result.absentMessage).toMatch(/Registro Documenti/);
    expect(result.absentMessage).toMatch(/Carica norme/);
    expect(result.absentMessage).not.toMatch(/deve|shall|shall not|il requisito è/i);
  });

  it('resolveClauseText: standard sconosciuto (connettori vuoti) → stesso contratto, nessuna allucinazione', async () => {
    const local = require('./normConnectors/localStoreConnector');
    local.getClauseText.mockResolvedValue(null);
    const plc = require('./normConnectors/normativaConnector');
    plc.getClauseText.mockResolvedValue(null);

    const result = await normBroker.resolveClauseText('ISO_99999_2099', '1.1');

    expect(result.textAvailable).toBe(false);
    expect(result.hit).toBeNull();
    expect(result.absentMessage).toMatch(/ISO 99999 2099/);
    expect(result.absentMessage).toMatch(/chiedi allo studio/);
  });

  it('resolveClauseText: hit locale → textAvailable true, absentMessage null', async () => {
    const local = require('./normConnectors/localStoreConnector');
    local.getClauseText.mockResolvedValue({ text: '  Testo reale  ', title: 'T', fullRef: '8.1' });

    const result = await normBroker.resolveClauseText('ISO_9001_2015', '8.1');

    expect(result.textAvailable).toBe(true);
    expect(result.hit).toMatchObject({ text: '  Testo reale  ', source: 'local_db' });
    expect(result.absentMessage).toBeNull();
    expect(result.code).toBeNull();
  });

  it('buildNormAbsentMessage: standard intero, accenti UTF-8, percorso operativo', () => {
    const msg = normBroker.buildNormAbsentMessage({
      standardCode: 'ISO_3834_5_2021',
      kind: 'standard',
    });
    expect(msg).toMatch(/Lo standard ISO 3834 5 2021/);
    expect(msg).not.toMatch(/§/);
    expect(msg).toMatch(/NORME E LEGGI/);
    expect(msg).toContain('è');
    expect(msg).not.toContain('\uFFFD');
    expect(normBroker.resolveStandardAbsent('ISO_3834_5_2021')).toEqual({
      textAvailable: false,
      absentMessage: msg,
      code: 'NORM_TEXT_ABSENT',
      standardCode: 'ISO_3834_5_2021',
    });
  });

  it('logNormAccess degrada gracefully se la tabella non esiste', async () => {
    const db = require('../config/database');
    db.query.mockRejectedValue(new Error("Invalid object name 'norm_access_log'"));

    await expect(normBroker.logNormAccess(1, 'ISO_9001_2015', 'public_law')).resolves.toBeUndefined();
    const logger = require('../utils/logger');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('norm_access_log insert failed'), expect.any(String));
  });
});
