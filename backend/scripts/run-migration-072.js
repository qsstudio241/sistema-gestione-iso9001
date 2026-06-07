/**
 * run-migration-072.js ù NC Hardening (step-by-step per driver mssql)
 */
const sql = require('mssql');
const path = require('path');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const dbConfig = dbConfigAll.production || dbConfigAll;

async function runMigration() {
    const pool = await sql.connect({
        server: dbConfig.server,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        options: {
            encrypt: dbConfig.options?.encrypt ?? true,
            trustServerCertificate: dbConfig.options?.trustServerCertificate ?? true,
        },
    });

    try {
        const steps = [
            `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_custom_item_id') BEGIN ALTER TABLE non_conformities ADD source_custom_item_id INT NULL; END`,
            `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_source_custom_item') BEGIN ALTER TABLE non_conformities ADD CONSTRAINT FK_nc_source_custom_item FOREIGN KEY (source_custom_item_id) REFERENCES custom_checklist_items(id); END`,
            `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_nc_audit_custom_item_unique') BEGIN CREATE UNIQUE INDEX IX_nc_audit_custom_item_unique ON non_conformities (audit_id, source_custom_item_id) WHERE source_custom_item_id IS NOT NULL; END`,
            `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'approved_by') BEGIN ALTER TABLE non_conformities ADD approved_by INT NULL; END`,
            `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'approved_at') BEGIN ALTER TABLE non_conformities ADD approved_at DATETIME2 NULL; END`,
            `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_approved_by') BEGIN ALTER TABLE non_conformities ADD CONSTRAINT FK_nc_approved_by FOREIGN KEY (approved_by) REFERENCES users(user_id); END`,
        ];
        for (let i = 0; i < steps.length; i++) {
            await pool.request().query(steps[i]);
            console.log(`Step ${i + 1}/${steps.length} OK`);
        }
        const check = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities'
              AND COLUMN_NAME IN ('source_custom_item_id', 'approved_by', 'approved_at')
        `);
        if (check.recordset.length < 3) throw new Error('Colonne incomplete');
        console.log('VERIFICA OK migration 072');
    } finally {
        await pool.close();
    }
}

runMigration().catch(err => {
    console.error('ERRORE migration 072:', err.message);
    process.exit(1);
});
