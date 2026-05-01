/**
 * Script per eseguire migration 047 sul VPS.
 * node /tmp/run-migration-047-vps.js
 */
const { query } = require('/var/www/sgq-backend/src/config/database');

(async () => {
  console.log('Migration 047 — custom_item_id in attachments');
  try {
    // Step 1: aggiungi colonna (idempotente)
    const colCheck = await query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='attachments' AND COLUMN_NAME='custom_item_id'");
    if (colCheck.recordset.length === 0) {
      await query('ALTER TABLE dbo.attachments ADD custom_item_id INT NULL');
      console.log('Colonna custom_item_id aggiunta');
    } else {
      console.log('Colonna custom_item_id gia presente — skip');
    }

    // Step 2: FK (idempotente)
    const fkCheck = await query("SELECT name FROM sys.foreign_keys WHERE name='FK_attachments_custom_item_id'");
    if (fkCheck.recordset.length === 0) {
      await query(`ALTER TABLE dbo.attachments
        ADD CONSTRAINT FK_attachments_custom_item_id
        FOREIGN KEY (custom_item_id)
        REFERENCES dbo.custom_checklist_items(id)
        ON DELETE SET NULL`);
      console.log('FK FK_attachments_custom_item_id creata');
    } else {
      console.log('FK gia presente — skip');
    }

    // Step 3: indice (idempotente)
    const idxCheck = await query("SELECT name FROM sys.indexes WHERE name='IX_attachments_custom_item_id' AND object_id=OBJECT_ID('dbo.attachments')");
    if (idxCheck.recordset.length === 0) {
      await query(`CREATE INDEX IX_attachments_custom_item_id ON dbo.attachments (custom_item_id) WHERE custom_item_id IS NOT NULL`);
      console.log('Indice IX_attachments_custom_item_id creato');
    } else {
      console.log('Indice gia presente — skip');
    }

    // Verifica finale
    const verify = await query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='attachments' AND COLUMN_NAME='custom_item_id'");
    if (verify.recordset.length > 0) {
      console.log('VERIFICA OK: colonna custom_item_id presente in dbo.attachments');
      console.log('Migration 047 completata con successo');
    } else {
      console.error('ERRORE: colonna non trovata dopo migration');
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error('ERRORE:', e.message);
    process.exit(1);
  }
})();
