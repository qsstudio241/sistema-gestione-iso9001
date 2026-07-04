#!/usr/bin/env node
'use strict';

/**
 * Esegue migrazione 120 su VPS (ingest_reference_patterns).
 * Uso: node /tmp/run-migration-120-vps.js
 */

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const sqlPath = path.join('/var/www/sgq-backend/database/migrations/120_ingest_reference_patterns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const batches = sql.split(/^\s*GO\s*$/gim).map((s) => s.trim()).filter(Boolean);
  for (const batch of batches) {
    await query(batch);
  }
  console.log('MIGRATION_120_OK');
}

main().catch((err) => {
  console.error('MIGRATION_120_FAIL', err.message);
  process.exit(1);
});
