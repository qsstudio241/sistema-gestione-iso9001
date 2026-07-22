// Script smoke test management-reviews — eseguito via run-on-vps.ps1
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env.test' });
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 8443, path: '/test-api/api/v1' + path,
      method, agent,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  // 1. Login
  const login = await req('POST', '/auth/login', { email: 'marcocamellini@gmail.com', password: 'Camellini2026!' });
  if (!login.body.success) { console.error('LOGIN FALLITO:', JSON.stringify(login.body)); process.exit(1); }
  const token = login.body.token;
  console.log('LOGIN OK — role:', login.body.user.role, '| modules:', (login.body.user.modules || []).join(', '));

  // 2. Lista riesami
  const list = await req('GET', '/management-reviews', null, token);
  console.log('LIST STATUS:', list.status, '| body keys:', Object.keys(list.body).join(', '));
  console.log('LIST BODY:', JSON.stringify(list.body).substring(0, 300));

  // 3. input-summary (company_id=7 = ERAM TECHNOLOGIES)
  const summary = await req('GET', '/management-reviews/input-summary?company_id=7', null, token);
  console.log('SUMMARY STATUS:', summary.status, '| body:', JSON.stringify(summary.body).substring(0, 500));
}
main().catch(e => { console.error(e.message); process.exit(1); });
