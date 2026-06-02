/**
 * import-notification-contacts-from-nc.js
 *
 * Import one-shot referenti NC da campi testo esistenti verso notification_contacts
 * e aggiorna le FK *_contact_id su non_conformities / nc_actions.
 *
 * Per ogni valore testo non vuoto SENZA contact_id già valorizzato:
 *   - crea riga in notification_contacts (email dedotta dal testo o placeholder)
 *   - se stesso nome esiste già nell'org (case-insensitive) riusa l'id
 *   - aggiorna NC/azione con il contact_id trovato o creato
 *
 * Uso locale:
 *   node backend/scripts/import-notification-contacts-from-nc.js
 *   node backend/scripts/import-notification-contacts-from-nc.js --dry-run
 *
 * Uso VPS (dopo migration 073/074):
 *   scp -P 1122 backend/scripts/import-notification-contacts-from-nc.js spascarella@www.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@www.fr-busato.it "node /tmp/import-notification-contacts-from-nc.js --dry-run"
 *   ssh -p 1122 spascarella@www.fr-busato.it "node /tmp/import-notification-contacts-from-nc.js"
 *
 * Richiede database.json oppure variabili d'ambiente DB_* (.env).
 */

const path = require('path');
const fs = require('fs');

const isVps = fs.existsSync('/var/www/sgq-backend/src/config/database.js');
const basePath = isVps ? '/var/www/sgq-backend' : path.join(__dirname, '..');

if (isVps) {
  process.chdir('/var/www/sgq-backend');
  require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
} else {
  require('dotenv').config({ path: path.join(basePath, '.env') });
}

const { getPool } = require(path.join(basePath, 'src', 'config', 'database'));
const {
  extractNameFromText,
  resolveContactEmail,
  normalizeNameKey,
} = require(path.join(basePath, 'src', 'utils', 'importNotificationContactsHelpers'));

const dryRun = process.argv.includes('--dry-run');

/** @type {Map<number, Map<string, { id: number, name: string, email: string }>>} */
const cacheByOrg = new Map();

const stats = {
  created: 0,
  reused: 0,
  updated: 0,
  skipped: 0,
};

async function loadExistingContacts(pool) {
  const result = await pool.request().query(`
    SELECT id, organization_id, name, email
    FROM notification_contacts
    ORDER BY organization_id, id
  `);
  for (const row of result.recordset || []) {
    if (!cacheByOrg.has(row.organization_id)) {
      cacheByOrg.set(row.organization_id, new Map());
    }
    const key = normalizeNameKey(row.name);
    if (!cacheByOrg.get(row.organization_id).has(key)) {
      cacheByOrg.get(row.organization_id).set(key, row);
    }
  }
}

async function findOrCreateContact(pool, orgId, rawText, roleType) {
  const name = extractNameFromText(rawText);
  if (!name) {
    stats.skipped += 1;
    return null;
  }

  const key = normalizeNameKey(name);
  if (!cacheByOrg.has(orgId)) cacheByOrg.set(orgId, new Map());
  const orgCache = cacheByOrg.get(orgId);

  if (orgCache.has(key)) {
    stats.reused += 1;
    return orgCache.get(key).id;
  }

  const email = resolveContactEmail(rawText);

  if (dryRun) {
    stats.created += 1;
    const fakeId = -(stats.created);
    orgCache.set(key, { id: fakeId, name, email });
    return fakeId;
  }

  const insert = await pool.request()
    .input('orgId', orgId)
    .input('name', name)
    .input('email', email)
    .input('roleType', roleType)
    .query(`
      INSERT INTO notification_contacts (organization_id, name, email, role_type, active)
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.email
      VALUES (@orgId, @name, @email, @roleType, 1)
    `);

  const created = insert.recordset[0];
  orgCache.set(key, created);
  stats.created += 1;
  return created.id;
}

async function processField(pool, { orgId, entityType, entityId, text, contactId, column, roleType }) {
  const trimmed = String(text || '').trim();
  if (!trimmed || contactId != null) {
    stats.skipped += 1;
    return;
  }

  const contactIdResolved = await findOrCreateContact(pool, orgId, trimmed, roleType);
  if (!contactIdResolved) return;

  if (dryRun) {
    stats.updated += 1;
    console.log(`  [DRY] ${entityType} ${entityId}: ${column} -> contact_id ${contactIdResolved} ("${trimmed}")`);
    return;
  }

  const table = entityType === 'nc' ? 'non_conformities' : 'nc_actions';
  const idCol = entityType === 'nc' ? 'nc_id' : 'action_id';

  await pool.request()
    .input('contactId', contactIdResolved)
    .input('entityId', entityId)
    .query(`
      UPDATE ${table}
      SET ${column} = @contactId
      WHERE ${idCol} = @entityId
    `);

  stats.updated += 1;
  console.log(`  [OK] ${entityType} ${entityId}: ${column} = ${contactIdResolved}`);
}

async function main() {
  const pool = await getPool();
  console.log(`Import referenti NC avviato${dryRun ? ' (DRY-RUN — nessuna scrittura)' : ''}...`);

  await loadExistingContacts(pool);

  const ncRows = await pool.request().query(`
    SELECT
      nc.nc_id,
      a.organization_id,
      nc.responsible_person,
      nc.responsible_contact_id,
      nc.verification_responsible,
      nc.verification_contact_id
    FROM non_conformities nc
    INNER JOIN audits a ON nc.audit_id = a.audit_id
  `);

  for (const row of ncRows.recordset || []) {
    await processField(pool, {
      orgId: row.organization_id,
      entityType: 'nc',
      entityId: row.nc_id,
      text: row.responsible_person,
      contactId: row.responsible_contact_id,
      column: 'responsible_contact_id',
      roleType: 'attuazione',
    });
    await processField(pool, {
      orgId: row.organization_id,
      entityType: 'nc',
      entityId: row.nc_id,
      text: row.verification_responsible,
      contactId: row.verification_contact_id,
      column: 'verification_contact_id',
      roleType: 'verifica',
    });
  }

  const actionRows = await pool.request().query(`
    SELECT
      na.action_id,
      a.organization_id,
      na.responsible,
      na.responsible_contact_id
    FROM nc_actions na
    INNER JOIN non_conformities nc ON na.nc_id = nc.nc_id
    INNER JOIN audits a ON nc.audit_id = a.audit_id
  `);

  for (const row of actionRows.recordset || []) {
    await processField(pool, {
      orgId: row.organization_id,
      entityType: 'action',
      entityId: row.action_id,
      text: row.responsible,
      contactId: row.responsible_contact_id,
      column: 'responsible_contact_id',
      roleType: 'attuazione',
    });
  }

  console.log('\n--- Riepilogo ---');
  console.log(`Creati:     ${stats.created}`);
  console.log(`Riusati:    ${stats.reused}`);
  console.log(`Aggiornati: ${stats.updated}`);
  console.log(`Saltati:    ${stats.skipped}`);
  if (dryRun) {
    console.log('\nNessuna modifica applicata (dry-run). Rimuovere --dry-run per eseguire.');
  }
}

main().catch((err) => {
  console.error('ERRORE import referenti:', err.message);
  process.exit(1);
});
