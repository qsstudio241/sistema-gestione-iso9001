/**
 * run-migration-036.js
 * Fix BUG-A2: Aggiungere document_id IS NOT NULL al constraint CHK_attachments_parent
 */

const sql = require('mssql');
const fs  = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8')
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_036_DROP_CONSTRAINT = `
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_attachments_parent')
BEGIN
    ALTER TABLE attachments DROP CONSTRAINT CHK_attachments_parent;
    PRINT 'Constraint CHK_attachments_parent rimosso.';
END
ELSE
BEGIN
    PRINT 'Constraint CHK_attachments_parent non trovato.';
END
`;

const SQL_036_ADD_CONSTRAINT = `
ALTER TABLE attachments
ADD CONSTRAINT CHK_attachments_parent CHECK (
    audit_id IS NOT NULL OR 
    nc_id IS NOT NULL OR
    document_id IS NOT NULL OR
    custom_item_id IS NOT NULL
);
PRINT 'Nuovo constraint CHK_attachments_parent aggiunto con document_id.';
`;

async function runMigration() {
  let pool;
  try {
    console.log('Connessione al database per migration 036...');
    pool = await sql.connect(dbConfig);
    console.log('Connesso.');

    const batches = [
      SQL_036_DROP_CONSTRAINT,
      SQL_036_ADD_CONSTRAINT
    ];

    for (const batch of batches) {
      const result = await pool.request().query(batch);
      if (result && result.recordset) console.log(result.recordset);
    }

    console.log('Migration 036 completata con successo.');
  } catch (err) {
    console.error('Errore migration 036:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

runMigration();
