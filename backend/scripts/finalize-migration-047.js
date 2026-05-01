const { query } = require('/var/www/sgq-backend/src/config/database');
(async () => {
  try {
    // Crea indice se non esiste
    const idx = await query("SELECT name FROM sys.indexes WHERE name='IX_attachments_custom_item_id' AND object_id=OBJECT_ID('dbo.attachments')");
    if (idx.recordset.length === 0) {
      await query("CREATE INDEX IX_attachments_custom_item_id ON dbo.attachments (custom_item_id) WHERE custom_item_id IS NOT NULL");
      console.log('Indice creato');
    } else {
      console.log('Indice già presente');
    }
    // Verifica finale
    const col = await query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='attachments' AND COLUMN_NAME='custom_item_id'");
    const fk = await query("SELECT name FROM sys.foreign_keys WHERE name='FK_attachments_custom_item_id'");
    const ix = await query("SELECT name FROM sys.indexes WHERE name='IX_attachments_custom_item_id' AND object_id=OBJECT_ID('dbo.attachments')");
    console.log('Colonna:', col.recordset.length > 0 ? 'OK' : 'MANCANTE');
    console.log('FK:', fk.recordset.length > 0 ? 'OK' : 'MANCANTE');
    console.log('Indice:', ix.recordset.length > 0 ? 'OK' : 'MANCANTE');
    console.log('Migration 047 COMPLETATA');
    process.exit(0);
  } catch(e) {
    console.error('ERRORE:', e.message);
    process.exit(1);
  }
})();
