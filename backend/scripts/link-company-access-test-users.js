#!/usr/bin/env node
'use strict';

/**
 * Collega account test a company_id via user_company_access (RBAC Fase 4).
 * Eseguire sul VPS: node scripts/link-company-access-test-users.js
 *
 * Credenziali: username in output; password in mcp.env (NON committare).
 *
 * Variabili opzionali:
 *   WRITE_EMAIL   default cliente.azienda11@alproject.sgq.local
 *   READ_EMAIL    default viewer.azienda11@alproject.sgq.local
 *   COMPANY_ID    default 11
 */

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

const WRITE_EMAIL = process.env.WRITE_EMAIL || 'cliente.azienda11@alproject.sgq.local';
const READ_EMAIL = process.env.READ_EMAIL || 'viewer.azienda11@alproject.sgq.local';
const COMPANY_ID = parseInt(process.env.COMPANY_ID || '11', 10);

async function findUser(email) {
  const r = await query(
    `SELECT user_id, email, organization_id, role FROM users WHERE email = @email`,
    { email }
  );
  return r.recordset[0] || null;
}

async function upsertAccess(userId, organizationId, companyId, permission) {
  await query(`
    MERGE user_company_access AS target
    USING (SELECT @user_id AS user_id, @company_id AS company_id) AS source
    ON target.user_id = source.user_id AND target.company_id = source.company_id
    WHEN MATCHED THEN
      UPDATE SET permission = @permission, organization_id = @organization_id
    WHEN NOT MATCHED THEN
      INSERT (user_id, company_id, permission, organization_id)
      VALUES (@user_id, @company_id, @permission, @organization_id);
  `, {
    user_id: userId,
    company_id: companyId,
    permission,
    organization_id: organizationId,
  });
}

(async () => {
  console.log('RBAC Fase 4  link account test user_company_access');
  console.log(`Company target: ${COMPANY_ID}`);

  const writeUser = await findUser(WRITE_EMAIL);
  const readUser = await findUser(READ_EMAIL);

  if (!writeUser) {
    console.error(`Utente write non trovato: ${WRITE_EMAIL}`);
    process.exit(1);
  }
  if (!readUser) {
    console.error(`Utente read non trovato: ${READ_EMAIL}`);
    process.exit(1);
  }

  const companyCheck = await query(`
    SELECT c.id, ao.organization_id
    FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE c.id = @company_id
  `, { company_id: COMPANY_ID });

  const company = companyCheck.recordset[0];
  if (!company) {
    console.error(`Company ${COMPANY_ID} non trovata`);
    process.exit(1);
  }

  await upsertAccess(writeUser.user_id, company.organization_id, COMPANY_ID, 'write');
  await upsertAccess(readUser.user_id, company.organization_id, COMPANY_ID, 'read');

  // Fase 4.1: account solo-azienda — rimuovi scope studio attenuato (opzionale via env)
  if (process.env.CLEAR_AUDITOR_ORG !== '0') {
    await query(`
      UPDATE users SET auditor_org_id = NULL
      WHERE user_id IN (@write_id, @read_id)
    `, { write_id: writeUser.user_id, read_id: readUser.user_id });
    console.log('auditor_org_id azzerato per account test company-only');
  }

  console.log('OK');
  console.log(`Write user: ${writeUser.email} (user_id ${writeUser.user_id}) ? company ${COMPANY_ID} write`);
  console.log(`Read user:  ${readUser.email} (user_id ${readUser.user_id}) ? company ${COMPANY_ID} read`);
  console.log('Password: vedere mcp.env (non in repo).');
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
