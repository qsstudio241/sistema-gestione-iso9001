#!/usr/bin/env node
/**
 * run-migration-167-vps.js
 * Esegue migrazione 167 (ai_usage_log) sul VPS via SCP + SSH
 * 
 * Usage (Cloud Agent):
 *   node backend/scripts/run-migration-167-vps.js
 * 
 * Env required:
 *   SGQ_SSH_KEY_B64, SGQ_SUDO_PASSWORD (Dashboard Secrets)
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const VPS_HOST = 'sistemi.fr-busato.it';
const VPS_PORT = '1122';
const VPS_USER = 'spascarella';
const MIGRATION_FILE = 'database/migrations/167_ai_usage_log.sql';

async function main() {
  console.log('[167] Inizio migrazione AI usage log su VPS...');

  // 1. Decode SSH key
  const keyB64 = process.env.SGQ_SSH_KEY_B64;
  if (!keyB64) {
    console.error('❌ SGQ_SSH_KEY_B64 mancante. Esegui vps-preflight.ps1 (desktop) o verifica Dashboard Secrets (cloud).');
    process.exit(1);
  }

  mkdirSync('/tmp', { recursive: true });
  const keyPath = '/tmp/sgq_key';
  writeFileSync(keyPath, Buffer.from(keyB64, 'base64'), { mode: 0o600 });
  console.log('✅ Chiave SSH decodificata in /tmp/sgq_key');

  // 2. SCP migrazione SQL sul VPS
  try {
    console.log(`[SCP] Copiando ${MIGRATION_FILE} sul VPS...`);
    execSync(
      `scp -i ${keyPath} -P ${VPS_PORT} -o StrictHostKeyChecking=no ` +
      `${MIGRATION_FILE} ${VPS_USER}@${VPS_HOST}:/tmp/167_ai_usage_log.sql`,
      { stdio: 'inherit' }
    );
    console.log('✅ File SQL copiato su /tmp/167_ai_usage_log.sql');
  } catch (err) {
    console.error('❌ Errore SCP:', err.message);
    process.exit(1);
  }

  // 3. Esegui migrazione via sqlcmd remoto
  const sqlCmd = `
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" \\
      -d SGQ_ISO9001 -i /tmp/167_ai_usage_log.sql -C
  `;

  try {
    console.log('[SSH] Esecuzione migrazione SQL...');
    execSync(
      `ssh -i ${keyPath} -p ${VPS_PORT} -o StrictHostKeyChecking=no ` +
      `${VPS_USER}@${VPS_HOST} "${sqlCmd}"`,
      { stdio: 'inherit' }
    );
    console.log('✅ Migrazione 167 eseguita con successo.');
  } catch (err) {
    console.error('❌ Errore esecuzione SQL:', err.message);
    process.exit(1);
  }

  // 4. Cleanup file temporaneo remoto
  try {
    execSync(
      `ssh -i ${keyPath} -p ${VPS_PORT} -o StrictHostKeyChecking=no ` +
      `${VPS_USER}@${VPS_HOST} "rm -f /tmp/167_ai_usage_log.sql"`,
      { stdio: 'inherit' }
    );
    console.log('✅ File temporaneo remoto rimosso.');
  } catch (err) {
    console.warn('⚠️ Pulizia file remoto fallita (non bloccante):', err.message);
  }

  console.log('\n🎉 Migrazione 167 completata. Tabelle ai_usage_log e ai_usage_notifications create.');
}

main().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
