const { query } = require('../backend/src/config/database');
(async () => {
  const r = await query("SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='document_registry' ORDER BY ORDINAL_POSITION");
  console.log(r.recordset.map(x=>`${x.COLUMN_NAME}:${x.IS_NULLABLE}`).join('\n'));
})().catch(e=>console.error(e.message));
