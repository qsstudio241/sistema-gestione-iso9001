const BASE = 'https://www.fr-busato.it:8443/api/v1';
const EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const PASSWORD = process.env.SGQ_APP_PASSWORD;
if (!PASSWORD) {
  console.error('SGQ_APP_PASSWORD missing');
  process.exit(1);
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

const login = await req('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = login.token || login.accessToken || login.data?.token;
if (!token) throw new Error('No token in login response');
const auth = { Authorization: `Bearer ${token}` };

console.log('OK login', login.user?.organization_name || login.user?.role);

const org = await req('/organizations/me', { headers: auth });
const notes = org.ai_context_notes || org.data?.ai_context_notes || '';
console.log('ai_context_notes length:', notes.length);
const smokeMarker = 'Smoke deploy AI context 2026-05-30';
if (notes.includes(smokeMarker)) {
  const cleaned = notes.replace(smokeMarker, '').replace(/\n{3,}/g, '\n\n').trim();
  await req('/organizations/me', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ ai_context_notes: cleaned }),
  });
  console.log('OK removed smoke note from ai_context_notes');
} else {
  console.log('OK no smoke note to remove');
}

const chat = await req('/ai/chat', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    message: 'Quali rilievi ci sono sulla clausola attiva?',
    standardId: 1,
    auditId: '00000000-0000-0000-0000-000000000001',
    clauseRef: '7.5',
    questionId: '2',
    questionText: 'Documentazione controllata',
    standardKey: 'ISO_9001',
  }),
});
console.log('OK ai/chat reply length:', (chat.reply || '').length, 'contextUsed:', chat.contextUsed);

const reindex = await req('/ai/reindex', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({}),
});
console.log('OK reindex totalChunks:', reindex.totalChunks);

console.log('SMOKE_SLICE2_OK');
