/**
 * fix-nc-organization-id-vps.js
 * Fix CAT-3 — NC nc_id=1052 con organization_id=NULL
 * Recupera l'organization_id dall'audit padre (audit_id=35201).
 *
 * Eseguire sul VPS:
 *   scp -i /tmp/sgq_key -P 1122 ... spascarella@busato.selfip.com:/tmp/
 *   ssh -i /tmp/sgq_key -p 1122 ... spascarella@busato.selfip.com "node /tmp/fix-nc-organization-id-vps.js"
 *
 * Ref: docs/reference/DB_ORPHAN_REPORT_20260629.md — CAT-3
 */
'use strict';

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const mssql = require('/var/www/sgq-backend/node_modules/mssql');

const DB_CONFIG = {
    server: '127.0.0.1', port: 11043, database: 'SGQ_ISO9001',
    user: 'pascarella', password: '#Gestione2025@',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true,
               connectTimeout: 30000, requestTimeout: 60000 },
};

async function main() {
    const pool = await mssql.connect(DB_CONFIG);

    // 1. Verifica stato pre-fix
    const before = await pool.request().query(`
        SELECT nc.nc_id, nc.nc_number, nc.organization_id,
               a.organization_id AS audit_org_id, a.audit_number
        FROM non_conformities nc
        JOIN audits a ON a.audit_id = nc.audit_id
        WHERE nc.nc_id = 1052
    `);
    console.log('[pre-fix] NC 1052:', JSON.stringify(before.recordset[0]));

    if (before.recordset.length === 0) {
        console.log('[skip] NC 1052 non trovata — già eliminata o ID cambiato.');
        process.exit(0);
    }

    const row = before.recordset[0];
    if (row.organization_id !== null) {
        console.log('[skip] NC 1052 ha già organization_id=' + row.organization_id + ' — nessun fix necessario.');
        process.exit(0);
    }

    // 2. Applica fix
    const result = await pool.request().query(`
        UPDATE non_conformities
        SET organization_id = (
            SELECT a.organization_id FROM audits a WHERE a.audit_id = 35201
        )
        WHERE nc_id = 1052
          AND organization_id IS NULL
    `);
    console.log('[fix] Righe aggiornate:', result.rowsAffected[0]);

    // 3. Verifica post-fix
    const after = await pool.request().query(`
        SELECT nc_id, nc_number, organization_id FROM non_conformities WHERE nc_id = 1052
    `);
    console.log('[post-fix] NC 1052:', JSON.stringify(after.recordset[0]));

    if (after.recordset[0].organization_id !== null) {
        console.log('[OK] Fix applicato correttamente.');
    } else {
        console.error('[FAIL] organization_id ancora NULL dopo il fix!');
        process.exit(1);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('[ERRORE]', err.message);
    process.exit(1);
});
