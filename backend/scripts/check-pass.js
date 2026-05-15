const sql = require('/var/www/sgq-backend/node_modules/mssql');
const fs = require('fs');
const configs = JSON.parse(fs.readFileSync('/var/www/sgq-backend/config/database.json','utf8'));
const c = configs.production;
sql.connect({server:'localhost',port:c.port,database:c.database,user:c.user,password:c.password,options:{encrypt:false,trustServerCertificate:true}})
  .then(pool => pool.request().query("SELECT email, LEFT(password_hash,20) as hash_preview FROM users WHERE email='admin@sgq.local'"))
  .then(r => { console.log(JSON.stringify(r.recordset)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });