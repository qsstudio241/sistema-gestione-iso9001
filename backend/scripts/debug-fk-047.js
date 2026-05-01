const { query } = require('/var/www/sgq-backend/src/config/database');
(async () => {
  try {
    // Verifica se la tabella custom_checklist_items ha la PK corretta
    const pk = await query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='custom_checklist_items' AND COLUMN_NAME='id'");
    console.log('PK custom_checklist_items:', JSON.stringify(pk.recordset));
    // Tipo della colonna custom_item_id in attachments
    const col = await query("SELECT DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='attachments' AND COLUMN_NAME='custom_item_id'");
    console.log('custom_item_id tipo:', JSON.stringify(col.recordset));
    // Prova FK
    const fk = await query("SELECT name FROM sys.foreign_keys WHERE name='FK_attachments_custom_item_id'");
    console.log('FK esiste:', fk.recordset.length > 0);
    // Prova a creare la FK con messaggio di errore completo
    if (fk.recordset.length === 0) {
      await query("ALTER TABLE dbo.attachments ADD CONSTRAINT FK_attachments_custom_item_id FOREIGN KEY (custom_item_id) REFERENCES dbo.custom_checklist_items(id) ON DELETE SET NULL");
      console.log('FK creata OK');
    }
    process.exit(0);
  } catch(e) {
    console.error('ERRORE completo:', e.message, e.originalError?.info?.message);
    process.exit(1);
  }
})();
