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
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return data;
}

const login = await req('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = login.token || login.accessToken || login.data?.token;
if (!token) throw new Error('No token in login response');
const auth = { Authorization: `Bearer ${token}` };

const chat = await req('/ai/chat', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ message: 'Quante non conformita aperte ci sono?', standardId: 1 }),
});

const citations = Array.isArray(chat.citations) ? chat.citations : [];
console.log('OK ai/chat sourcesCount:', chat.sourcesCount, 'citations:', citations.length);
if (citations.length > 0) {
  console.log('sample citation:', JSON.stringify(citations[0]));
}
if (typeof chat.sourcesCount !== 'number') {
  throw new Error('sourcesCount missing from response');
}
console.log('SMOKE_CITATIONS_A4_OK');
