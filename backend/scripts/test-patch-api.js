/**
 * Test diretto endpoint PATCH /checklist/questions/:id
 * Esegue login, ottiene token, poi chiama la PATCH su question_id=122
 */
const https = require('https');

const BASE = 'https://www.fr-busato.it:8443';
const TEST_QUESTION_ID = 122;
const TEST_EXCERPT = '[TEST] Stralcio di verifica — può essere eliminato';

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const url = new URL(BASE + path);
        const opts = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
        };
        const req = https.request(opts, res => {
            let raw = '';
            res.on('data', d => raw += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

(async () => {
    const loginPassword = process.env.SGQ_TEST_ADMIN_PASSWORD;
    if (!loginPassword) {
        console.error('Imposta SGQ_TEST_ADMIN_PASSWORD (password ambiente di test, non in repository).');
        process.exit(1);
    }
    console.log('1. Login...');
    const login = await request('POST', '/api/v1/auth/login', {
        username: 'admin',
        password: loginPassword
    });
    console.log(`   Status: ${login.status}`);
    if (!login.body.token) {
        console.error('   ERRORE login:', JSON.stringify(login.body));
        process.exit(1);
    }
    const token = login.body.token;
    console.log(`   Token ottenuto: ${token.substring(0, 20)}...`);

    console.log('\n2. GET /api/v1/checklist/questions/all?standard_id=2');
    const list = await request('GET', '/api/v1/checklist/questions/all?standard_id=2', null, token);
    console.log(`   Status: ${list.status}`);
    if (list.status !== 200) {
        console.error('   ERRORE:', JSON.stringify(list.body));
    } else {
        console.log(`   Domande trovate: ${list.body.questions?.length}`);
    }

    console.log(`\n3. PATCH /api/v1/checklist/questions/${TEST_QUESTION_ID}`);
    const patch = await request('PATCH', `/api/v1/checklist/questions/${TEST_QUESTION_ID}`, {
        norm_excerpt: TEST_EXCERPT
    }, token);
    console.log(`   Status: ${patch.status}`);
    console.log(`   Risposta: ${JSON.stringify(patch.body)}`);

    if (patch.status === 200) {
        console.log('\n4. Verifica salvataggio...');
        const verify = await request('GET', '/api/v1/checklist/questions/all?standard_id=2', null, token);
        const q = verify.body.questions?.find(x => x.question_id === TEST_QUESTION_ID);
        console.log(`   norm_excerpt su question 122: "${q?.norm_excerpt}"`);

        // Pulisci il test
        console.log('\n5. Pulizia (ripristino vuoto)...');
        await request('PATCH', `/api/v1/checklist/questions/${TEST_QUESTION_ID}`, {
            norm_excerpt: ''
        }, token);
        console.log('   Ripristinato.');
    }

    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
