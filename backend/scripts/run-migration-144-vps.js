/**
 * Migration 144 (VPS) — indice UNIQUE filtrato su auditor_orgs.email
 * (fix Bugbot PR #382, DEPUTYTASK1 provisioning nuovo studio).
 * Uso (solo su VPS, via SSH):
 *   node /tmp/run-migration-144-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        const dup = await pool.request().query(`
            SELECT LOWER(email) AS email_lc, COUNT(*) AS n
            FROM dbo.auditor_orgs
            WHERE email IS NOT NULL
            GROUP BY LOWER(email)
            HAVING COUNT(*) > 1
        `);
        if (dup.recordset.length > 0) {
            console.error('[144] ERRORE: email duplicate trovate, risolvere prima di creare l\'indice UNIQUE:', JSON.stringify(dup.recordset, null, 2));
            process.exitCode = 1;
            return;
        }

        const check = await pool.request().query(`
            SELECT 1 AS x FROM sys.indexes
            WHERE name = 'UX_auditor_orgs_email' AND object_id = OBJECT_ID('dbo.auditor_orgs')
        `);
        if (check.recordset.length === 0) {
            await pool.request().query(`
                CREATE UNIQUE INDEX UX_auditor_orgs_email
                ON dbo.auditor_orgs (email)
                WHERE email IS NOT NULL
            `);
            console.log('[144] Indice UX_auditor_orgs_email creato.');
        } else {
            console.log('[144] Indice UX_auditor_orgs_email gia esistente — skip.');
        }

        const verify = await pool.request().query(`
            SELECT name, is_unique, filter_definition
            FROM sys.indexes
            WHERE object_id = OBJECT_ID('dbo.auditor_orgs') AND name = 'UX_auditor_orgs_email'
        `);
        console.log('[144] Verifica:', JSON.stringify(verify.recordset, null, 2));
        console.log('[144] Migration completata.');
    } catch (e) {
        console.error('[144] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
