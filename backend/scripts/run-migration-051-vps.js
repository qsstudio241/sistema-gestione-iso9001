/**
 * Migration 051 — doc_type_config
 * Eseguire sul VPS: node /tmp/run-migration-051-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    console.log('Connessione al DB in corso...');

    const checkTable = await query(`
        SELECT 1 AS found FROM sys.tables
        WHERE name = 'doc_type_config' AND schema_id = SCHEMA_ID('dbo')
    `);

    if (checkTable.recordset.length > 0) {
        console.log('??  Tabella doc_type_config già presente — nessuna azione.');
    } else {
        await query(`
            CREATE TABLE dbo.doc_type_config (
                id              INT IDENTITY(1,1) PRIMARY KEY,
                organization_id INT NOT NULL,
                doc_type        NVARCHAR(50) NOT NULL,
                prefix          NVARCHAR(20) NULL,
                auto_number     BIT NOT NULL CONSTRAINT DF_doc_type_config_auto_number DEFAULT (1),
                CONSTRAINT UQ_doc_type_org UNIQUE (organization_id, doc_type),
                CONSTRAINT FK_dtc_org FOREIGN KEY (organization_id)
                    REFERENCES dbo.organizations(organization_id)
            )
        `);
        console.log('? Tabella doc_type_config creata con successo.');
    }

    console.log('Migration 051 completata.');
    process.exit(0);
}

run().catch(err => {
    console.error('ERRORE MIGRATION 051:', err.message);
    process.exit(1);
});
