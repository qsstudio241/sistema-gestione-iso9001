const { query } = require('../backend/src/config/database');
(async () => {
  for (const t of ['non_conformities','document_registry']) {
    const r = await query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' AND IS_NULLABLE='NO' ORDER BY ORDINAL_POSITION`);
    console.log(t+':', r.recordset.map(x=>x.COLUMN_NAME).join(', '));
  }
})().catch(e=>console.error(e.message));
