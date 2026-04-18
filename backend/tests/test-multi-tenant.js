/**
 * Test E2E Multi-Tenant
 * 
 * Scenario:
 * 1. Usa organizzazioni esistenti (ID 1 e 2)
 * 2. Crea 2 utenti (1 per organizzazione)
 * 3. Crea audit per ciascuna organizzazione
 * 4. Verifica isolamento: User A non vede audit di User B
 * 
 * Requisiti:
 * - Server in esecuzione su localhost:10443
 * - Database SGQ_ISO9001 con organizzazioni esistenti
 * - Standard ISO 9001 presente (standard_id = 1)
 */

const API_BASE = 'http://localhost:10443/api/v1';

const pwA = process.env.SGQ_TEST_MULTI_TENANT_PASSWORD_A;
const pwB = process.env.SGQ_TEST_MULTI_TENANT_PASSWORD_B;
if (!pwA || !pwB) {
    console.error('Imposta SGQ_TEST_MULTI_TENANT_PASSWORD_A e SGQ_TEST_MULTI_TENANT_PASSWORD_B (non in repository).');
    process.exit(1);
}

// Usa organizzazioni esistenti
const orgAId = 1; // DEFAULT_ORG (Organizzazione Predefinita)
const orgBId = 2; // TEST_ORG_B (Organizzazione Test B)

// Setup utenti
const users = {
    userA: {
        email: 'user.a@default-org.test',
        password: pwA,
        full_name: 'Mario Rossi',
        role: 'auditor'
    },
    userB: {
        email: 'user.b@test-org-b.test',
        password: pwB,
        full_name: 'Luigi Bianchi',
        role: 'auditor'
    }
};

// Stato test
let tokenA = null;
let tokenB = null;
let auditAId = null;
let auditBId = null;

console.log('🧪 Avvio Test E2E Multi-Tenant\n');
console.log('📋 Organizzazioni utilizzate:');
console.log(`   - ORG A: ID ${orgAId} (DEFAULT_ORG)`);
console.log(`   - ORG B: ID ${orgBId} (TEST_ORG_B)\n`);

/**
 * STEP 1: Registra utenti
 */
async function step1_registerUsers() {
    console.log('\n📋 STEP 1: Registrazione utenti');

    // Registra User A
    try {
        const respA = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...users.userA,
                organization_id: orgAId
            })
        });

        if (!respA.ok) {
            const error = await respA.json();
            throw new Error(`User A: ${error.error}`);
        }

        const dataA = await respA.json();
        tokenA = dataA.token;
        console.log(`   ✅ User A registrato: ${users.userA.email}`);
        console.log(`      Token: ${tokenA.substring(0, 20)}...`);
    } catch (error) {
        console.error(`   ❌ Errore registrazione User A:`, error.message);
        return false;
    }

    // Registra User B
    try {
        const respB = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...users.userB,
                organization_id: orgBId
            })
        });

        if (!respB.ok) {
            const error = await respB.json();
            throw new Error(`User B: ${error.error}`);
        }

        const dataB = await respB.json();
        tokenB = dataB.token;
        console.log(`   ✅ User B registrato: ${users.userB.email}`);
        console.log(`      Token: ${tokenB.substring(0, 20)}...`);
    } catch (error) {
        console.error(`   ❌ Errore registrazione User B:`, error.message);
        return false;
    }

    return true;
}

/**
 * STEP 2: Crea audit per ciascuna organizzazione
 */
async function step2_createAudits() {
    console.log('\n📋 STEP 2: Creazione audit');

    // Crea Audit A
    try {
        const respA = await fetch(`${API_BASE}/audits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                audit_number: 'AUDIT-A-001',
                client_name: 'Cliente Organizzazione A',
                project_year: 2025,
                audit_date: '2025-12-02',
                auditor_name: users.userA.full_name,
                audit_type: 'Certificazione',
                standard_ids: [1], // ISO 9001
                notes: 'Audit di test per ORG_A'
            })
        });

        if (!respA.ok) {
            const error = await respA.json();
            throw new Error(`Audit A: ${error.error}`);
        }

        const dataA = await respA.json();
        auditAId = dataA.data.audit_id;
        console.log(`   ✅ Audit A creato: ${dataA.data.audit_number} (ID: ${auditAId})`);
    } catch (error) {
        console.error(`   ❌ Errore creazione Audit A:`, error.message);
        return false;
    }

    // Crea Audit B
    try {
        const respB = await fetch(`${API_BASE}/audits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenB}`
            },
            body: JSON.stringify({
                audit_number: 'AUDIT-B-001',
                client_name: 'Cliente Organizzazione B',
                project_year: 2025,
                audit_date: '2025-12-02',
                auditor_name: users.userB.full_name,
                audit_type: 'Sorveglianza',
                standard_ids: [1], // ISO 9001
                notes: 'Audit di test per ORG_B'
            })
        });

        if (!respB.ok) {
            const error = await respB.json();
            throw new Error(`Audit B: ${error.error}`);
        }

        const dataB = await respB.json();
        auditBId = dataB.data.audit_id;
        console.log(`   ✅ Audit B creato: ${dataB.data.audit_number} (ID: ${auditBId})`);
    } catch (error) {
        console.error(`   ❌ Errore creazione Audit B:`, error.message);
        return false;
    }

    return true;
}

/**
 * STEP 3: Test isolamento multi-tenant
 */
async function step3_testIsolation() {
    console.log('\n📋 STEP 3: Test isolamento multi-tenant');

    // User A lista i propri audit (dovrebbe vedere solo Audit A)
    console.log('\n   🔍 User A richiede lista audit...');
    try {
        const respA = await fetch(`${API_BASE}/audits`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });

        if (!respA.ok) {
            throw new Error(`HTTP ${respA.status}`);
        }

        const dataA = await respA.json();
        const auditsA = dataA.data;

        console.log(`      Audit trovati: ${auditsA.length}`);
        auditsA.forEach(a => {
            console.log(`      - ${a.audit_number} (Org: ${a.organization_name})`);
        });

        // Verifica: deve contenere solo Audit A
        const hasAuditA = auditsA.some(a => a.audit_id === auditAId);
        const hasAuditB = auditsA.some(a => a.audit_id === auditBId);

        if (hasAuditA && !hasAuditB) {
            console.log(`      ✅ PASS: User A vede solo i propri audit`);
        } else {
            console.log(`      ❌ FAIL: Isolamento compromesso!`);
            console.log(`         - Vede Audit A: ${hasAuditA}`);
            console.log(`         - Vede Audit B: ${hasAuditB} (DOVREBBE ESSERE false)`);
            return false;
        }
    } catch (error) {
        console.error(`      ❌ Errore lista audit User A:`, error.message);
        return false;
    }

    // User B lista i propri audit (dovrebbe vedere solo Audit B)
    console.log('\n   🔍 User B richiede lista audit...');
    try {
        const respB = await fetch(`${API_BASE}/audits`, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });

        if (!respB.ok) {
            throw new Error(`HTTP ${respB.status}`);
        }

        const dataB = await respB.json();
        const auditsB = dataB.data;

        console.log(`      Audit trovati: ${auditsB.length}`);
        auditsB.forEach(a => {
            console.log(`      - ${a.audit_number} (Org: ${a.organization_name})`);
        });

        // Verifica: deve contenere solo Audit B
        const hasAuditA = auditsB.some(a => a.audit_id === auditAId);
        const hasAuditB = auditsB.some(a => a.audit_id === auditBId);

        if (hasAuditB && !hasAuditA) {
            console.log(`      ✅ PASS: User B vede solo i propri audit`);
        } else {
            console.log(`      ❌ FAIL: Isolamento compromesso!`);
            console.log(`         - Vede Audit A: ${hasAuditA} (DOVREBBE ESSERE false)`);
            console.log(`         - Vede Audit B: ${hasAuditB}`);
            return false;
        }
    } catch (error) {
        console.error(`      ❌ Errore lista audit User B:`, error.message);
        return false;
    }

    // User A tenta di accedere ad Audit B (dovrebbe fallire con 404)
    console.log('\n   🔐 User A tenta accesso ad Audit B (deve fallire)...');
    try {
        const respA = await fetch(`${API_BASE}/audits/${auditBId}`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });

        if (respA.status === 404) {
            console.log(`      ✅ PASS: Accesso negato (404)`);
        } else if (respA.ok) {
            const data = await respA.json();
            console.log(`      ❌ FAIL: User A ha avuto accesso ad Audit B!`);
            console.log(`         Dati: ${JSON.stringify(data)}`);
            return false;
        } else {
            console.log(`      ⚠️  Status inatteso: ${respA.status}`);
        }
    } catch (error) {
        console.error(`      ❌ Errore test accesso cross-org:`, error.message);
        return false;
    }

    return true;
}

/**
 * STEP 4: Test NC isolamento
 */
async function step4_testNCIsolation() {
    console.log('\n📋 STEP 4: Test NC isolamento');

    // Crea NC per Audit A
    let ncAId = null;
    try {
        const respA = await fetch(`${API_BASE}/non-conformities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                audit_id: auditAId,
                nc_number: 'NC-A-001',
                section_code: '4.1',
                description: 'Test NC per Audit A',
                severity: 'minor'
            })
        });

        if (!respA.ok) {
            const error = await respA.json();
            console.error(`   ❌ Risposta server (${respA.status}):`, JSON.stringify(error, null, 2));
            throw new Error(`NC A: ${error.error || 'Errore sconosciuto'}`);
        }

        const dataA = await respA.json();
        ncAId = dataA.data.nc_id;
        console.log(`   ✅ NC A creata: ${dataA.data.nc_number} (ID: ${ncAId})`);
    } catch (error) {
        console.error(`   ❌ Errore creazione NC A:`, error.message);
        return false;
    }

    // User B tenta di accedere a NC A (deve fallire con 404)
    console.log('\n   🔐 User B tenta accesso a NC A (deve fallire)...');
    try {
        const respB = await fetch(`${API_BASE}/non-conformities/${ncAId}`, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });

        if (respB.status === 404) {
            console.log(`      ✅ PASS: Accesso negato (404)`);
        } else if (respB.ok) {
            const data = await respB.json();
            console.log(`      ❌ FAIL: User B ha avuto accesso a NC A!`);
            console.log(`         Dati: ${JSON.stringify(data)}`);
            return false;
        } else {
            console.log(`      ⚠️  Status inatteso: ${respB.status}`);
        }
    } catch (error) {
        console.error(`      ❌ Errore test accesso cross-org NC:`, error.message);
        return false;
    }

    return true;
}

/**
 * STEP 5: Cleanup (opzionale)
 */
async function step5_cleanup() {
    console.log('\n📋 STEP 5: Cleanup (eseguire in SQL se necessario)');
    console.log(`
-- Elimina audit test
DELETE FROM audits WHERE audit_number IN ('AUDIT-A-001', 'AUDIT-B-001');

-- Elimina utenti test
DELETE FROM users WHERE email IN ('${users.userA.email}', '${users.userB.email}');
`);
}

/**
 * Esegui test completo
 */
async function runTests() {
    console.log('\n⚠️  Prima di eseguire questo test:');
    console.log('   1. Avviare server backend (npm run dev)');
    console.log('   2. Verificare che organizzazioni ID 1 e 2 esistano');
    console.log('   3. Eseguire: node tests/test-multi-tenant.js\n');

    try {
        // Step 1
        const step1Ok = await step1_registerUsers();
        if (!step1Ok) {
            console.error('\n❌ Test fallito a STEP 1');
            return;
        }

        // Step 2
        const step2Ok = await step2_createAudits();
        if (!step2Ok) {
            console.error('\n❌ Test fallito a STEP 2');
            return;
        }

        // Step 3
        const step3Ok = await step3_testIsolation();
        if (!step3Ok) {
            console.error('\n❌ Test fallito a STEP 3');
            return;
        }

        // Step 4
        const step4Ok = await step4_testNCIsolation();
        if (!step4Ok) {
            console.error('\n❌ Test fallito a STEP 4');
            return;
        }

        // Cleanup
        await step5_cleanup();

        console.log('\n✅ TUTTI I TEST PASSATI!\n');
        console.log('🎉 Isolamento multi-tenant funziona correttamente\n');

    } catch (error) {
        console.error('\n❌ Errore test:', error);
    }
}// Esegui solo se chiamato direttamente
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
