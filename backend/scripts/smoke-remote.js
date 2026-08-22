/**
 * smoke-remote.js — Client smoke test remoto.
 *
 * Chiama GET https://<SMOKE_ENDPOINT>/api/v1/smoke/testdb con l'header
 * X-Smoke-Token e stampa il risultato.
 *
 * Il resolver del runner GitHub (Azure) fallisce spesso con
 * getaddrinfo EAI_AGAIN su sistemi.fr-busato.it. Ritentare lo stesso
 * lookup dà lo stesso esito. Quindi:
 *   1. resolve4 IPv4 via resolver pubblici 1.1.1.1 / 8.8.8.8
 *      (dns.promises.Resolver + setServers — non getaddrinfo del runner)
 *   2. GET HTTPS verso quell'IPv4, con Host + TLS SNI = hostname originale
 *      (il certificato resta valido). lookup custom: solo letterali IPv4.
 *
 * Retry piccolo solo su resolve4. Se il resolve riesce, un GET basta.
 *
 * Variabili d'ambiente (o argomenti CLI):
 *   SMOKE_ENDPOINT  — es. "sistemi.fr-busato.it:8443"  (schema https aggiunto automaticamente)
 *   SMOKE_TOKEN     — token segreto da GitHub Secret / variabile locale
 *
 * Uso locale:
 *   SMOKE_ENDPOINT=sistemi.fr-busato.it:8443 SMOKE_TOKEN=xxx node backend/scripts/smoke-remote.js
 *
 * Uso CI (GitHub Actions):
 *   - secrets.SMOKE_ENDPOINT + secrets.SMOKE_TOKEN → env vars del job
 *   - node backend/scripts/smoke-remote.js
 *
 * Esito OK → exit 0 | FAIL → exit 1
 */

const dns = require('dns');
const https = require('https');
const net = require('net');

const { Resolver } = dns.promises;

/** Resolver pubblici: bypassano getaddrinfo del runner Azure. */
const PUBLIC_DNS_SERVERS = Object.freeze(['1.1.1.1', '8.8.8.8']);
/** Retry piccolo solo su resolve4 (non sul GET). */
const RESOLVE4_RETRY_DELAYS_MS = Object.freeze([400, 800]);

function isTransientResolveError(err) {
  if (!err) return false;
  if (err.code === 'EAI_AGAIN' || err.code === 'ENOTFOUND' || err.code === 'ETIMEOUT') return true;
  const msg = String(err.message || '');
  return /(?:^|\b)(EAI_AGAIN|ENOTFOUND|ETIMEOUT)(?:\b|$)/.test(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPublicResolver(ResolverCtor = Resolver) {
  const resolver = new ResolverCtor();
  resolver.setServers([...PUBLIC_DNS_SERVERS]);
  return resolver;
}

/**
 * IPv4 via resolver pubblico. Non usa dns.lookup / getaddrinfo del runner.
 * `resolver` e `sleepFn` sono iniettabili per i test.
 */
async function resolveIpv4ViaPublicDns(hostname, {
  resolver,
  delays = RESOLVE4_RETRY_DELAYS_MS,
  sleepFn = sleep,
  onRetry,
} = {}) {
  if (net.isIPv4(hostname)) return hostname;

  const r = resolver || createPublicResolver();
  const maxAttempts = delays.length + 1;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const addresses = await r.resolve4(hostname);
      const ipv4 = Array.isArray(addresses) ? addresses[0] : addresses;
      if (!ipv4 || !net.isIPv4(ipv4)) {
        const empty = new Error(`resolve4 ${hostname}: nessuna IPv4`);
        empty.code = 'ENOTFOUND';
        throw empty;
      }
      return ipv4;
    } catch (err) {
      lastErr = err;
      const canRetry = isTransientResolveError(err) && attempt < maxAttempts;
      if (!canRetry) throw err;
      const delayMs = delays[attempt - 1];
      if (onRetry) onRetry({ err, attempt, delayMs, remaining: maxAttempts - attempt });
      await sleepFn(delayMs);
    }
  }
  throw lastErr;
}

/**
 * lookup per https.request: accetta solo letterali IPv4.
 * Rifiuta il hostname — niente getaddrinfo sul nome.
 */
function lookupIpv4Literal(host, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (!net.isIPv4(host)) {
    const err = new Error(`lookup IPv4-only: rifiutato hostname "${host}"`);
    err.code = 'ENOTFOUND';
    return callback(err);
  }
  if (options && options.all) {
    return callback(null, [{ address: host, family: 4 }]);
  }
  return callback(null, host, 4);
}

/**
 * GET HTTPS verso un IPv4 già risolto. Host + servername (SNI) restano il
 * hostname originale. `requestImpl` è iniettabile per i test.
 */
function requestByIpv4({
  ipv4,
  hostname,
  port,
  path,
  token,
  requestImpl = https.request,
}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: ipv4,
      port: port || 443,
      path,
      method: 'GET',
      headers: {
        'X-Smoke-Token': token,
        Host: hostname,
      },
      servername: hostname,
      lookup: lookupIpv4Literal,
      // Il VPS usa certificato self-signed / Let's Encrypt con hostname diverso:
      // in CI non abbiamo il CA bundle custom, quindi accettiamo qualsiasi cert.
      // Il token statico garantisce l'autenticità della risposta.
      rejectUnauthorized: false,
      timeout: 30000,
    };

    const req = requestImpl(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      const timeoutErr = new Error('Timeout connessione (30s)');
      timeoutErr.code = 'ETIMEDOUT';
      reject(timeoutErr);
    });

    req.end();
  });
}

function resolveTarget() {
  const endpoint = process.env.SMOKE_ENDPOINT || process.argv[2] || '';
  const token = process.env.SMOKE_TOKEN || process.argv[3] || '';
  if (!endpoint) {
    console.error('SMOKE-REMOTE: SMOKE_ENDPOINT non impostato. Imposta la variabile d\'ambiente o passa il valore come primo argomento CLI.');
    process.exit(1);
  }
  if (!token) {
    console.error('SMOKE-REMOTE: SMOKE_TOKEN non impostato. Imposta la variabile d\'ambiente o passa il valore come secondo argomento CLI.');
    process.exit(1);
  }
  const host = endpoint.replace(/^https?:\/\//, '');
  return { url: `https://${host}/api/v1/smoke/testdb`, token };
}

/**
 * Flusso CI: resolve4 pubblico → un solo GET all'IP.
 * `resolver` / `requestFn` / `sleepFn` iniettabili per i test.
 */
async function smokeGet({ url, token, resolver, requestFn, sleepFn, onRetry } = {}) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 443;
  const path = `${parsed.pathname}${parsed.search}`;
  const ipv4 = await resolveIpv4ViaPublicDns(hostname, { resolver, sleepFn, onRetry });
  const doRequest = requestFn || requestByIpv4;
  return doRequest({ ipv4, hostname, port, path, token });
}

async function main() {
  const { url, token } = resolveTarget();
  const parsed = new URL(url);
  console.log(
    `SMOKE-REMOTE: resolve4 ${parsed.hostname} via ${PUBLIC_DNS_SERVERS.join('/')} poi GET sull'IPv4 (Host/SNI=${parsed.hostname})`
  );
  try {
    const ipv4 = await resolveIpv4ViaPublicDns(parsed.hostname, {
      onRetry: ({ err, attempt, delayMs, remaining }) => {
        const code = err.code || err.message;
        console.warn(
          `SMOKE-REMOTE: resolve4 transitorio ${code} — ritento ${attempt}/${attempt + remaining} tra ${delayMs}ms`
        );
      },
    });
    console.log(`SMOKE-REMOTE: ${parsed.hostname} → ${ipv4}`);
    const { statusCode, body } = await requestByIpv4({
      ipv4,
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 443,
      path: `${parsed.pathname}${parsed.search}`,
      token,
    });

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      console.error(`SMOKE-REMOTE: risposta non JSON (HTTP ${statusCode}):\n${body}`);
      process.exit(1);
    }

    if (statusCode === 200 && data.ok) {
      console.log(`SMOKE-REMOTE: OK`);
      console.log(`  DB      : ${data.db}`);
      console.log(`  Tabelle : ${data.checks?.tables_total ?? '?'} (richieste ${data.checks?.tables_required ?? '?'})`);
      if (data.checks?.counts) {
        const c = data.checks.counts;
        console.log(`  Conteggi: orgs=${c.orgs} users=${c.users} audits=${c.audits} NCs=${c.ncs}`);
      }
      process.exit(0);
    } else {
      console.error(`SMOKE-REMOTE: FAIL (HTTP ${statusCode})`);
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((e) => console.error(`  - ${e}`));
      } else {
        console.error('  ', body);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error(`SMOKE-REMOTE: ERRORE — ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  PUBLIC_DNS_SERVERS,
  RESOLVE4_RETRY_DELAYS_MS,
  createPublicResolver,
  resolveIpv4ViaPublicDns,
  lookupIpv4Literal,
  requestByIpv4,
  smokeGet,
  isTransientResolveError,
};

if (require.main === module) {
  main();
}
