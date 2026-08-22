/**
 * @jest-environment node
 *
 * Test L1 — retry DNS/rete di smoke-remote.js.
 * Nessuna chiamata HTTPS reale: sleep e fn sono iniettati.
 */
const {
  isTransientNetworkError,
  withTransientRetry,
  TRANSIENT_NETWORK_CODES,
  TRANSIENT_RETRY_DELAYS_MS,
} = require('./smoke-remote');

function errWith(code, message = code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

describe('smoke-remote — errori transitori', () => {
  it('riconosce EAI_AGAIN, ENOTFOUND, ECONNRESET, ETIMEDOUT', () => {
    expect(TRANSIENT_NETWORK_CODES).toEqual(['EAI_AGAIN', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT']);
    for (const code of TRANSIENT_NETWORK_CODES) {
      expect(isTransientNetworkError(errWith(code))).toBe(true);
    }
    expect(isTransientNetworkError(new Error('getaddrinfo EAI_AGAIN sistemi.fr-busato.it'))).toBe(true);
  });

  it('non tratta come transitori HTTP applicativi né ECONNREFUSED', () => {
    expect(isTransientNetworkError(errWith('ECONNREFUSED'))).toBe(false);
    expect(isTransientNetworkError(new Error('HTTP 503'))).toBe(false);
    expect(isTransientNetworkError(new Error('SMOKE-REMOTE: FAIL (HTTP 500)'))).toBe(false);
    expect(isTransientNetworkError(null)).toBe(false);
  });
});

describe('smoke-remote — withTransientRetry', () => {
  it('ritenta 3 volte con backoff 2s/4s/8s e poi ha successo', async () => {
    const delays = [];
    let calls = 0;
    const result = await withTransientRetry(
      async () => {
        calls += 1;
        if (calls < 4) throw errWith('EAI_AGAIN', 'getaddrinfo EAI_AGAIN host');
        return { statusCode: 200, body: '{"ok":true}' };
      },
      {
        sleepFn: async (ms) => { delays.push(ms); },
      }
    );

    expect(calls).toBe(4);
    expect(delays).toEqual([...TRANSIENT_RETRY_DELAYS_MS]);
    expect(result.statusCode).toBe(200);
  });

  it('non ritenta un errore non transitorio', async () => {
    let calls = 0;
    const delays = [];
    await expect(
      withTransientRetry(
        async () => {
          calls += 1;
          throw errWith('ECONNREFUSED', 'connect ECONNREFUSED');
        },
        { sleepFn: async (ms) => { delays.push(ms); } }
      )
    ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    expect(calls).toBe(1);
    expect(delays).toEqual([]);
  });

  it('esauriti i retry, rilancia l\'ultimo errore transitorio', async () => {
    let calls = 0;
    await expect(
      withTransientRetry(
        async () => {
          calls += 1;
          throw errWith('ETIMEDOUT', 'Timeout connessione (30s)');
        },
        { sleepFn: async () => {} }
      )
    ).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    expect(calls).toBe(4);
  });
});
