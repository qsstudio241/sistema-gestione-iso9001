/**
 * @jest-environment node
 *
 * Test L1 — smoke-remote risolve IPv4 via resolver pubblico e connette all'IP.
 * Nessuna chiamata HTTPS/DNS reale: resolver e https.request sono iniettati.
 */
const { EventEmitter } = require('events');
const {
  PUBLIC_DNS_SERVERS,
  RESOLVE4_RETRY_DELAYS_MS,
  createPublicResolver,
  resolveIpv4ViaPublicDns,
  lookupIpv4Literal,
  requestByIpv4,
  smokeGet,
  isTransientResolveError,
} = require('./smoke-remote');

function errWith(code, message = code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function mockHttpsRequest(capture, { statusCode = 200, body = '{"ok":true}' } = {}) {
  return (options, cb) => {
    capture.push(options);
    const res = new EventEmitter();
    res.statusCode = statusCode;
    const req = new EventEmitter();
    req.end = () => {
      cb(res);
      res.emit('data', body);
      res.emit('end');
    };
    req.destroy = () => {};
    return req;
  };
}

describe('smoke-remote — resolver pubblico IPv4', () => {
  it('usa 1.1.1.1 e 8.8.8.8, non il resolver di sistema', () => {
    expect(PUBLIC_DNS_SERVERS).toEqual(['1.1.1.1', '8.8.8.8']);
    const setServers = jest.fn();
    class FakeResolver {
      setServers(servers) { setServers(servers); }
    }
    const resolver = createPublicResolver(FakeResolver);
    expect(resolver).toBeInstanceOf(FakeResolver);
    expect(setServers).toHaveBeenCalledTimes(1);
    expect(setServers).toHaveBeenCalledWith(['1.1.1.1', '8.8.8.8']);
  });

  it('resolve4 sul hostname e restituisce la prima IPv4', async () => {
    const resolve4 = jest.fn().mockResolvedValue(['203.0.113.10', '203.0.113.11']);
    const ipv4 = await resolveIpv4ViaPublicDns('sistemi.fr-busato.it', {
      resolver: { resolve4 },
    });
    expect(resolve4).toHaveBeenCalledTimes(1);
    expect(resolve4).toHaveBeenCalledWith('sistemi.fr-busato.it');
    expect(ipv4).toBe('203.0.113.10');
  });

  it('se hostname è già IPv4 non chiama resolve4', async () => {
    const resolve4 = jest.fn();
    const ipv4 = await resolveIpv4ViaPublicDns('198.51.100.7', {
      resolver: { resolve4 },
    });
    expect(ipv4).toBe('198.51.100.7');
    expect(resolve4).not.toHaveBeenCalled();
  });

  it('ritenta resolve4 in piccolo su EAI_AGAIN poi usa la IPv4', async () => {
    let n = 0;
    const resolve4 = jest.fn().mockImplementation(async () => {
      n += 1;
      if (n < 2) throw errWith('EAI_AGAIN', 'query EAI_AGAIN sistemi.fr-busato.it');
      return ['203.0.113.10'];
    });
    const delays = [];
    const ipv4 = await resolveIpv4ViaPublicDns('sistemi.fr-busato.it', {
      resolver: { resolve4 },
      sleepFn: async (ms) => { delays.push(ms); },
    });
    expect(ipv4).toBe('203.0.113.10');
    expect(resolve4).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([RESOLVE4_RETRY_DELAYS_MS[0]]);
  });

  it('esauriti i retry di resolve4, rilancia', async () => {
    const resolve4 = jest.fn().mockRejectedValue(errWith('EAI_AGAIN', 'query EAI_AGAIN'));
    await expect(
      resolveIpv4ViaPublicDns('sistemi.fr-busato.it', {
        resolver: { resolve4 },
        sleepFn: async () => {},
      })
    ).rejects.toMatchObject({ code: 'EAI_AGAIN' });
    expect(resolve4).toHaveBeenCalledTimes(RESOLVE4_RETRY_DELAYS_MS.length + 1);
  });

  it('non ritenta un errore di resolve non transitorio', async () => {
    const resolve4 = jest.fn().mockRejectedValue(errWith('ESERVFAIL', 'servfail'));
    await expect(
      resolveIpv4ViaPublicDns('sistemi.fr-busato.it', {
        resolver: { resolve4 },
        sleepFn: async () => {},
      })
    ).rejects.toMatchObject({ code: 'ESERVFAIL' });
    expect(resolve4).toHaveBeenCalledTimes(1);
  });

  it('riconosce solo flake di resolve, non HTTP applicativi', () => {
    expect(isTransientResolveError(errWith('EAI_AGAIN'))).toBe(true);
    expect(isTransientResolveError(errWith('ENOTFOUND'))).toBe(true);
    expect(isTransientResolveError(new Error('HTTP 503'))).toBe(false);
    expect(isTransientResolveError(null)).toBe(false);
  });
});

describe('smoke-remote — lookup IPv4 literal (niente getaddrinfo sul hostname)', () => {
  it('accetta un letterale IPv4 e rifiuta il hostname', async () => {
    await new Promise((resolve, reject) => {
      lookupIpv4Literal('203.0.113.10', {}, (err, address, family) => {
        try {
          expect(err).toBeNull();
          expect(address).toBe('203.0.113.10');
          expect(family).toBe(4);
          resolve();
        } catch (e) { reject(e); }
      });
    });
    await new Promise((resolve, reject) => {
      lookupIpv4Literal('sistemi.fr-busato.it', {}, (err) => {
        try {
          expect(err).toBeTruthy();
          expect(err.code).toBe('ENOTFOUND');
          expect(err.message).toMatch(/sistemi\.fr-busato\.it/);
          resolve();
        } catch (e) { reject(e); }
      });
    });
  });
});

describe('smoke-remote — GET sull\'IPv4 con Host/SNI originali', () => {
  it('connette all\'IPv4 con Host e servername = hostname, lookup IPv4-only', async () => {
    const captured = [];
    const result = await requestByIpv4({
      ipv4: '203.0.113.10',
      hostname: 'sistemi.fr-busato.it',
      port: 8443,
      path: '/api/v1/smoke/testdb',
      token: 'tok',
      requestImpl: mockHttpsRequest(captured),
    });

    expect(result.statusCode).toBe(200);
    expect(captured).toHaveLength(1);
    const opts = captured[0];
    expect(opts.hostname).toBe('203.0.113.10');
    expect(opts.hostname).not.toBe('sistemi.fr-busato.it');
    expect(opts.port).toBe(8443);
    expect(opts.path).toBe('/api/v1/smoke/testdb');
    expect(opts.servername).toBe('sistemi.fr-busato.it');
    expect(opts.headers.Host).toBe('sistemi.fr-busato.it');
    expect(opts.headers['X-Smoke-Token']).toBe('tok');
    expect(opts.lookup).toBe(lookupIpv4Literal);
  });

  it('smokeGet: resolve4 pubblico poi un solo GET all\'IP (niente retry sul GET)', async () => {
    const resolve4 = jest.fn().mockResolvedValue(['198.51.100.7']);
    const requestFn = jest.fn().mockResolvedValue({ statusCode: 200, body: '{"ok":true}' });

    const result = await smokeGet({
      url: 'https://sistemi.fr-busato.it:8443/api/v1/smoke/testdb',
      token: 'tok',
      resolver: { resolve4 },
      requestFn,
    });

    expect(resolve4).toHaveBeenCalledTimes(1);
    expect(resolve4).toHaveBeenCalledWith('sistemi.fr-busato.it');
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(requestFn).toHaveBeenCalledWith({
      ipv4: '198.51.100.7',
      hostname: 'sistemi.fr-busato.it',
      port: 8443,
      path: '/api/v1/smoke/testdb',
      token: 'tok',
    });
    expect(result.statusCode).toBe(200);
  });

  it('non ritenta il GET se la connessione fallisce dopo un resolve ok', async () => {
    const resolve4 = jest.fn().mockResolvedValue(['198.51.100.7']);
    const requestFn = jest.fn().mockRejectedValue(errWith('ECONNRESET', 'socket hang up'));
    await expect(
      smokeGet({
        url: 'https://sistemi.fr-busato.it:8443/api/v1/smoke/testdb',
        token: 'tok',
        resolver: { resolve4 },
        requestFn,
      })
    ).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(resolve4).toHaveBeenCalledTimes(1);
  });
});
