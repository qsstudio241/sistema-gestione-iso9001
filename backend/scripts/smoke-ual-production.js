/**
 * Smoke test leggero UAL-1..UAL-4 in PRODUZIONE (solo lettura, nessun dato creato).
 * Uso: node scripts/smoke-ual-production.js
 * Richiede env SGQ_APP_EMAIL / SGQ_APP_PASSWORD.
 */
const BASE = 'https://sistemi.fr-busato.it:8443/api/v1';

async function main() {
    const email = process.env.SGQ_APP_EMAIL;
    const password = process.env.SGQ_APP_PASSWORD;
    if (!email || !password) {
        console.error('SGQ_APP_EMAIL / SGQ_APP_PASSWORD mancanti');
        process.exit(1);
    }

    const results = [];

    // 1. Login
    const loginRes = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const loginBody = await loginRes.json();
    results.push({ step: 'login', status: loginRes.status, hasToken: !!loginBody.token, user: loginBody.user ? { id: loginBody.user.user_id, role: loginBody.user.role } : null });
    if (!loginBody.token) {
        console.log(JSON.stringify(results, null, 2));
        process.exit(1);
    }
    const token = loginBody.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. GET /admin/users
    const usersRes = await fetch(`${BASE}/admin/users`, { headers: authHeaders });
    const usersBody = await usersRes.json();
    const usersList = Array.isArray(usersBody) ? usersBody : (usersBody.data || usersBody.users || []);
    const samplePendingKeyPresent = usersList.length > 0 && Object.prototype.hasOwnProperty.call(usersList[0], 'pending_activation');
    results.push({
        step: 'GET /admin/users',
        status: usersRes.status,
        count: usersList.length,
        pending_activation_field_present: samplePendingKeyPresent,
    });

    const sampleUser = usersList.find(u => u.user_id) || usersList[0];
    const sampleUserId = sampleUser ? sampleUser.user_id : null;

    // 3. GET /admin/users/:id/company-access
    if (sampleUserId) {
        const caRes = await fetch(`${BASE}/admin/users/${sampleUserId}/company-access`, { headers: authHeaders });
        results.push({ step: `GET /admin/users/${sampleUserId}/company-access`, status: caRes.status });
    } else {
        results.push({ step: 'company-access', skipped: true, reason: 'nessun utente disponibile' });
    }

    // 4. GET /admin/users/:id/audit-log
    if (sampleUserId) {
        const alRes = await fetch(`${BASE}/admin/users/${sampleUserId}/audit-log`, { headers: authHeaders });
        results.push({ step: `GET /admin/users/${sampleUserId}/audit-log`, status: alRes.status });
    } else {
        results.push({ step: 'audit-log', skipped: true, reason: 'nessun utente disponibile' });
    }

    // 5. POST /auth/forgot-password con email inesistente
    const fpRes = await fetch(`${BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent-smoke-check@example.invalid' }),
    });
    const fpBody = await fpRes.json().catch(() => ({}));
    results.push({ step: 'POST /auth/forgot-password (email inesistente)', status: fpRes.status, message: fpBody.message });

    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE smoke test:', e.message); process.exit(1); });
