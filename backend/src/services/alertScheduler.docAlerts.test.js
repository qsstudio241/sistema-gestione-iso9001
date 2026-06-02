'use strict';

jest.mock('../config/database', () => ({
  getPool: jest.fn(),
}));

jest.mock('./alertMail.service', () => ({
  sendAlertEmail: jest.fn(),
}));

jest.mock('./docAlertEscalation.service', () => ({
  runDocEscalationForOrg: jest.fn(),
}));

const { getPool } = require('../config/database');
const { sendAlertEmail } = require('./alertMail.service');
const { runDocEscalationForOrg } = require('./docAlertEscalation.service');
const { runAlertJobForSendTime } = require('./alertScheduler');

function mockPoolRequest(recordsets = []) {
  let call = 0;
  return {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation(() => {
      const rs = recordsets[call] ?? { recordset: [] };
      call += 1;
      return Promise.resolve(rs);
    }),
  };
}

describe('alertScheduler runAlertJobForSendTime', () => {
  const originalAlertEnabled = process.env.ALERT_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALERT_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.ALERT_ENABLED = originalAlertEnabled;
  });

  it('usa escalation documenti quando digest legacy disabilitato', async () => {
    getPool.mockResolvedValue({
      request: () => mockPoolRequest([
        {
          recordset: [{
            organization_id: 1,
            recipients_email: 'admin@studio.it',
            alert_days_1: 30,
            alert_days_2: 7,
            alert_doc_expiry: 1,
            doc_use_legacy_digest: 0,
            doc_escalation_enabled: 1,
            organization_name: 'Studio Test',
          }],
        },
      ]),
    });
    runDocEscalationForOrg.mockResolvedValue({ sent: +2 });

    await runAlertJobForSendTime('08:00');

    expect(runDocEscalationForOrg).toHaveBeenCalledTimes(1);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('usa digest legacy quando doc_use_legacy_digest attivo', async () => {
    getPool.mockResolvedValue({
      request: () => mockPoolRequest([
        {
          recordset: [{
            organization_id: 1,
            recipients_email: 'admin@studio.it',
            alert_days_1: 30,
            alert_days_2: 7,
            alert_doc_expiry: 1,
            doc_use_legacy_digest: 1,
            organization_name: 'Studio Test',
          }],
        },
        { recordset: [] },
      ]),
    });
    sendAlertEmail.mockResolvedValue(true);

    await runAlertJobForSendTime('08:00');

    expect(runDocEscalationForOrg).not.toHaveBeenCalled();
  });
});
