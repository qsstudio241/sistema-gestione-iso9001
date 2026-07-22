'use strict';

jest.mock('../config/database', () => ({
  getPool: jest.fn(),
}));

jest.mock('./alertMail.service', () => ({
  sendAlertEmail: jest.fn(),
}));

const { sendAlertEmail } = require('./alertMail.service');
const { runNcEscalationForOrg } = require('./ncAlertEscalation.service');

function daysFromNow(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function createSequentialPool(recordsets) {
  let call = 0;
  const request = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation(() => {
      const rs = recordsets[call] ?? { recordset: [] };
      call += 1;
      return Promise.resolve(rs);
    }),
  };
  return {
    request: jest.fn(() => request),
  };
}

describe('runNcEscalationForOrg', () => {
  const orgConfig = {
    organization_id: 1001,
    organization_name: 'Test Org',
    recipients_email: 'fallback@studio.it',
    alert_days_1: 30,
    alert_days_2: 7,
    alert_nc_open: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendAlertEmail.mockResolvedValue(true);
  });

  it('dryRun non invia email ma restituisce anteprima destinatari', async () => {
    const pool = createSequentialPool([
      {
        recordset: [{
          nc_id: 1,
          nc_number: 'NC-001',
          title: 'Prova',
          description: 'Desc',
          status: 'open',
          due_date: daysFromNow(-1),
          created_at: daysFromNow(-10),
          responsible_contact_email: 'resp@studio.it',
          responsible_contact_name: 'Mario',
          verification_contact_email: null,
          verification_contact_name: null,
        }],
      },
      { recordset: [] },
      { recordset: [] },
    ]);

    const result = await runNcEscalationForOrg(pool, orgConfig, { dryRun: true });

    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.sent).toBe(0);
    expect(result.wouldSend).toBe(1);
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].email).toBe('resp@studio.it');
    expect(result.recipients[0].ncCount).toBe(1);
  });

  it('invio reale chiama sendAlertEmail e logga su nc_notification_log', async () => {
    const pool = createSequentialPool([
      {
        recordset: [{
          nc_id: 2,
          nc_number: 'NC-002',
          title: 'Azione',
          description: 'Desc',
          status: 'in_progress',
          due_date: daysFromNow(-1),
          created_at: daysFromNow(-10),
          responsible_contact_email: 'azione@studio.it',
          responsible_contact_name: 'Luigi',
          verification_contact_email: null,
          verification_contact_name: null,
        }],
      },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
    ]);

    const result = await runNcEscalationForOrg(pool, orgConfig, { dryRun: false });

    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(result.wouldSend).toBe(1);
    expect(result.dryRun).toBe(false);
  });
});
