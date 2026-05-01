const { query } = require('/var/www/sgq-backend/src/config/database');
(async () => {
  try {
    // Verifica PK effettiva di custom_checklist_items
    const pk = await query(`
      SELECT kcu.COLUMN_NAME, tc.CONSTRAINT_TYPE
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'custom_checklist_items'
      AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `);
    console.log('PK real:', JSON.stringify(pk.recordset));

    // Verifica che non ci siano NULL esistenti in custom_item_id che violerebbero FK
    const nulls = await query("SELECT COUNT(*) AS cnt FROM dbo.attachments WHERE custom_item_id IS NOT NULL");
    console.log('Righe con custom_item_id non null:', JSON.stringify(nulls.recordset));

    // Prova senza ON DELETE SET NULL
    const fk2 = await query("SELECT name FROM sys.foreign_keys WHERE name='FK_attachments_custom_item_id'");
    if (fk2.recordset.length === 0) {
      await query("ALTER TABLE dbo.attachments ADD CONSTRAINT FK_attachments_custom_item_id FOREIGN KEY (custom_item_id) REFERENCES dbo.custom_checklist_items(id)");
      console.log('FK creata senza ON DELETE SET NULL');
    }
    process.exit(0);
  } catch(e) {
    console.error('ERRORE:', e.originalError?.info?.message || e.message);
    process.exit(1);
  }
})();
