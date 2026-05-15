const sql = require('/var/www/sgq-backend/node_modules/mssql');
(async () => {
  const p = await sql.connect({
    server: 'localhost', port: 11043, database: 'SGQ_ISO9001',
    user: 'pascarella', password: '#Gestione2025@',
    options: { encrypt: true, trustServerCertificate: true }
  });
  const r = await p.request().query(
    "SELECT cc.name, cc.definition FROM sys.check_constraints cc JOIN sys.tables t ON cc.parent_object_id = t.object_id WHERE t.name = 'document_registry'"
  );
  r.recordset.forEach(c => console.log(c.name + ': ' + c.definition));
  const r2 = await p.request().query(
    "SELECT DISTINCT status FROM document_registry"
  );
  console.log('Valori status esistenti:', r2.recordset.map(x => x.status));
  await p.close();
})();
