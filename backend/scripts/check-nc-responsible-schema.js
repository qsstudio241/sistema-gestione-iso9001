'use strict';
/**
 * Verifica schema DB per responsible-options (migration 078)
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const { query } = require('../src/config/database');

(async () => {
  const cols = await query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('notification_contacts', 'company_personnel')
      AND COLUMN_NAME IN ('company_id', 'personnel_id', 'can_actuation', 'can_verify', 'notification_contact_id')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log('Columns:', cols.recordset);

  const tables = await query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'company_personnel'
  `);
  console.log('company_personnel exists:', tables.recordset.length > 0);

  try {
    const sample = await query(`
      SELECT TOP 1 id FROM notification_contacts
      WHERE organization_id = (SELECT TOP 1 organization_id FROM organizations)
        AND company_id IS NULL
    `);
    console.log('Query company_id IS NULL: OK');
  } catch (e) {
    console.error('Query company_id IS NULL FAILED:', e.message);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
