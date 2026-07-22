/**
 * Migration 090 sul VPS (DB su localhost:11043).
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
if (!process.env.DB_SERVER) {
  process.env.DB_SERVER = '127.0.0.1';
}

const fs = require('fs');
const { query } = require('/var/www/sgq-backend/src/config/database');

const SQL_PATH = '/tmp/090_nc_report_templates.sql';

async function runFromSqlFile() {
  if (!fs.existsSync(SQL_PATH)) {
    throw new Error(`File SQL non trovato: ${SQL_PATH}`);
  }
  const SQL = fs.readFileSync(SQL_PATH, 'utf8');
  const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    if (!batch) continue;
    console.log(`Batch ${i + 1}/${batches.length}...`);
    await query(batch);
  }
}

async function verify() {
  const scopes = await query(
    "SELECT cc.definition FROM sys.check_constraints cc WHERE cc.name = 'CK_report_templates_scope' AND cc.parent_object_id = OBJECT_ID('dbo.report_templates')"
  );
  const ncRows = await query(
    "SELECT id, name, scope, standard_key, file_path FROM dbo.report_templates WHERE scope = 'nc'"
  );
  console.log('CK_report_templates_scope definition:', scopes.recordset[0]?.definition || '(missing)');
  console.log('report_templates scope=nc count:', ncRows.recordset.length);
  ncRows.recordset.forEach((r) => {
    console.log(`  - id=${r.id} name=${r.name} key=${r.standard_key} path=${r.file_path}`);
  });
  const def = scopes.recordset[0]?.definition || '';
  if (!/\bnc\b/i.test(def)) {
    throw new Error('Verifica fallita: scope nc non presente nel CHECK constraint');
  }
  if (ncRows.recordset.length < 1) {
    throw new Error('Verifica fallita: nessun template scope=nc');
  }
  console.log('VERIFICA OK migration 090');
}

(async () => {
  try {
    await runFromSqlFile();
    await verify();
    process.exit(0);
  } catch (e) {
    console.error('ERRORE migration 090 VPS:', e.message);
    process.exit(1);
  }
})();

