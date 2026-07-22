require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env.test' });
const { query } = require('/var/www/sgq-backend/src/config/database');
query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='management_reviews' ORDER BY ORDINAL_POSITION")
  .then(r => console.log(r.recordset.map(x => x.COLUMN_NAME).join(', ')))
  .catch(e => console.error(e.message))
  .finally(() => process.exit(0));
