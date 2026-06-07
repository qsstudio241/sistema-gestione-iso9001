'use strict';
/**
 * Smoke responsible-options su VPS (localhost:3000)
 */
process.chdir('/var/www/sgq-backend');
require('dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { query } = require('/var/www/sgq-backend/src/config/database');

const envContent = fs.readFileSync('/var/www/sgq-backend/.env', 'utf8');
const jwtMatch = envContent.match(/JWT_SECRET=([^\r\n]+)/);
const JWT_SECRET = jwtMatch ? jwtMatch[1].replace(/\r/g, '').trim() : null;
if (!JWT_SECRET) { console.error('JWT_SECRET missing'); process.exit(1); }

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/v1' + path, method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const userR = await query("SELECT TOP 1 user_id, email, role, organization_id FROM users WHERE email='admin@sgq.local'");
  const user = userR.recordset[0];
  const companyR = await query(`
    SELECT TOP 1 c.id AS company_id
    FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE ao.organization_id = @organization_id
    ORDER BY c.id
  `, { organization_id: user.organization_id });

  if (!user || !companyR.recordset[0]) {
    console.error('Missing user or company');
    process.exit(1);
  }

  const companyId = companyR.recordset[0].company_id;
  const token = jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role, organization_id: user.organization_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('user:', user.email, 'org:', user.organization_id, 'company_id:', companyId);

  for (const scope of ['attuazione', 'verifica']) {
    const path = `/non-conformities/responsible-options?company_id=${companyId}&scope=${scope}`;
    const res = await apiGet(path, token);
    console.log(`\nGET ${path}`);
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.data).slice(0, 400));
    if (res.status !== 200) process.exit(1);
  }

  console.log('\nOK responsible-options smoke');
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
