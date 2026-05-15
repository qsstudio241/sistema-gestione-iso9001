const sql = require('/var/www/sgq-backend/node_modules/mssql');
(async () => {
  const p = await sql.connect({
    server: 'localhost', port: 11043, database: 'SGQ_ISO9001',
    user: 'pascarella', password: '#Gestione2025@',
    options: { encrypt: true, trustServerCertificate: true }
  });
  const r = await p.request().query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='document_registry' ORDER BY ORDINAL_POSITION"
  );
  r.recordset.forEach(c => console.log(c.COLUMN_NAME + ' (' + c.DATA_TYPE + ')'));
  await p.close();
})();
