'use strict';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({ createTransport: (...a) => mockCreateTransport(...a) }));
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../utils/logger');
const { query } = require('../config/database');
const { sendAlertEmail, getEmailSuppression, isEmailSuppressed } = require('./alertMail.service');
const { createSourceRequest } = require('../controllers/librarySourceRequest.controller');

const ENV_KEYS = [
  'NODE_ENV',
  'DISABLE_EMAIL',
  'ENABLE_EMAIL_IN_TEST',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_PORT',
];

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

describe('alertMail guard (DISABLE_EMAIL / ambiente TEST)', () => {
  let saved;

  beforeEach(() => {
    saved = {};
    ENV_KEYS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
    process.env.SMTP_HOST = 'smtp.example.invalid';
    process.env.SMTP_USER = 'user@example.invalid';
    process.env.SMTP_PASS = 'pw';
    jest.clearAllMocks();
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it.each(['1', 'true', 'TRUE'])('DISABLE_EMAIL=%s sopprime anche in produzione', async (v) => {
    process.env.NODE_ENV = 'production';
    process.env.DISABLE_EMAIL = v;
    expect(getEmailSuppression()).toEqual({ suppressed: true, reason: 'DISABLE_EMAIL' });
    const ok = await sendAlertEmail('a@b.it', 'subj', '<p>x</p>');
    expect(ok).toBe(false);
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('NODE_ENV=test (VPS TEST / Jest) sopprime per default e non logga destinatari/contenuto', async () => {
    process.env.NODE_ENV = 'test';
    const ok = await sendAlertEmail('segreto@cliente.it', 'Oggetto riservato', '<p>contenuto</p>');
    expect(ok).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).toContain('email soppressa (ambiente TEST/DISABLE_EMAIL)');
    expect(logged).not.toContain('segreto@cliente.it');
    expect(logged).not.toContain('Oggetto riservato');
    expect(logged).not.toContain('contenuto');
  });

  it('NODE_ENV=test + ENABLE_EMAIL_IN_TEST=1 consente l invio', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_EMAIL_IN_TEST = '1';
    expect(isEmailSuppressed()).toBe(false);
    expect(await sendAlertEmail('a@b.it', 's', '<p>x</p>')).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('ENABLE_EMAIL_IN_TEST non scavalca DISABLE_EMAIL', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_EMAIL_IN_TEST = '1';
    process.env.DISABLE_EMAIL = '1';
    expect(isEmailSuppressed()).toBe(true);
    expect(await sendAlertEmail('a@b.it', 's', '<p>x</p>')).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it.each(['production', 'development', undefined])(
    'NODE_ENV=%s senza flag: guard NON attivo, invio chiamato',
    async (nodeEnv) => {
      if (nodeEnv) process.env.NODE_ENV = nodeEnv;
      expect(getEmailSuppression()).toEqual({ suppressed: false, reason: null });
      expect(await sendAlertEmail('a@b.it', 's', '<p>x</p>', 'cc@b.it')).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0]).toMatchObject({ to: 'a@b.it', subject: 's', cc: 'cc@b.it' });
    }
  );

  it.each(['0', 'false', ''])('DISABLE_EMAIL=%j non attiva il guard in produzione', async (v) => {
    process.env.NODE_ENV = 'production';
    process.env.DISABLE_EMAIL = v;
    expect(isEmailSuppressed()).toBe(false);
    expect(await sendAlertEmail('a@b.it', 's', '<p>x</p>')).toBe(true);
  });

  describe('POST /library/source-requests (createSourceRequest)', () => {
    function arrange() {
      query
        .mockResolvedValueOnce({ recordset: [] }) // dedupe
        .mockResolvedValueOnce({
          recordset: [
            {
              id: 99,
              source_code: 'ZZ-SMOKE-DUMMY-160',
              source_title: null,
              reason: 'smoke',
              quality_notes: null,
              closure_path: 'platform',
              requesting_organization_id: 1001,
              status: 'open',
            },
          ],
        }) // insert
        .mockResolvedValueOnce({ recordset: [{ email: 'super@admin.it' }] }); // superadmin emails
    }

    const req = () => ({
      user: { organization_id: 1001, user_id: 1 },
      body: { code: 'ZZ-SMOKE-DUMMY-160', reason: 'smoke', closurePath: 'platform' },
    });

    it('ambiente TEST: nessuna mail, emailed=false, suppressed=true, 201 invariato', async () => {
      process.env.NODE_ENV = 'test';
      arrange();
      const res = mockRes();
      await createSourceRequest(req(), res);
      expect(res.statusCode).toBe(201);
      expect(res.body.created).toBe(true);
      expect(res.body.emailed).toBe(false);
      expect(res.body.suppressed).toBe(true);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('produzione senza flag: mail inviata, emailed=true, nessun campo suppressed', async () => {
      process.env.NODE_ENV = 'production';
      arrange();
      query.mockResolvedValueOnce({ recordset: [] }); // UPDATE email_notified_at
      const res = mockRes();
      await createSourceRequest(req(), res);
      expect(res.statusCode).toBe(201);
      expect(res.body.emailed).toBe(true);
      expect(res.body).not.toHaveProperty('suppressed');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /notifications-config/test (sendTestEmail)', () => {
    it('ambiente TEST: non invia, risponde success con suppressed=true', async () => {
      process.env.NODE_ENV = 'test';
      const pool = {
        request: () => ({
          input: () => ({
            query: jest.fn().mockResolvedValue({ recordset: [{ recipients_email: 'x@y.it' }] }),
          }),
        }),
      };
      jest.resetModules();
      jest.doMock('../config/database', () => ({ getPool: jest.fn().mockResolvedValue(pool), query }));
      const ctrl = require('../controllers/notifications.controller');
      const res = mockRes();
      await ctrl.sendTestEmail({ user: { organization_id: 1001 } }, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ success: true, suppressed: true });
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
