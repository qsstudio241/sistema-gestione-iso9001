/**
 * Migration 049 — VPS runner
 * Aggiunge colonna promoted_local_nc_id a non_conformities (S-A6)
 * Usage: node /tmp/run-migration-049-vps.js
 */
'use strict';

process.env.NODE_ENV = 'production';
const { query, closePool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
  console.log('[049] Verifica colonna promoted_local_nc_id ...');
  try {
    const check = await query(`
      SELECT 1 AS exists_col FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'promoted_local_nc_id'
    `);
    if (check.recordset.length > 0) {
      console.log('[049] Colonna già presente — skip');
    } else {
      await query(`
        ALTER TABLE non_conformities
        ADD promoted_local_nc_id NVARCHAR(36) NULL
      `);
      console.log('[049] Colonna promoted_local_nc_id aggiunta OK');
    }
    console.log('[049] Migrazione completata.');
  } catch (err) {
    console.error('[049] ERRORE:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
