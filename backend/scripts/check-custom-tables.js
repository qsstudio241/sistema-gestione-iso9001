const { query } = require('/var/www/sgq-backend/src/config/database');
query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%custom%' ORDER BY TABLE_NAME")
  .then(r => { console.log(JSON.stringify(r.recordset)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
