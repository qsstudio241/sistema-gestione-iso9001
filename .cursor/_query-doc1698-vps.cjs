'use strict';
const sql = require('mssql');
const cfg = require('/var/www/sgq-backend/src/config/database');
async function run() {
  const pool = await sql.connect(cfg);
  const r1 = await pool.request().query("SELECT organization_id, name FROM organizations WHERE organization_id = 1002");
  console.log('ORG:', JSON.stringify(r1.recordset));
  const r2 = await pool.request().query("SELECT document_id, title, doc_type, organization_id, created_at FROM documents WHERE document_id = 1698");
  console.log('DOC:', JSON.stringify(r2.recordset));
  const r3 = await pool.request().query("SELECT file_id, document_id, original_name, file_path, uploaded_at FROM document_files WHERE document_id = 1698");
  console.log('FILES:', JSON.stringify(r3.recordset));
  await pool.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
