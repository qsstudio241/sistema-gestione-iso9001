/**
 * Migration 087: company_id NOT NULL su qualifications + indice unico filtrato
 * Eseguire su VPS: node /tmp/run-migration-087-vps.js
 */
'use strict';
const mssql = require('/var/www/sgq-backend/node_modules/mssql');

const DB_CONFIG = {
    server: '127.0.0.1',
    port: 11043,
    database: 'SGQ_ISO9001',
    user: 'pascarella',
    password: '#Gestione2025@',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 120000,
    },
};

const SQL_BATCHES = [
    `-- 1) Backfill qualifiche orfane
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'company_id')
BEGIN
    UPDATE q
    SET q.company_id = fb.fallback_company_id
    FROM qualifications q
    INNER JOIN (
        SELECT ao.organization_id, MIN(c.id) AS fallback_company_id
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        GROUP BY ao.organization_id
    ) fb ON fb.organization_id = q.organization_id
    WHERE q.company_id IS NULL;
END`,
    `-- 2a) Drop indice su company_id (blocca ALTER COLUMN)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qualif_company' AND object_id = OBJECT_ID('qualifications'))
    DROP INDEX IX_qualif_company ON qualifications;`,
    `-- 2b) NOT NULL
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('qualifications')
      AND name = 'company_id'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE qualifications ALTER COLUMN company_id INT NOT NULL;
    PRINT 'Colonna qualifications.company_id impostata NOT NULL.';
END
ELSE
BEGIN
    PRINT 'Colonna qualifications.company_id già NOT NULL — nessuna modifica.';
END`,
    `-- 2c) Ricrea indice company_id
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qualif_company' AND object_id = OBJECT_ID('qualifications'))
    CREATE INDEX IX_qualif_company ON qualifications(company_id);`,
    `-- 3) Indice unico filtrato
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_qualif_org_company_cert_person_active'
      AND object_id = OBJECT_ID('qualifications')
)
BEGIN
    CREATE UNIQUE INDEX UX_qualif_org_company_cert_person_active
        ON qualifications (organization_id, company_id, certificate_number, person_name)
        WHERE status <> 'revocata'
          AND certificate_number IS NOT NULL
          AND certificate_number <> '';
    PRINT 'Indice UX_qualif_org_company_cert_person_active creato.';
END
ELSE
BEGIN
    PRINT 'Indice UX_qualif_org_company_cert_person_active già presente.';
END`,
];

async function run() {
    const batches = SQL_BATCHES;

    const pool = await mssql.connect(DB_CONFIG);
    for (let i = 0; i < batches.length; i++) {
        console.log(`[087] Batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batches[i]);
    }
    console.log('[087] Migration completata OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[087] ERRORE:', err.message);
    process.exit(1);
});
