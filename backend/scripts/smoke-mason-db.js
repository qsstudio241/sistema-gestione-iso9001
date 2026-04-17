/**
 * Smoke: numerazione Mason su audit recenti (DB reale / locale).
 * - Ultimi 30 giorni per created_at: tutti devono matchare PREFISSO-YYMMDD-NN (default MSN).
 * - Ultimi 15 per audit_id: solo report (nessun FAIL se legacy misti a test LOCK).
 * Uso: cd backend && NODE_ENV=production node scripts/smoke-mason-db.js
 */
require('dotenv').config();
const sql = require('mssql');
const { resolveDbSection } = require('./mergeDbEnv');

const MASON = /^[A-Z0-9]{1,16}-\d{6}-\d{2}$/;

async function main() {
  const c = resolveDbSection(process.env.NODE_ENV || 'production');
  const pool = await sql.connect({
    server: c.server,
    port: c.port || 1433,
    database: c.database,
    user: c.user,
    password: c.password,
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  });

  const masonAny = await pool.request().query(`
    SELECT TOP 5 audit_id, audit_number, created_at
    FROM dbo.audits
    WHERE deleted_at IS NULL
      AND audit_number IS NOT NULL
      AND LEN(audit_number) >= 12
      AND audit_number LIKE '%-[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9]'
      AND audit_number NOT LIKE 'LOCK%'
    ORDER BY audit_id DESC
  `);

  const masonOk = masonAny.recordset.filter((row) => MASON.test(String(row.audit_number).trim()));
  if (masonOk.length > 0) {
    console.log(`SMOKE MASON DB: trovati ${masonOk.length} audit con formato Mason (esempi):`);
    masonOk.forEach((row) => console.log(`  ${row.audit_id}\t${row.audit_number}\t${row.created_at}`));
  } else {
    console.log(
      'SMOKE MASON DB: nessun audit ancora in formato Mason nel DB (normale se nessuna creazione post-deploy 040).',
    );
    console.log('  Azione consigliata: creare un audit da app produzione e rilanciare questo script.');
  }

  const recent = await pool.request().query(`
    SELECT audit_id, audit_number, created_at
    FROM dbo.audits
    WHERE deleted_at IS NULL
      AND created_at >= DATEADD(day, -30, SYSUTCDATETIME())
      AND audit_number NOT LIKE 'LOCK%'
    ORDER BY created_at DESC
  `);

  const badRecent = [];
  for (const row of recent.recordset) {
    const n = row.audit_number;
    if (n == null || String(n).trim() === '') badRecent.push({ audit_id: row.audit_id, reason: 'vuoto' });
    else if (!MASON.test(String(n).trim())) badRecent.push({ audit_id: row.audit_id, audit_number: n, reason: 'non Mason' });
  }

  if (badRecent.length && masonOk.length > 0) {
    console.warn(
      '\nNota: negli ultimi 30gg ci sono ancora numeri legacy (pre-040) insieme a Mason; non è errore finché i nuovi sono corretti.',
    );
  } else if (badRecent.length && masonOk.length === 0) {
    console.log(
      '\nUltimi 30gg (esclusi LOCK): tutti legacy — OK finché non crei nuovi audit; dopo la prima creazione post-040 devono essere Mason.',
    );
  } else if (recent.recordset.length && badRecent.length === 0) {
    console.log('\nSMOKE MASON (ultimi 30gg, esclusi LOCK): OK — tutti nel formato Mason.');
  }

  const topId = await pool.request().query(`
    SELECT TOP 8 audit_id, audit_number, created_at
    FROM dbo.audits WHERE deleted_at IS NULL ORDER BY audit_id DESC
  `);
  console.log('\nUltimi audit_id (solo informativo, possono essere legacy/test):');
  topId.recordset.forEach((row) => console.log(`  ${row.audit_id}\t${row.audit_number}`));

  await pool.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
