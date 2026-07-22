const { query } = require('../backend/src/config/database');
(async () => {
  const r = await query("SELECT TOP 1 section_code, standard_id FROM checklist_sections WHERE standard_id = (SELECT TOP 1 standard_id FROM standards WHERE is_active=1) ORDER BY section_code");
  console.log(r.recordset[0]);
})().catch(e=>console.error(e.message));
