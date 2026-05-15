const sql = require('/var/www/sgq-backend/node_modules/mssql');
const fs = require('fs');
const configs = JSON.parse(fs.readFileSync('/var/www/sgq-backend/config/database.json','utf8'));
const c = configs.production;
sql.connect({server:'localhost',port:c.port,database:c.database,user:c.user,password:c.password,options:{encrypt:false,trustServerCertificate:true}})
  .then(async pool => {
    // Check document_tree_templates columns
    const r1 = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='document_tree_templates' ORDER BY ORDINAL_POSITION");
    console.log('document_tree_templates columns:');
    r1.recordset.forEach(c => console.log('  ', c.COLUMN_NAME, '-', c.DATA_TYPE));
    
    // Check document_folders columns
    const r2 = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='document_folders' ORDER BY ORDINAL_POSITION");
    console.log('\ndocument_folders columns:');
    r2.recordset.forEach(c => console.log('  ', c.COLUMN_NAME, '-', c.DATA_TYPE));
    
    process.exit(0);
  })
  .catch(e => { console.error(e.message); process.exit(1); });