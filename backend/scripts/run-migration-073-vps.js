'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    `IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'commercial_case_documents' AND COLUMN_NAME = 'supplier_id'
    )
    BEGIN
        ALTER TABLE commercial_case_documents ADD supplier_id INT NULL;
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ccd_supplier')
    BEGIN
        ALTER TABLE commercial_case_documents
        ADD CONSTRAINT FK_ccd_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ccd_supplier_id')
    BEGIN
        CREATE INDEX IX_ccd_supplier_id
        ON commercial_case_documents (supplier_id)
        WHERE supplier_id IS NOT NULL;
    END`,
];

(async () => {
    console.log('Migration 073 — commercial_case_documents.supplier_id');
    try {
        for (let i = 0; i < STEPS.length; i++) {
            await query(STEPS[i]);
            console.log(`Step ${i + 1}/${STEPS.length} OK`);
        }
        const verify = await query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'commercial_case_documents' AND COLUMN_NAME = 'supplier_id'
        `);
        if (!verify.recordset.length) {
            console.error('ERRORE: colonna supplier_id assente');
            process.exit(1);
        }
        console.log('Migration 073 completata.', JSON.stringify(verify.recordset));
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 073:', e.message);
        process.exit(1);
    }
})();
