/**
 * Smoke Fase C � login + GET /search + POST /ai/chat (auditor simulation).
 * Richiede SGQ_APP_PASSWORD in env (o .cursor/mcp.env con SGQ_APP_*).
 */
const fs = await import('fs');
const path = await import('path');

const API = 'https://www.fr-busato.it:8443/api/v1';
let EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
let PASSWORD = process.env.SGQ_APP_PASSWORD;

if (!PASSWORD) {
  try {
    const envPath = path.join(process.cwd(), '.cursor', 'mcp.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*(SGQ_APP_EMAIL|SGQ_APP_PASSWORD)=(.+)$/);
      if (m) {
        if (m[1] === 'SGQ_APP_EMAIL') EMAIL = m[2].trim();
        if (m[1] === 'SGQ_APP_PASSWORD') PASSWORD = m[2].trim();
      }
    }
  } catch { /* ignore */ }
}

if (!PASSWORD) {
  console.error('SGQ_APP_PASSWORD missing');
  process.exit(1);
}

async function req(urlPath, opts = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const login = await req('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.data?.success) {
  console.error('LOGIN_FAIL', login.status, login.data);
  process.exit(1);
}
const token = login.data.token;
const auth = { Authorization: `Bearer ${token}` };
const orgId = login.data.user?.organization_id;

console.log('LOGIN_OK org', orgId);

const scenarios = [];

async function runScenario(name, fn) {
  try {
    const result = await fn();
    scenarios.push({ name, ok: true, ...result });
    console.log(`OK ${name}`);
  } catch (e) {
    scenarios.push({ name, ok: false, error: e.message });
    console.error(`FAIL ${name}:`, e.message);
  }
}

await runScenario('health', async () => {
  const h = await req('/health');
  if (h.data?.status !== 'healthy') throw new Error('health not healthy');
  return { status: h.status };
});

await runScenario('search_nc_saldatura', async () => {
  const r = await req('/search?q=saldatura&entityTypes=non_conformity&limit=5', { headers: auth });
  if (r.status !== 200 || !r.data?.success) throw new Error(`search ${r.status}`);
  const hits = r.data.groups?.non_conformity?.length ?? 0;
  return { hits, totalCount: r.data.totalCount };
});

await runScenario('search_document_procedura', async () => {
  const r = await req('/search?q=procedura&entityTypes=document&limit=5', { headers: auth });
  if (r.status !== 200) throw new Error(`search ${r.status}`);
  const hits = r.data.groups?.document?.length ?? 0;
  return { hits, totalCount: r.data.totalCount };
});

await runScenario('search_nc_code', async () => {
  const r = await req('/search?q=NC-2024&entityTypes=non_conformity&limit=3', { headers: auth });
  if (r.status !== 200) throw new Error(`search ${r.status}`);
  const items = r.data.groups?.non_conformity || [];
  return { hits: items.length, sample: items[0]?.title || null };
});

await runScenario('search_company_filter', async () => {
  const companies = await req('/companies?limit=5', { headers: auth });
  const list = companies.data?.data || companies.data?.companies || companies.data || [];
  const first = Array.isArray(list) ? list[0] : null;
  if (!first) return { skipped: true, reason: 'no companies' };
  const cid = first.id || first.company_id;
  const rAll = await req('/search?q=NC&limit=10', { headers: auth });
  const rCo = await req(`/search?q=NC&companyId=${cid}&limit=10`, { headers: auth });
  const allHits = rAll.data.totalCount ?? 0;
  const coHits = rCo.data.totalCount ?? 0;
  const leak = (rCo.data.groups?.non_conformity || []).some(
    (item) => item.companyId != null && item.companyId !== cid,
  );
  if (leak) throw new Error('cross-company leak detected');
  return { companyId: cid, allHits, coHits, filterOk: coHits <= allHits };
});

await runScenario('ai_semantic_nc_simili', async () => {
  const r = await req('/ai/chat', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ message: 'Quali NC simili abbiamo visto su saldatura?' }),
  });
  if (r.status !== 200) throw new Error(`chat ${r.status}`);
  const citations = r.data.citations || r.data.data?.citations || [];
  return {
    replyLen: (r.data.reply || r.data.data?.reply || '').length,
    citations: citations.length,
    sourcesCount: r.data.sourcesCount ?? citations.length,
  };
});

console.log('\n--- SCENARIO_JSON ---');
console.log(JSON.stringify(scenarios, null, 2));

const failed = scenarios.filter((s) => !s.ok).length;
process.exit(failed > 0 ? 1 : 0);
