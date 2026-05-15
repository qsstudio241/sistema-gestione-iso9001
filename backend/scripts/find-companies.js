const sql = require('/var/www/sgq-backend/node_modules/mssql');
const fs = require('fs');
const configs = JSON.parse(fs.readFileSync('/var/www/sgq-backend/config/database.json','utf8'));
const c = configs.production;
sql.connect({server:'localhost',port:c.port,database:c.database,user:c.user,password:c.password,options:{encrypt:false,trustServerCertificate:true}})
  .then(async pool => {
    const cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='companies' ORDER BY ORDINAL_POSITION");
    console.log('Columns:', cols.recordset.map(r => r.COLUMN_NAME).join(', '));
    const r = await pool.request().query("SELECT TOP 3 * FROM companies ORDER BY id");
    r.recordset.forEach(row => console.log(JSON.stringify(row)));
    process.exit(0);
  })
  .catch(e => { console.error(e.message); process.exit(1); });