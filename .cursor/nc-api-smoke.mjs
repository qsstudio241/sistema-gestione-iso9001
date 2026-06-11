const EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const PASSWORD = process.env.SGQ_APP_PASSWORD;
const API = 'https://www.fr-busato.it:8443/api/v1';

async function main() {
  if (!PASSWORD) throw new Error('SGQ_APP_PASSWORD missing');
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const login = await loginRes.json();
  if (!login.success) throw new Error('Login failed');
  const token = login.token;
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const list = await fetch(`${API}/non-conformities?limit=5`, { headers: h });
  const listJson = await list.json();
  console.log('OK list NC', list.status, 'count', listJson.data?.length);

  const due = await fetch(`${API}/non-conformities/actions/due?due_within_days=30&overdue=true`, { headers: h });
  const dueJson = await due.json();
  console.log('OK actions/due', due.status, 'count', dueJson.data?.length);

  const nc = listJson.data?.find(n => n.status === 'verified' && !n.approved_at)
    || listJson.data?.find(n => n.status === 'open')
    || listJson.data?.[0];
  if (nc) {
    console.log('Sample NC', nc.nc_id, nc.status, 'approved_at', nc.approved_at || null);
  }

  console.log('SIM_API_OK');
}

main().catch(e => { console.error('SIM_API_FAIL', e.message); process.exit(1); });
