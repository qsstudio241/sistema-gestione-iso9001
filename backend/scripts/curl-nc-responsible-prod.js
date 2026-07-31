'use strict';
const https = require('https');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'sistemi.fr-busato.it', port: 8443, path: '/api/v1' + path, method,
      headers: { 'Content-Type': 'application/json' },
      rejectUnauthorized: false,
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const ADMIN_EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const ADMIN_PASSWORD = process.env.SGQ_APP_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('Imposta SGQ_APP_PASSWORD (vedi docs/how-to/ACCESSO_DEPLOY_AGENTS.md)');
  process.exit(1);
}

(async () => {
  const login = await req('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (login.status !== 200 || !login.data?.token) {
    console.error('Login failed', login.status, login.data);
    process.exit(1);
  }
  const token = login.data.token;
  const res = await req('GET', '/non-conformities/responsible-options?company_id=11&scope=attuazione', null, token);
  console.log('GET responsible-options status:', res.status);
  console.log(JSON.stringify(res.data).slice(0, 400));
  process.exit(res.status === 200 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
