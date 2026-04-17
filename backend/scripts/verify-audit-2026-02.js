/**
 * Verifica audit 2026-02: dati in DB e risposta API
 * Uso: node scripts/verify-audit-2026-02.js
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
            resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
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
  console.log('=== Verifica Audit 2026-02 ===\n');

  // 1. Login
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.error('Login fallito:', loginRes.status);
    process.exit(1);
  }
  const token = loginRes.data.token;
  const authHeader = { Authorization: `Bearer ${token}` };

  // 2. Lista audit
  const listRes = await fetch(`${API_BASE}/audits`, { headers: authHeader });
  const audits = listRes.data?.data || [];
  console.log('Audit in lista:', audits.length);
  audits.slice(0, 10).forEach((a) => console.log('  ', a.audit_id, a.audit_number, a.client_name));
  const audit2026 = audits.find((a) => (a.audit_number || '').includes('2026-02'));
  if (!audit2026) {
    console.log('Audit 2026-02 non trovato nella lista. Audit presenti:');
    audits.forEach((a) => console.log('  -', a.audit_number, a.client_name, '| id:', a.audit_id));
    process.exit(0);
  }

  const auditId = audit2026.audit_id;
  console.log('Audit trovato:', audit2026.audit_number, '| client:', audit2026.client_name, '| id:', auditId);

  // 3. Risposte checklist
  const respRes = await fetch(`${API_BASE}/audits/${auditId}/responses`, { headers: authHeader });
  const responses = respRes.data?.data || respRes.data || [];
  console.log('\nRisposte checklist dal server:', responses.length);

  // 4. DB diretto
  try {
    process.env.NODE_ENV = 'development';
    const db = require('../src/config/database');
    const pool = await db.getPool();

    const auditRow = await pool.request().input('aid', db.sql.Int, auditId).query(`
      SELECT audit_id, audit_number, client_name, project_year, status, total_questions, answered_questions
      FROM audits WHERE audit_id = @aid
    `);
    const arCount = await pool.request().input('aid', db.sql.Int, auditId).query(`
      SELECT COUNT(*) AS cnt FROM audit_responses WHERE audit_id = @aid
    `);

    console.log('\n--- DB ---');
    if (auditRow.recordset[0]) {
      const a = auditRow.recordset[0];
      console.log('Audit:', a.audit_number, '| client:', a.client_name, '| status:', a.status);
      console.log('total_questions:', a.total_questions, '| answered_questions:', a.answered_questions);
    }
    console.log('audit_responses in DB:', arCount.recordset[0]?.cnt || 0);

    await db.closePool();
  } catch (err) {
    console.log('DB:', err.message);
  }

  console.log('\n=== Fine verifica ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
