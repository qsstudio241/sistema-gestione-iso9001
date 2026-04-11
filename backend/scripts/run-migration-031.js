/**
 * run-migration-031.js
 * Esegue la migration 031: estende attachments per document registry files.
 * Uso: node backend/scripts/run-migration-031.js
 */

const sql = require('mssql');
const path = require('path');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL = `
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments') AND name = 'document_id'
)
BEGIN
    ALTER TABLE attachments ADD document_id INT NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments') AND name = 'doc_file_version'
)
BEGIN
    ALTER TABLE attachments ADD doc_file_version NVARCHAR(20) NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments') AND name = 'is_current_doc_version'
)
BEGIN
    ALTER TABLE attachments ADD is_current_doc_version BIT NULL DEFAULT 1;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_attachments_document_registry'
)
BEGIN
    ALTER TABLE attachments
        ADD CONSTRAINT FK_attachments_document_registry
        FOREIGN KEY (document_id) REFERENCES document_registry(id);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_attachments_document_id' AND object_id = OBJECT_ID('attachments')
)
BEGIN
    CREATE INDEX IX_attachments_document_id ON attachments(document_id);
END
`;

async function run() {
    console.log('Connessione al database...');
    await sql.connect(dbConfig);
    console.log('Connesso.');
    await sql.query(SQL);
    console.log('Migration 031 completata con successo.');
    await sql.close();
}

run().catch(err => {
    console.error('Errore migration 031:', err.message);
    process.exit(1);
});
