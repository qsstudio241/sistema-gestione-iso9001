const sql = require('mssql');
const path = require('path');
const dbConfig = require(path.join(__dirname, '..', 'config', 'database.json'));
const cfg = dbConfig.production;

(async () => {
  let pool;
  try {
    pool = await sql.connect({
      server: cfg.server, port: cfg.port, database: cfg.database,
      user: cfg.user, password: cfg.password, options: cfg.options,
    });

    const r1 = await pool.request().query(`
      SELECT COUNT(*) AS total_responses FROM audit_responses
    `);
    console.log('Total audit_responses: ' + r1.recordset[0].total_responses);

    const r2 = await pool.request().query(`
      SELECT COUNT(*) AS with_notes FROM audit_responses
      WHERE notes IS NOT NULL AND LEN(notes) > 20
    `);
    console.log('Risposte con note significative (>20 char): ' + r2.recordset[0].with_notes);

    const r3 = await pool.request().query(`
      SELECT TOP 5 ar.response_id, ar.audit_id, ar.conformity_status,
             LEFT(ar.notes, 200) AS note_preview,
             LEN(ar.notes) AS note_len,
             a.company_id, a.organization_id
      FROM audit_responses ar
      JOIN audits a ON ar.audit_id = a.audit_id
      WHERE ar.notes IS NOT NULL AND LEN(ar.notes) > 20
      ORDER BY LEN(ar.notes) DESC
    `);
    console.log('\n=== TOP 5 NOTE PIU LUNGHE ===');
    r3.recordset.forEach(r => {
      console.log('ResponseID=' + r.response_id + ' AuditID=' + r.audit_id +
        ' Status=' + r.conformity_status + ' OrgID=' + r.organization_id +
        ' CompanyID=' + r.company_id + ' NoteLen=' + r.note_len);
      console.log('  -> ' + r.note_preview);
    });

    const r4 = await pool.request().query(`
      SELECT a.organization_id, COUNT(*) AS cnt
      FROM audit_responses ar
      JOIN audits a ON ar.audit_id = a.audit_id
      WHERE ar.notes IS NOT NULL AND LEN(ar.notes) > 20
      GROUP BY a.organization_id
    `);
    console.log('\n=== NOTE PER ORGANIZZAZIONE ===');
    r4.recordset.forEach(r => console.log('OrgID=' + r.organization_id + ': ' + r.cnt + ' note'));

    const r5 = await pool.request().query(`
      SELECT TOP 1 cq.clause_ref, cq.question_text, ar.notes, ar.conformity_status
      FROM audit_responses ar
      JOIN checklist_questions cq ON ar.question_id = cq.question_id
      WHERE ar.notes IS NOT NULL AND LEN(ar.notes) > 50
      ORDER BY LEN(ar.notes) DESC
    `);
    if (r5.recordset.length > 0) {
      const r = r5.recordset[0];
      console.log('\n=== ESEMPIO NOTA CON CONTESTO CLAUSOLA ===');
      console.log('Clausola: ' + r.clause_ref);
      console.log('Domanda: ' + (r.question_text || '').substring(0, 100));
      console.log('Status: ' + r.conformity_status);
      console.log('Nota: ' + (r.notes || '').substring(0, 300));
    }
  } catch(e) { console.error('ERR:', e.message); }
  finally { if (pool) await pool.close(); }
  process.exit(0);
})();
