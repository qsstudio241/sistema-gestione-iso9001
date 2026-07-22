#!/usr/bin/env node
/**
 * Elenca norme duplicate / obsolete (esecuzione su VPS: DB_SERVER=127.0.0.1).
 */
const path = require('path');
const backendRoot = path.join(__dirname, '..');
const { query, getPool, closePool } = require(path.join(backendRoot, 'src/config/database'));

async function main() {
  await getPool();

  const targets = await query(`
    SELECT dr.id, dr.organization_id, dr.status, dr.title, dr.created_at,
      JSON_VALUE(dr.type_specific_data, '$.standard_code') AS standard_code,
      dr.attachment_id
    FROM document_registry dr
    WHERE dr.doc_type = 'norma'
      AND (
        dr.title LIKE '%15608%' OR dr.title LIKE '%15614%'
        OR JSON_VALUE(dr.type_specific_data, '$.standard_code') LIKE '%15608%'
        OR JSON_VALUE(dr.type_specific_data, '$.standard_code') LIKE '%15614%'
        OR JSON_VALUE(dr.type_specific_data, '$.standard_code') LIKE '%9606%'
        OR JSON_VALUE(dr.type_specific_data, '$.standard_code') LIKE '%ISO 2013%'
      )
    ORDER BY standard_code, dr.created_at
  `);

  console.log('=== Norme test (15608 / 15614 / 9606 / ISO 2013) ===');
  console.log('Righe:', targets.recordset.length);
  for (const row of targets.recordset) {
    console.log(
      `#${row.id} org=${row.organization_id} status=${row.status} code=${row.standard_code} att=${row.attachment_id ?? 'NULL'}`
    );
  }

  const dup = await query(`
    SELECT
      JSON_VALUE(type_specific_data, '$.standard_code') AS standard_code,
      SUM(CASE WHEN ISNULL(status, 'rilasciato') = 'obsoleto' THEN 1 ELSE 0 END) AS obsoleto,
      SUM(CASE WHEN ISNULL(status, 'rilasciato') <> 'obsoleto' THEN 1 ELSE 0 END) AS attive
    FROM document_registry
    WHERE doc_type = 'norma'
      AND JSON_VALUE(type_specific_data, '$.standard_code') IS NOT NULL
    GROUP BY JSON_VALUE(type_specific_data, '$.standard_code')
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  console.log('\n=== Codici con più record ===');
  for (const row of dup.recordset) {
    console.log(`${row.standard_code}: attive=${row.attive} obsolete=${row.obsoleto}`);
  }

  const totals = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'obsoleto' THEN 1 ELSE 0 END) AS obsoleto
    FROM document_registry WHERE doc_type = 'norma'
  `);
  console.log('\n=== Totali norme ===', totals.recordset[0]);

  await closePool();
}

main().catch(async (e) => {
  console.error('ERRORE:', e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
