'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

(async () => {
  try {
    const t = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'user_company_access'
    `);
    console.log('table_exists:', t.recordset.length > 0 ? 'yes' : 'no');
    if (t.recordset.length) {
      const c = await query('SELECT COUNT(*) AS n FROM user_company_access');
      console.log('row_count:', c.recordset[0].n);
    }
    process.exit(t.recordset.length ? 0 : 2);
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
})();
