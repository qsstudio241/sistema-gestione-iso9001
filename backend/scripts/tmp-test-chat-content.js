const https = require('https');
const API_HOST = 'www.fr-busato.it';
const API_PORT = 8443;

function httpRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: API_HOST, port: API_PORT, path, method,
      headers: { 'Content-Type': 'application/json', ...headers },
      rejectUnauthorized: false,
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    // Login
    const loginRes = await httpRequest('POST', '/api/v1/auth/login', {
      email: 'admin@sgq.local',
      password: process.env.SGQ_APP_PASSWORD || '',
    });
    const loginData = JSON.parse(loginRes.body);
    if (!loginData.success) { console.error('LOGIN FAIL:', loginRes.body); process.exit(1); }
    const token = loginData.token;
    console.log('LOGIN OK');

    // Chat: domanda su contenuto di un documento (non sul titolo)
    const chatRes = await httpRequest('POST', '/api/v1/ai/chat', {
      message: 'Cosa dice la norma ISO 10005 riguardo al contenuto tipico di un piano della qualita? Quali clausole ne parlano?',
    }, { Authorization: 'Bearer ' + token });

    console.log('Chat status: ' + chatRes.status);
    const chatData = JSON.parse(chatRes.body);
    if (chatData.success) {
      console.log('\n=== RISPOSTA AI ===');
      console.log(chatData.response ? chatData.response.substring(0, 800) : chatData.content?.substring(0, 800) || JSON.stringify(chatData).substring(0, 800));
      console.log('\n=== SOURCES ===');
      if (chatData.sources) console.log(JSON.stringify(chatData.sources.slice(0, 5), null, 2));
      else console.log('(nessuna source fornita)');
    } else {
      console.log('CHAT ERROR:', chatRes.body.substring(0, 500));
    }

    // Seconda domanda: sulle note audit
    const chatRes2 = await httpRequest('POST', '/api/v1/ai/chat', {
      message: 'Quali osservazioni hanno fatto i consulenti riguardo alla gestione documentale negli ultimi audit?',
    }, { Authorization: 'Bearer ' + token });

    console.log('\n\n=== TEST 2: DOMANDA SU NOTE AUDIT ===');
    console.log('Chat status: ' + chatRes2.status);
    const chatData2 = JSON.parse(chatRes2.body);
    if (chatData2.success) {
      console.log(chatData2.response ? chatData2.response.substring(0, 800) : chatData2.content?.substring(0, 800) || JSON.stringify(chatData2).substring(0, 800));
    } else {
      console.log('CHAT ERROR:', chatRes2.body.substring(0, 500));
    }
  } catch (e) {
    console.error('FATAL:', e.message);
  }
  process.exit(0);
})();
