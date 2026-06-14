/**
 * Verifica post-migrazione controparti (096+097)
 * Uso: node backend/scripts/verify-counterparties-migration.js
 */
'use strict';

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8'),
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

async function run() {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const schema = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM sys.tables WHERE name = 'company_counterparties') AS cp_table,
        (SELECT COUNT(*) FROM sys.columns
          WHERE object_id = OBJECT_ID('commercial_cases') AND name = 'commercial_customer_id') AS cc_fk_col,
        (SELECT COUNT(*) FROM sys.columns
          WHERE object_id = OBJECT_ID('projects') AND name = 'end_customer_id') AS proj_fk_col
    `);
    console.log('Schema:', schema.recordset[0]);

    const counts = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM company_counterparties) AS counterparties_total,
        (SELECT COUNT(*) FROM commercial_cases WHERE commercial_customer_id IS NOT NULL) AS cases_with_fk,
        (SELECT COUNT(*) FROM commercial_cases
          WHERE commercial_customer_name IS NOT NULL
            AND LTRIM(RTRIM(commercial_customer_name)) <> ''
            AND commercial_customer_id IS NULL) AS cases_text_only,
        (SELECT COUNT(*) FROM projects WHERE end_customer_id IS NOT NULL) AS projects_with_fk
    `);
    console.log('Conteggi:', counts.recordset[0]);

    const lmco = await pool.request().query(`
      SELECT cp.id, cp.name, cp.role, cp.external_ref, c.name AS company_name
      FROM company_counterparties cp
      INNER JOIN companies c ON c.id = cp.company_id
      WHERE c.name LIKE '%LM&CO%'
      ORDER BY cp.role, cp.name
    `);
    console.log('\nControparti LM&CO:', lmco.recordset.length);
    for (const row of lmco.recordset) {
      console.log(`  [${row.id}] ${row.name} (${row.role}) ref=${row.external_ref || '-'} — ${row.company_name}`);
    }

    const casesSample = await pool.request().query(`
      SELECT TOP 10
        cc.id, cc.title, cc.commercial_customer_id,
        cc.commercial_customer_name, cc.commercial_customer_ref,
        c.name AS company_name
      FROM commercial_cases cc
      LEFT JOIN companies c ON c.id = cc.company_id
      WHERE cc.commercial_customer_name IS NOT NULL
         OR cc.commercial_customer_id IS NOT NULL
      ORDER BY cc.updated_at DESC
    `);
    console.log('\nCasi commerciali (campione):');
    for (const row of casesSample.recordset) {
      const mode = row.commercial_customer_id ? 'FK' : 'testo';
      console.log(`  [${row.id}] ${row.title} — ${mode}: ${row.commercial_customer_name || '-'} (${row.company_name || 'no company'})`);
    }
  } catch (err) {
    console.error('ERRORE verifica:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
