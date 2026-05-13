jest.mock('../config/database', () => ({
  query: jest.fn().mockResolvedValue({ recordset: [] }),
}));

jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

const { logAiInteraction } = require('./aiAuditTrail.middleware');

function flushSetImmediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('aiAuditTrail.middleware — logAiInteraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps res.json and strips _aiMeta from the payload sent to the client', async () => {
    const db = require('../config/database');
    const req = {
      user: { organization_id: 10, user_id: 20 },
    };
    const sent = [];
    const originalJson = jest.fn(function json(body) {
      sent.push(body);
      return this;
    });
    const res = {
      statusCode: 200,
      json: originalJson,
    };
    const next = jest.fn();

    const initialJson = res.json;
    logAiInteraction('assist')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toBe(initialJson);

    const bodyWithMeta = {
      answer: 'ok',
      _aiMeta: {
        provider: 'openai',
        model: 'gpt-4',
        tokens: { input: 3, output: 5 },
        cost: 0.001,
        contextSummary: 'test',
      },
    };

    res.json(bodyWithMeta);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ answer: 'ok' });
    expect(sent[0]._aiMeta).toBeUndefined();

    await flushSetImmediate();

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO ai_interactions');
    expect(params).toMatchObject({
      org_id: 10,
      user_id: 20,
      feature: 'assist',
      provider: 'openai',
      model: 'gpt-4',
      input_tokens: 3,
      output_tokens: 5,
      cost: 0.001,
      status: 'success',
      summary: 'test',
    });
    expect(typeof params.latency).toBe('number');
  });

  it('passes body through unchanged when _aiMeta is absent', async () => {
    const db = require('../config/database');
    const req = { user: {} };
    const sent = [];
    const res = {
      statusCode: 200,
      json(body) {
        sent.push(body);
      },
    };

    logAiInteraction('chat')(req, res, jest.fn());
    res.json({ only: 'data' });

    expect(sent).toEqual([{ only: 'data' }]);
    await flushSetImmediate();
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
