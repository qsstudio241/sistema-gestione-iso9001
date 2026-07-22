const { query } = require('../backend/src/config/database');
(async () => {
  const r = await query("SELECT TOP 3 import_status, status, revision_number FROM document_registry");
  console.log(r.recordset);
})().catch(e=>console.error(e.message));
