const sql = require('mssql');
const cfg = require('./backend/config/database.json');
const pool = new sql.ConnectionPool(cfg.production);
pool.connect().then(async () => {
  const r1 = await pool.request().query("SELECT organization_id, name FROM organizations WHERE organization_id = 1002");
  console.log('ORG:', JSON.stringify(r1.recordset));
  const r2 = await pool.request().query("SELECT * FROM documents WHERE document_id = 1698");
  console.log('DOC:', JSON.stringify(r2.recordset));
  const r3 = await pool.request().query("SELECT * FROM document_files WHERE document_id = 1698");
  console.log('FILES:', JSON.stringify(r3.recordset));
  pool.close();
}).catch(e => { console.error(e.message); process.exit(1); });
