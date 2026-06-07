'use strict';
process.env.NODE_ENV = 'production';
const { query } = require('../src/config/database');

(async () => {
  const cols = await query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'notification_contacts' ORDER BY ORDINAL_POSITION
  `);
  console.log('notification_contacts:', cols.recordset.map((r) => r.COLUMN_NAME).join(', '));

  const triggers = await query(`
    SELECT name, OBJECT_DEFINITION(object_id) AS def
    FROM sys.triggers
    WHERE parent_id = OBJECT_ID('notification_contacts')
  `);
  console.log('triggers:', triggers.recordset.length);
  triggers.recordset.forEach((t) => console.log(t.name, (t.def || '').slice(0, 300)));

  const user = await query("SELECT user_id, email, organization_id FROM users WHERE email='admin@sgq.local'");
  console.log('admin user:', user.recordset[0]);

  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
