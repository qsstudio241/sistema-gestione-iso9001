/**
 * smoke.controller.js — Endpoint di smoke test remoto per il DB di test.
 *
 * Protetto da token statico (X-Smoke-Token). NON usa il pool DB principale:
 * crea una connessione isolata al profilo "test" di database.json, in modo
 * da non interferire con il pool di produzione.
 *
 * GET /api/v1/smoke/testdb
 * Header richiesto: X-Smoke-Token: <SMOKE_TOKEN>
 *
 * Risposta OK  → HTTP 200  { ok: true,  db, tables, counts, checks }
 * Risposta FAIL → HTTP 500  { ok: false, errors: [...] }
 */

const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const REQUIRED_TABLES = [
  'audits',
  'audit_responses',
  'audit_events',
  'non_conformities',
  'organizations',
  'users',
  'custom_checklists',
  'custom_checklist_items',
  'checklist_sections',
  'nc_actions',
  'attachments',
  'audit_standards',
];

const SMOKE_TOKEN_DEFAULT = 'dev-smoke-token-change-in-prod';

function loadTestDbConfig() {
  const configPath = path.join(__dirname, '..', '..', 'config', 'database.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('database.json mancante — impossibile caricare profilo "test"');
  }
  const all = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const c = all['test'];
  if (!c) throw new Error('Sezione "test" mancante in backend/config/database.json');
  return c;
}

async function testdb(req, res) {
  const expectedToken = process.env.SMOKE_TOKEN || SMOKE_TOKEN_DEFAULT;
  const providedToken = req.headers['x-smoke-token'] || '';

  if (!providedToken || providedToken !== expectedToken) {
    return res.status(401).json({ ok: false, error: 'Token smoke non valido o mancante' });
  }

  // Avviso esplicito se si usa il token di default in un ambiente che sembra produzione.
  if (providedToken === SMOKE_TOKEN_DEFAULT && process.env.NODE_ENV === 'production') {
    logger.warn('[SMOKE] ATTENZIONE: SMOKE_TOKEN usa il valore di default in produzione — cambiarlo!');
  }

  let pool = null;
  const errors = [];
  const checks = {};

  try {
    const c = loadTestDbConfig();

    logger.info(`[SMOKE] Connessione a [${c.database}] su ${c.server}:${c.port || 1433}`);

    pool = await new sql.ConnectionPool({
      server: c.server,
      port: c.port || 1433,
      database: c.database,
      user: c.user,
      password: c.password,
      options: {
        encrypt: c.options?.encrypt ?? false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: c.options?.connectTimeout ?? 30000,
        requestTimeout: c.options?.requestTimeout ?? 30000,
      },
    }).connect();

    // 1. Verifica esistenza tabelle chiave
    const tablesRes = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    const existingTables = new Set(tablesRes.recordset.map((r) => r.TABLE_NAME.toLowerCase()));
    const missingTables = REQUIRED_TABLES.filter((t) => !existingTables.has(t.toLowerCase()));

    checks.tables_total = existingTables.size;
    checks.tables_required = REQUIRED_TABLES.length;
    checks.tables_missing = missingTables;

    if (missingTables.length > 0) {
      errors.push(`Tabelle mancanti: ${missingTables.join(', ')}`);
    }

    // 2. Conteggi di base
    const countsRes = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.organizations)    AS orgs,
        (SELECT COUNT(*) FROM dbo.users)            AS users,
        (SELECT COUNT(*) FROM dbo.audits)           AS audits,
        (SELECT COUNT(*) FROM dbo.non_conformities) AS ncs
    `);
    const row = countsRes.recordset[0];
    checks.counts = {
      orgs: row.orgs,
      users: row.users,
      audits: row.audits,
      ncs: row.ncs,
    };

    // 3. Verifica integrità multi-tenant: audit senza organization_id
    const orphansRes = await pool.request().query(`
      SELECT COUNT(*) AS cnt FROM dbo.audits WHERE organization_id IS NULL
    `);
    const orphanCnt = orphansRes.recordset[0].cnt;
    checks.orphan_audits = orphanCnt;
    if (orphanCnt > 0) {
      errors.push(`${orphanCnt} audit senza organization_id (violazione multi-tenant)`);
    }

    // 4. Guardia anti-produzione: il DB connesso NON deve essere SGQ_ISO9001
    const dbNameRes = await pool.request().query('SELECT DB_NAME() AS db');
    const actualDb = dbNameRes.recordset[0].db;
    checks.db_name = actualDb;

    if (actualDb === 'SGQ_ISO9001') {
      errors.push('CRITICO: connesso al DB di PRODUZIONE SGQ_ISO9001 — smoke bloccato');
    }

    await pool.close();
    pool = null;

    if (errors.length > 0) {
      logger.warn('[SMOKE] FAIL', { errors });
      return res.status(500).json({ ok: false, db: actualDb, checks, errors });
    }

    logger.info('[SMOKE] OK', checks);
    return res.json({ ok: true, db: actualDb, checks, errors: [] });

  } catch (err) {
    if (pool) {
      try { await pool.close(); } catch (_) { /* ignora errori di chiusura */ }
    }
    logger.error('[SMOKE] Errore connessione DB:', err.message);
    return res.status(500).json({ ok: false, errors: [`Errore connessione: ${err.message}`] });
  }
}

module.exports = { testdb };
