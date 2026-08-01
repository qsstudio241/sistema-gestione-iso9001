import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const raw = readFileSync(resolve('c:/ProgettoISO/.cursor/mcp.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* optional */ }

const base = 'https://sistemi.fr-busato.it:8443/api/v1';

async function probe(label, email, password) {
  if (!email || !password) {
    console.log(label, 'SKIP no creds');
    return;
  }
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  if (!login.token) {
    console.log(label, 'LOGIN_FAIL', login.error || login.code || 'unknown');
    return;
  }
  const h = { Authorization: `Bearer ${login.token}` };
  const [qRes, cRes] = await Promise.all([
    fetch(`${base}/qualifications?page=1&limit=30`, { headers: h }),
    fetch(`${base}/companies?limit=200`, { headers: h }),
  ]);
  const qBody = await qRes.json().catch(() => ({}));
  const cBody = await cRes.json().catch(() => ({}));
  const qual = qBody?.qualifications;
  const companies = cBody?.companies ?? cBody?.data;
  console.log(label, {
    role: login.user?.role,
    org: login.user?.organization_id,
    qualStatus: qRes.status,
    qualIsArray: Array.isArray(qual),
    qualKeys: qBody && typeof qBody === 'object' ? Object.keys(qBody) : null,
    companiesStatus: cRes.status,
    companiesIsArray: Array.isArray(companies),
    companiesKeys: cBody && typeof cBody === 'object' ? Object.keys(cBody) : null,
    badCompaniesFallback: !!(cBody && !cBody.companies && cBody),
  });
}

await probe('admin', process.env.SGQ_APP_EMAIL, process.env.SGQ_APP_PASSWORD);
await probe('client_write', process.env.SGQ_CLIENT_COMPANY_EMAIL, process.env.SGQ_CLIENT_COMPANY_PASSWORD);
await probe('client_read', process.env.SGQ_CLIENT_VIEWER_EMAIL, process.env.SGQ_CLIENT_VIEWER_PASSWORD);
