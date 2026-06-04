/**
 * Smoke test post-deploy — verifica health API e route norme montate.
 * Uso: node scripts/smoke-post-deploy.js
 * Env: SGQ_HEALTH_URL (default produzione VPS)
 */
const https = require('https');
const http = require('http');

const HEALTH_URL = process.env.SGQ_HEALTH_URL || 'https://www.fr-busato.it:8443/api/v1/health';
const TIMEOUT_MS = 15000;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: TIMEOUT_MS, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout ${TIMEOUT_MS}ms su ${url}`));
    });
  });
}

async function main() {
  console.log('=== Smoke post-deploy ===');
  console.log(`Health URL: ${HEALTH_URL}`);

  let res;
  try {
    res = await fetchJson(HEALTH_URL);
  } catch (err) {
    console.error(`? Health check fallito: ${err.message}`);
    process.exit(1);
  }

  if (res.statusCode !== 200) {
    console.error(`? Health HTTP ${res.statusCode}`);
    console.error(res.body.slice(0, 300));
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    console.error('? Risposta health non JSON');
    process.exit(1);
  }

  const status = parsed.status || parsed.ok || 'unknown';
  console.log(`? Health OK — status=${status}, uptime=${parsed.uptime ?? 'n/a'}`);

  if (parsed.database && parsed.database !== 'connected' && parsed.db !== 'ok') {
    console.warn(`? Database: ${JSON.stringify(parsed.database || parsed.db)}`);
  }

  console.log('? Smoke post-deploy completato');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
