/**
 * Script per creare/verificare utente di test
 */

require('dotenv').config();
const { query } = require('../src/config/database');
const bcrypt = require('bcrypt');

async function setupTestUser() {
    try {
        console.log('🔍 Verifico utenti esistenti...\n');

        // Lista utenti esistenti
        const users = await query('SELECT user_id, email, full_name, role FROM users');

        if (users.recordset.length > 0) {
            console.log('📋 Utenti nel database:');
            users.recordset.forEach(u => {
                console.log(`  - ${u.email} (${u.full_name}) - Role: ${u.role}`);
            });
            console.log('\n');
        } else {
            console.log('⚠️  Nessun utente trovato nel database\n');
        }

        const testEmail = 'test@sgq.local';
        const testPassword = process.env.SGQ_TEST_USER_PASSWORD;
        if (!testPassword) {
            console.error('Imposta SGQ_TEST_USER_PASSWORD (password utente di test, non in repository).');
            process.exit(1);
        }
        const testName = 'Test User';

        // Verifica se esiste già
        const existingUser = await query(
            'SELECT user_id FROM users WHERE email = @email',
            { email: testEmail }
        );

        if (existingUser.recordset.length > 0) {
            // Aggiorna password
            const hashedPassword = await bcrypt.hash(testPassword, 10);
            await query(`
                UPDATE users 
                SET password_hash = @password_hash,
                    updated_at = GETDATE()
                WHERE email = @email
            `, {
                email: testEmail,
                password_hash: hashedPassword
            });

            console.log('✅ Password aggiornata per utente esistente');
        } else {
            // Crea nuovo utente
            const hashedPassword = await bcrypt.hash(testPassword, 10);

            // Verifica organizzazioni esistenti
            const orgs = await query('SELECT TOP 1 organization_id FROM organizations');

            if (orgs.recordset.length === 0) {
                console.log('❌ Nessuna organizzazione trovata. Creo organizzazione di test...');

                const newOrg = await query(`
                    INSERT INTO organizations (organization_name, subscription_plan)
                    OUTPUT INSERTED.organization_id
                    VALUES ('Test Organization', 'professional')
                `);

                const org_id = newOrg.recordset[0].organization_id;

                await query(`
                    INSERT INTO users (email, password_hash, full_name, role, organization_id, created_at, updated_at)
                    VALUES (@email, @password_hash, @full_name, 'admin', @organization_id, GETDATE(), GETDATE())
                `, {
                    email: testEmail,
                    password_hash: hashedPassword,
                    full_name: testName,
                    organization_id: org_id
                });

                console.log('✅ Organizzazione e utente creati');
            } else {
                const org_id = orgs.recordset[0].organization_id;

                await query(`
                    INSERT INTO users (email, password_hash, full_name, role, organization_id, created_at, updated_at)
                    VALUES (@email, @password_hash, @full_name, 'admin', @organization_id, GETDATE(), GETDATE())
                `, {
                    email: testEmail,
                    password_hash: hashedPassword,
                    full_name: testName,
                    organization_id: org_id
                });

                console.log('✅ Utente creato');
            }
        }

        console.log('\n📝 Credenziali per test:');
        console.log(`   Email: ${testEmail}`);
        console.log(`   Password: ${testPassword}`);
        console.log('\n💡 Usa queste credenziali per il login:\n');
        console.log(`$response = Invoke-RestMethod -Uri "http://localhost:10443/api/v1/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"email":"${testEmail}","password":"${testPassword}"}'`);
        console.log(`$token = $response.data.token`);
        console.log(`Invoke-RestMethod -Uri "http://localhost:10443/api/v1/standards" -Method GET -Headers @{"Authorization"="Bearer $token"}`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

setupTestUser();
