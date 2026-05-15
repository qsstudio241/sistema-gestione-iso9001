const sql = require('/var/www/sgq-backend/node_modules/mssql');
(async () => {
  const p = await sql.connect({
    server: 'localhost', port: 11043, database: 'SGQ_ISO9001',
    user: 'pascarella', password: '#Gestione2025@',
    options: { encrypt: true, trustServerCertificate: true }
  });
  const r1 = await p.request().query(
    "SELECT cc.name, cc.definition FROM sys.check_constraints cc JOIN sys.tables t ON cc.parent_object_id = t.object_id WHERE t.name = 'attachments'"
  );
  r1.recordset.forEach(c => console.log('CONSTRAINT:', c.name, '=', c.definition));
  console.log('---');
  const r2 = await p.request().query(
    "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='attachments' ORDER BY ORDINAL_POSITION"
  );
  r2.recordset.forEach(c => console.log(c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE));
  await p.close();
})();
