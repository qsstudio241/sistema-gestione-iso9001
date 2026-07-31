const EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const PASSWORD = process.env.SGQ_APP_PASSWORD;
const API = 'https://busato.selfip.com:8443/api/v1';

async function api(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const login = await api('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  const token = login.json.token;
  if (!token) throw new Error('login');

  const ncId = 1042;
  const steps = [];

  let r = await api('PUT', `/non-conformities/${ncId}`, token, { status: 'in_progress' });
  steps.push(['in_progress', r.status]);

  r = await api('PUT', `/non-conformities/${ncId}`, token, { status: 'resolved' });
  steps.push(['resolved', r.status]);

  r = await api('PUT', `/non-conformities/${ncId}`, token, {
    status: 'verified',
    verification_notes: 'Verifica efficacia simulazione Hardening 30/05/2026',
  });
  steps.push(['verified', r.status]);

  r = await api('PUT', `/non-conformities/${ncId}`, token, { status: 'closed' });
  steps.push(['closed without approval', r.status, r.json.code]);

  r = await api('POST', `/non-conformities/${ncId}/approve-closure`, token, {});
  steps.push(['approve-closure', r.status]);

  r = await api('PUT', `/non-conformities/${ncId}`, token, { status: 'closed' });
  steps.push(['closed after approval', r.status]);

  console.log(JSON.stringify(steps, null, 2));
  const ok = steps.find(s => s[0] === 'closed without approval')?.[1] === 400
    && steps.find(s => s[0] === 'approve-closure')?.[1] === 200
    && steps.find(s => s[0] === 'closed after approval')?.[1] === 200;
  if (!ok) process.exit(1);
  console.log('WORKFLOW_SIM_OK');
}

main().catch(e => { console.error(e.message); process.exit(1); });
