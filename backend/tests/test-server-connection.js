/**
 * Test connessione server
 */

const API_BASE = 'http://localhost:10443/api/v1';

async function testConnection() {
    try {
        console.log('🔍 Test connessione al server...\n');
        console.log(`   URL: ${API_BASE}/health (o qualsiasi endpoint)\n`);

        const pwd = process.env.SGQ_TEST_REGISTER_PASSWORD;
        if (!pwd) {
            console.error('Imposta SGQ_TEST_REGISTER_PASSWORD (password solo per test locale, non in repository).');
            process.exit(1);
        }
        const resp = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@test.com',
                password: pwd,
                full_name: 'Test User',
                role: 'auditor',
                organization_id: 1
            })
        });

        console.log(`   ✅ Server risponde! Status: ${resp.status}`);
        const data = await resp.json();
        console.log(`   📋 Risposta:`, JSON.stringify(data, null, 2));

    } catch (error) {
        console.error(`   ❌ Server non raggiungibile:`, error.message);
        console.error(`\n   Verifica che il server sia avviato con: npm run dev`);
        process.exit(1);
    }
}

testConnection();
