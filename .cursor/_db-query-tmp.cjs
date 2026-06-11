const { query } = require('../backend/src/config/database');
(async () => {
  const r = await query("SELECT TOP 5 user_id, email, role, organization_id FROM users WHERE role='superadmin' AND is_active=1");
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
