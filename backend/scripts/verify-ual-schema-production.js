/**
 * Verifica READ-ONLY schema produzione per UAL-1..UAL-4 (migrazioni 130/131/132).
 * Non esegue alcuna DDL: solo SELECT su sys.objects/sys.columns/sys.check_constraints.
 *
 * Uso: NODE_ENV=production node scripts/verify-ual-schema-production.js
 */
const { query, closePool } = require('../src/config/database');

async function main() {
    const results = {};

    const tables = await query(`
        SELECT name FROM sys.objects
        WHERE type = 'U' AND name IN ('user_audit_log', 'user_action_tokens')
    `);
    results.tables = tables.recordset.map(r => r.name);

    const col = await query(`
        SELECT c.name, ty.name AS type_name, c.is_nullable
        FROM sys.columns c
        JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID('dbo.users') AND c.name = 'pending_activation'
    `);
    results.pending_activation_column = col.recordset;

    const check = await query(`
        SELECT cc.name, cc.definition
        FROM sys.check_constraints cc
        WHERE cc.name = 'CK_user_audit_log_action'
    `);
    results.check_constraint = check.recordset;

    console.log(JSON.stringify(results, null, 2));

    await closePool();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE verifica schema:', e.message); process.exit(1); });
