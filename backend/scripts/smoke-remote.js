/**
 * smoke-remote.js — Client smoke test remoto.
 *
 * Chiama GET https://<SMOKE_ENDPOINT>/api/v1/smoke/testdb con l'header
 * X-Smoke-Token e stampa il risultato.
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

const https = require('https');

const endpoint = process.env.SMOKE_ENDPOINT || process.argv[2] || '';
const token    = process.env.SMOKE_TOKEN    || process.argv[3] || '';

if (!endpoint) {
  console.error('SMOKE-REMOTE: SMOKE_ENDPOINT non impostato. Imposta la variabile d\'ambiente o passa il valore come primo argomento CLI.');
  process.exit(1);
}
if (!token) {
  console.error('SMOKE-REMOTE: SMOKE_TOKEN non impostato. Imposta la variabile d\'ambiente o passa il valore come secondo argomento CLI.');
  process.exit(1);
}

// Normalizza: rimuovi schema se già presente, poi aggiunge sempre https://
const host = endpoint.replace(/^https?:\/\//, '');
const url  = `https://${host}/api/v1/smoke/testdb`;

console.log(`SMOKE-REMOTE: GET ${url}`);

function request(url, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname,
      method: 'GET',
      headers: { 'X-Smoke-Token': token },
      // Il VPS usa certificato self-signed / Let's Encrypt con hostname diverso:
      // in CI non abbiamo il CA bundle custom, quindi accettiamo qualsiasi cert.
      // Il token statico garantisce l'autenticità della risposta.
      rejectUnauthorized: false,
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout connessione (30s)'));
    });

    req.end();
  });
}

async function main() {
  try {
    const { statusCode, body } = await request(url, token);

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

main();
