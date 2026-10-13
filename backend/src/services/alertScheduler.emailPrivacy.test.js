'use strict';

/**
 * Privacy log: i job dello scheduler non scrivono i destinatari (recipients_email) nei log.
 */
jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./alertMail.service', () => ({ sendAlertEmail: jest.fn() }));
jest.mock('./docAlertEscalation.service', () => ({ runDocEscalationForOrg: jest.fn() }));
jest.mock('./normValidityChecker.service', () => ({
  runScheduledValidityCheck: jest.fn(),
  runScheduledLegalRegisterCheck: jest.fn(),
}));

const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const { runScheduledValidityCheck, runScheduledLegalRegisterCheck } = require('./normValidityChecker.service');
const { runAlertJobForSendTime, runNormValidityJob } = require('./alertScheduler');
const { redactEmailsForLog } = require('../utils/ingestErrorMessage');

const RECIPIENTS = 'mario.rossi@example.test, anna.bianchi@example.test';

function allLogs() {
  return ['info', 'warn', 'error', 'debug'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n').toLowerCase();
}

function expectNoRecipientLeak() {
  const logged = allLogs();
  for (const leak of ['mario', 'rossi', 'anna', 'bianchi', 'example.test']) expect(logged).not.toContain(leak);
}

function poolWith(recordsets) {
  let call = 0;
  return {
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockImplementation(() => Promise.resolve(recordsets[call++] ?? { recordset: [] })),
    }),
  };
}

describe('alertScheduler: nessun destinatario nei log', () => {
  const originalAlertEnabled = process.env.ALERT_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALERT_ENABLED = 'true';
  });
  afterEach(() => {
    if (originalAlertEnabled === undefined) delete process.env.ALERT_ENABLED;
    else process.env.ALERT_ENABLED = originalAlertEnabled;
  });

  it('digest legacy documenti: riga con email#hash, invio con destinatari reali', async () => {
    getPool.mockResolvedValue(poolWith([
      { recordset: [{
        organization_id: 1, recipients_email: RECIPIENTS, alert_days_1: 30, alert_days_2: 7,
        alert_doc_expiry: 1, doc_use_legacy_digest: 1, organization_name: 'Studio Test',
      }] },
      { recordset: [{ is_expired: 1, document_name: 'Doc 1', expiry_date: '2026-01-01', days_remaining: -5 }] },
    ]));
    sendAlertEmail.mockResolvedValue(true);

    await runAlertJobForSendTime('08:00');

    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(sendAlertEmail.mock.calls[0][0]).toBe(RECIPIENTS);
    expect(logger.info).toHaveBeenCalledWith(
      `[AlertScheduler] Email digest legacy documenti inviata a ${redactEmailsForLog(RECIPIENTS)} per org 1`,
    );
    expectNoRecipientLeak();
  });

  it('norme/registro legale: riga con email#hash, invio con destinatari reali', async () => {
    getPool.mockResolvedValue(poolWith([
      { recordset: [{ organization_id: 2, organization_name: 'Studio Test', recipients_email: RECIPIENTS, enabled: 1 }] },
    ]));
    runScheduledValidityCheck.mockResolvedValue({ updated: [{ standard_code: 'ISO_9001', old_status: 'a', new_status: 'b' }] });
    runScheduledLegalRegisterCheck.mockResolvedValue({ updated: [] });
    sendAlertEmail.mockResolvedValue(true);

    await runNormValidityJob();

    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(sendAlertEmail.mock.calls[0][0]).toBe(RECIPIENTS);
    const line = logger.info.mock.calls.map((c) => String(c[0])).find((l) => l.includes('Email norme/registro legale inviata a'));
    expect(line).toContain(`inviata a ${redactEmailsForLog(RECIPIENTS)} `);
    expectNoRecipientLeak();
  });
});
