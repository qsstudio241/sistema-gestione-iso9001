/**
 * Verifica Fase 1: API (login, auditor-orgs, companies) + DB (auditor_orgs, companies)
 * Uso: node scripts/verify-fase1.js
 */

const https = require('https');

const API_BASE = 'https://www.fr-busato.it:8443/api/v1';
const LOGIN_EMAIL = 'admin@sgq.local';
const LOGIN_PASSWORD = process.env.SGQ_TEST_ADMIN_PASSWORD;
if (!LOGIN_PASSWORD) {
  console.error('Imposta SGQ_TEST_ADMIN_PASSWORD (password ambiente di test, non in repo).');
  process.exit(1);
}

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: json });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  console.log('=== Verifica Fase 1 Multi-Tenant ===\n');

  // 1. Login
  console.log('1. Login API...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.error('   ❌ Login fallito:', loginRes.status, loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.token;
  const user = loginRes.data.user || {};
  console.log('   ✅ Login OK - user:', user.email, '| role:', user.role, '| auditor_org_id:', user.auditor_org_id);

  const authHeader = { Authorization: `Bearer ${token}` };

  // 2. GET auditor-orgs
  console.log('\n2. GET /auditor-orgs...');
  const aoRes = await fetch(`${API_BASE}/auditor-orgs`, { headers: authHeader });
  if (aoRes.status !== 200) {
    console.error('   ❌ auditor-orgs fallito:', aoRes.status, aoRes.data);
  } else {
    const list = aoRes.data.data || aoRes.data || [];
    console.log('   ✅ auditor-orgs:', list.length, '→', list.map((a) => a.name).join(', '));
  }

  // 3. GET companies (con auditor_org_id=1 per superadmin)
  console.log('\n3. GET /companies?auditor_org_id=1...');
  const coRes = await fetch(`${API_BASE}/companies?auditor_org_id=1`, { headers: authHeader });
  if (coRes.status !== 200) {
    console.error('   ❌ companies fallito:', coRes.status, coRes.data);
  } else {
    const list = coRes.data.data || coRes.data || [];
    console.log('   ✅ companies:', list.length, list.length ? `→ ${list.map((c) => c.name).join(', ')}` : '(vuota)');
  }

  // 4. POST company (test)
  console.log('\n4. POST /companies (test)...');
  const createRes = await fetch(`${API_BASE}/companies`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verifica Fase1 Test',
      vat_number: 'IT12345678901',
      sector: 'Test',
      address: 'Via Test 1',
      auditor_org_id: 1,
    }),
  });
  if (createRes.status !== 201 && createRes.status !== 200) {
    console.error('   ❌ create company fallito:', createRes.status, createRes.data);
  } else {
    const created = createRes.data.data || createRes.data;
    const id = created?.id;
    console.log('   ✅ company creata, id:', id);
    if (id) {
      const delRes = await fetch(`${API_BASE}/companies/${id}?auditor_org_id=1`, {
        method: 'DELETE',
        headers: authHeader,
      });
      console.log('   🗑️  company eliminata (cleanup):', delRes.status === 200 ? 'OK' : delRes.status);
    }
  }

  // 5. DB check (opzionale)
  console.log('\n5. Verifica DB (auditor_orgs, companies)...');
  try {
    process.env.NODE_ENV = 'development';
    const db = require('../src/config/database');
    const sql = db.sql;
    const pool = await db.getPool();
    const ao = await pool.request().query('SELECT id, name FROM auditor_orgs');
    const co = await pool.request().query('SELECT id, name, auditor_org_id FROM companies');
    console.log('   ✅ auditor_orgs:', ao.recordset.length, ao.recordset.map((r) => r.name).join(', '));
    console.log('   ✅ companies:', co.recordset.length, co.recordset.length ? co.recordset.map((r) => r.name).join(', ') : '(vuota)');
    await db.closePool();
  } catch (err) {
    console.log('   ⚠️  DB non raggiungibile (normale da remoto):', err.message);
  }

  console.log('\n=== Verifica completata ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
