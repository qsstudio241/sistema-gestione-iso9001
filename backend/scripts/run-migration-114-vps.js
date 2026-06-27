/**
 * Migration 114 — fix indice univoco numerazione verbali CND per organizzazione
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    {
        name: 'drop UX_ndt_reports_number',
        sql: `
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_ndt_reports_number'
      AND object_id = OBJECT_ID('ndt_reports')
)
BEGIN
    DROP INDEX UX_ndt_reports_number ON ndt_reports;
    PRINT 'Indice UX_ndt_reports_number rimosso.';
END
ELSE PRINT 'UX_ndt_reports_number assente — skip.';
`,
    },
    {
        name: 'create UX_ndt_reports_org_number',
        sql: `
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_ndt_reports_org_number'
      AND object_id = OBJECT_ID('ndt_reports')
)
BEGIN
    CREATE UNIQUE INDEX UX_ndt_reports_org_number
        ON ndt_reports (organization_id, report_number)
        WHERE report_number IS NOT NULL;
    PRINT 'Indice UX_ndt_reports_org_number creato.';
END
ELSE PRINT 'UX_ndt_reports_org_number gia esistente — skip.';
`,
    },
];

async function main() {
    const pool = await getPool();
    for (const step of STEPS) {
        console.log(`\n--- ${step.name} ---`);
        const result = await pool.request().query(step.sql);
        const messages = result?.recordset?.map?.((r) => r['']) || [];
        if (messages.length) console.log(messages.join('\n'));
        console.log(`OK: ${step.name}`);
    }
    console.log('\nMIGRATION_114_OK');
    process.exit(0);
}

main().catch((err) => {
    console.error('MIGRATION_114_FAIL', err.message);
    process.exit(1);
});
