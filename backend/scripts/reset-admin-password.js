/**
 * Script: Reset Admin Password
 * Uso: node scripts/reset-admin-password.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const sql = require('mssql');

// Config database da .env
const config = {
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableArithAbort: true,
        encrypt: process.env.DB_ENCRYPT === 'true'
    }
};

async function resetPassword() {
    const newPassword = process.env.NEW_ADMIN_PASSWORD;
    if (!newPassword) {
        console.error('Imposta la variabile d\'ambiente NEW_ADMIN_PASSWORD (non versionare).');
        process.exit(1);
    }
    const email = 'admin@sgq.local';

    try {
        console.log('🔧 Connessione al database...');
        console.log(`   Server: ${config.server}:${config.port}`);
        console.log(`   Database: ${config.database}\n`);

        const pool = await sql.connect(config);
        console.log('✅ Connesso al database\n');

        // Verifica se admin esiste
        console.log(`🔍 Ricerca utente: ${email}`);
        const checkResult = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT user_id, email, full_name, role, is_active FROM users WHERE email = @email');

        if (checkResult.recordset.length === 0) {
            console.log('❌ Admin NON trovato!\n');
            console.log('📋 Utenti nel database:');
            const allUsers = await pool.request().query('SELECT email, role, is_active FROM users');
            allUsers.recordset.forEach(u => {
                console.log(`   - ${u.email} (${u.role}) [Active: ${u.is_active}]`);
            });
            await pool.close();
            process.exit(1);
        }

        const admin = checkResult.recordset[0];
        console.log('✅ Admin trovato:');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Ruolo: ${admin.role}`);
        console.log(`   Attivo: ${admin.is_active}\n`);

        if (!admin.is_active) {
            console.log('⚠️  Utente DISATTIVATO - attivazione...');
            await pool.request()
                .input('email', sql.NVarChar, email)
                .query('UPDATE users SET is_active = 1 WHERE email = @email');
            console.log('✅ Utente attivato\n');
        }

        console.log(`🔐 Generazione hash per password: ${newPassword}`);
        const passwordHash = await bcrypt.hash(newPassword, 10);
        console.log('✅ Hash generato\n');

        console.log('📝 Aggiornamento password...');
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('passwordHash', sql.NVarChar, passwordHash)
            .query(`
                UPDATE users
                SET password_hash = @passwordHash,
                    updated_at = GETDATE()
                WHERE email = @email
            `);

        if (result.rowsAffected[0] > 0) {
            console.log('✅ Password aggiornata!\n');
            console.log('================================');
            console.log('📋 CREDENZIALI ADMIN:');
            console.log('================================');
            console.log(`Email:    ${email}`);
            console.log(`Password: ${newPassword}`);
            console.log('================================\n');
        } else {
            console.log('❌ Errore aggiornamento');
        }

        await pool.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ ERRORE:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

resetPassword();
