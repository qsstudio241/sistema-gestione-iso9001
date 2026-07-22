/**
 * Migration 088: personnel_id su qualifications + person_code su company_personnel
 * Eseguire su VPS: node /tmp/run-migration-088-vps.js
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
    `IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'qualifications' AND COLUMN_NAME = 'personnel_id'
)
BEGIN
    ALTER TABLE qualifications ADD personnel_id INT NULL;
    PRINT 'Colonna qualifications.personnel_id aggiunta.';
END`,
    `IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'company_personnel' AND COLUMN_NAME = 'person_code'
)
BEGIN
    ALTER TABLE company_personnel ADD person_code NVARCHAR(50) NULL;
    PRINT 'Colonna company_personnel.person_code aggiunta.';
END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qualifications_personnel')
    ALTER TABLE qualifications
    ADD CONSTRAINT FK_qualifications_personnel
        FOREIGN KEY (personnel_id) REFERENCES company_personnel(id);`,
    `IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_qualif_personnel' AND object_id = OBJECT_ID('qualifications')
)
    CREATE INDEX IX_qualif_personnel ON qualifications (personnel_id)
    WHERE personnel_id IS NOT NULL;`,
    `IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_company_personnel_company_code'
      AND object_id = OBJECT_ID('company_personnel')
)
    CREATE INDEX IX_company_personnel_company_code
        ON company_personnel (company_id, person_code)
        WHERE person_code IS NOT NULL AND person_code <> '';`,
];

async function run() {
    const pool = await mssql.connect(DB_CONFIG);
    for (let i = 0; i < SQL_BATCHES.length; i++) {
        console.log(`[088] Batch ${i + 1}/${SQL_BATCHES.length}...`);
        await pool.request().query(SQL_BATCHES[i]);
    }
    console.log('[088] Migration completata OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[088] ERRORE:', err.message);
    process.exit(1);
});
